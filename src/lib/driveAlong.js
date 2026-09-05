import maplibregl from 'maplibre-gl';
import {
  measureLine,
  pointAt,
  bearingBetween,
  destinationPoint,
} from './routing';
import { ensureInk, drawInk, commitLeg } from './inkTrail';

// Trapezoid distance profile with smoothstep ramps: accelerate, cruise,
// brake — but velocity AND acceleration stay continuous, so pulling away,
// hitting cruise, and stopping all happen without a jerk. The smoothstep
// ramp integrates to 1/2 like the old linear one, so cruise math is
// unchanged.
const glide = (t, a = 0.22) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const ramp = (x) => x * x * x - x ** 4 / 2; // ∫₀ˣ smoothstep
  const norm = 1 - a;
  if (t < a) return (a * ramp(t / a)) / norm;
  if (t <= 1 - a) return (a / 2 + (t - a)) / norm;
  return (norm - a * ramp((1 - t) / a)) / norm;
};

const lerpAngle = (from, to, k) => {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + delta * k;
};

// Exponential-smoothing factor for a given frame delta and time constant,
// so the camera feel is identical at 60Hz and 144Hz
const smoothK = (dt, tau) => 1 - Math.exp(-dt / tau);

// Re-sample the route every `step` metres so smoothing works on even spacing
function resample(coords, step = 20) {
  const cum = measureLine(coords);
  const total = cum[cum.length - 1];
  const out = [];
  for (let d = 0; d < total; d += step) out.push(pointAt(coords, cum, d));
  out.push(coords[coords.length - 1]);
  return out;
}

// Moving-average smoothing kills the zigzag of raw OSRM polylines,
// which is what made the old camera swing through corners
function smoothPath(coords, win = 4) {
  const out = coords.map((_, i) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (
      let j = Math.max(0, i - win);
      j <= Math.min(coords.length - 1, i + win);
      j++
    ) {
      sx += coords[j][0];
      sy += coords[j][1];
      n++;
    }
    return [sx / n, sy / n];
  });
  out[0] = coords[0];
  out[out.length - 1] = coords[coords.length - 1];
  return out;
}

// Ink-drawn traveler lying flat on the parchment; north-pointing so
// setRotation(bearing) aims it down the road
function makeRider(map, at) {
  const el = document.createElement('div');
  el.className = 'rider';
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="30" height="30">' +
    '<path d="M12 1.5 L19.5 21 L12 16 L4.5 21 Z" fill="#453222" ' +
    'stroke="#f0e2c4" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  return new maplibregl.Marker({
    element: el,
    rotationAlignment: 'map',
    pitchAlignment: 'map',
  })
    .setLngLat(at)
    .addTo(map);
}

/**
 * Third-person chase-cam ride: a rider marker travels the (smoothed) route
 * inking the path behind it, while the camera trails a fixed distance back,
 * looking just past the rider down the road. The rider absorbs the turns —
 * the eye reads it as the stable thing and the map as moving past it.
 *
 * Built on calculateCameraOptionsFromTo (MapLibre's "stand here, look
 * there" primitive — it never ported Mapbox's FreeCamera API).
 *
 * Returns a cancel function; onEnd(cancelled) fires exactly once.
 */
export function driveAlong(map, coords, opts = {}) {
  const {
    hover = 120, // camera height above the rider's ground, metres
    chase = 170, // camera trails the rider by this much
    lookahead = 70, // aim point just past the rider, keeps it low-center frame
    arrivalPitch = 60,
    arrivalZoom = 16.1,
    speed = 0.075, // metres per millisecond at cruise (~270 km/h map-scale)
    minDuration = 4500,
    maxDuration = 20000,
    onEnd = () => {},
  } = opts;

  const rawCum = measureLine(coords);
  const rawTotal = rawCum[rawCum.length - 1];
  const end = coords[coords.length - 1];

  let raf = null;
  let cancelled = false;
  let ended = false;
  let rider = null;
  const finish = (was) => {
    if (!ended) {
      ended = true;
      if (rider) rider.remove();
      onEnd(was);
    }
  };
  const cancel = () => {
    if (!cancelled) {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      map.stop();
      finish(true);
    }
  };

  if (rawTotal < 150) {
    map.easeTo({ center: end, zoom: arrivalZoom, duration: 800 });
    map.once('moveend', () => finish(false));
    return cancel;
  }

  // Two smoothing passes (~±90m each) round street corners into arcs.
  // The ride deliberately cuts corners — it should feel like a glide over
  // the city, not a literal trace of every junction.
  const path = smoothPath(smoothPath(resample(coords, 15), 6), 6);
  const cum = measureLine(path);
  const total = cum[cum.length - 1];
  const duration = Math.min(maxDuration, Math.max(minDuration, total / speed));

  // Long legs hit the duration cap and rush by; ride higher so the ground
  // speed reads calmer, like pulling up for the long hops
  const lift = Math.min(2.2, Math.max(1, total / 2600));
  const camHover = hover * lift;
  const camChase = chase * lift;
  const camLookahead = lookahead * lift;

  // Rendered ground height under the camera. queryTerrainElevation reports
  // exaggerated metres (verified); 0 when terrain is off, which is also
  // where the flat ground plane really is.
  const groundAt = (p) => {
    let q = null;
    try {
      q = map.queryTerrainElevation
        ? map.queryTerrainElevation({ lng: p[0], lat: p[1] })
        : null;
    } catch {
      q = null;
    }
    return q == null || Number.isNaN(q) ? 0 : q;
  };

  ensureInk(map);
  rider = makeRider(map, path[0]);

  // Direction the route arrives from, for extending the aim point past the
  // destination — otherwise the aim freezes there and the camera's pitch
  // and zoom drift through the whole final stretch
  const endBearing = bearingBetween(
    pointAt(path, cum, Math.max(0, total - 30)),
    path[path.length - 1]
  );

  const startCenter = map.getCenter();
  const startZoom = map.getZoom();
  const startPitch = map.getPitch();
  const startBearing = map.getBearing();
  let heading = startBearing; // single smoothed authority for the chase cam
  let riderBearing = null; // lightly smoothed, so the arrow doesn't twitch
  let elevSmooth = null;
  let inkIdx = 1; // monotonic pointer into path for the traveled portion
  let startTime;
  let lastTime;

  const frame = (now) => {
    if (cancelled) return;
    if (startTime === undefined) {
      startTime = now;
      lastTime = now;
    }
    const dt = Math.min(now - lastTime, 100); // tab-switch guard
    lastTime = now;
    const t = Math.min((now - startTime) / duration, 1);
    const d = glide(t) * total;
    const pos = pointAt(path, cum, d);

    // Road direction from a short window around the rider — stable even
    // at the very start and end of the route
    const roadBearing = bearingBetween(
      pointAt(path, cum, Math.max(0, d - 20)),
      pointAt(path, cum, Math.min(d + 40, total))
    );

    riderBearing =
      riderBearing == null
        ? roadBearing
        : lerpAngle(riderBearing, roadBearing, smoothK(dt, 260));
    rider.setLngLat(pos).setRotation(riderBearing);

    while (cum[inkIdx] < d) inkIdx++;
    drawInk(map, path.slice(0, inkIdx).concat([pos]));

    heading = lerpAngle(heading, roadBearing, smoothK(dt, 1000));

    const groundTarget = groundAt(pos);
    elevSmooth =
      elevSmooth == null
        ? groundTarget
        : elevSmooth + (groundTarget - elevSmooth) * smoothK(dt, 1200);

    // Aim at a point ON the road ahead (not a straight-ray projection),
    // so the camera looks into corners the way a driver does; past the
    // destination, carry on along the arrival direction to keep the
    // camera geometry constant right up to the stop
    const aimD = d + camLookahead;
    const aim =
      aimD <= total
        ? pointAt(path, cum, aimD)
        : destinationPoint(path[path.length - 1], endBearing, aimD - total);
    const camPos = destinationPoint(pos, heading + 180, camChase);
    const cam = map.calculateCameraOptionsFromTo(
      { lng: camPos[0], lat: camPos[1] },
      elevSmooth + camHover,
      { lng: aim[0], lat: aim[1] },
      elevSmooth
    );

    // Blend in from the fixed starting view over the first stretch so the
    // dive to road level is a swoop, not a jump cut. Past settle=1 the cam
    // values pass through untouched — heading is the only smoothing left.
    // Smoothstepped so the blend hands over without a kink.
    const s = Math.min(t / 0.14, 1);
    const settle = s * s * (3 - 2 * s);
    map.jumpTo({
      center: [
        startCenter.lng + (cam.center.lng - startCenter.lng) * settle,
        startCenter.lat + (cam.center.lat - startCenter.lat) * settle,
      ],
      zoom: startZoom + (cam.zoom - startZoom) * settle,
      pitch: startPitch + (cam.pitch - startPitch) * settle,
      bearing: lerpAngle(startBearing, cam.bearing, settle),
    });

    if (t < 1) {
      raf = requestAnimationFrame(frame);
    } else if (!cancelled) {
      commitLeg(path);
      drawInk(map, []);
      map.easeTo({
        center: end,
        zoom: arrivalZoom,
        pitch: arrivalPitch,
        bearing: map.getBearing(),
        duration: 1100,
        essential: true,
      });
      map.once('moveend', () => finish(false));
    }
  };

  raf = requestAnimationFrame(frame);
  return cancel;
}
