import {
  measureLine,
  pointAt,
  bearingBetween,
  destinationPoint,
} from './routing';

// Trapezoid distance profile: accelerate, cruise at constant speed, brake.
// Feels like riding; a whole-route ease feels like crawl-then-rush.
const trapezoid = (t, a = 0.15) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const norm = 1 - a;
  if (t < a) return (t * t) / (2 * a) / norm;
  if (t <= 1 - a) return (a / 2 + (t - a)) / norm;
  return (norm - (1 - t) ** 2 / (2 * a)) / norm;
};

const lerpAngle = (from, to, k) => {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + delta * k;
};

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

/**
 * Road-level chase-cam ride: the camera hovers just above the street,
 * follows the (smoothed) route looking down the road ahead, then eases
 * back up into the normal arrival framing at the destination.
 *
 * Built on calculateCameraOptionsFromTo (MapLibre's "stand here, look
 * there" primitive — it never ported Mapbox's FreeCamera API).
 *
 * Returns a cancel function; onEnd(cancelled) fires exactly once.
 */
export function driveAlong(map, coords, opts = {}) {
  const {
    hover = 140, // camera height above the road, metres
    lookahead = 300, // aim point down the road; with hover gives ~65° pitch
    arrivalPitch = 60,
    arrivalZoom = 16.1,
    speed = 0.11, // metres per millisecond at cruise (~110 m/s)
    minDuration = 4500,
    maxDuration = 16000,
    onEnd = () => {},
  } = opts;

  const rawCum = measureLine(coords);
  const rawTotal = rawCum[rawCum.length - 1];
  const end = coords[coords.length - 1];

  let raf = null;
  let cancelled = false;
  let ended = false;
  const finish = (was) => {
    if (!ended) {
      ended = true;
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

  const path = smoothPath(resample(coords, 20), 4);
  const cum = measureLine(path);
  const total = cum[cum.length - 1];
  const duration = Math.min(maxDuration, Math.max(minDuration, total / speed));

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

  const startCenter = map.getCenter();
  const startZoom = map.getZoom();
  const startPitch = map.getPitch();
  let heading = map.getBearing();
  let elevSmooth = null;
  let startTime;

  const frame = (now) => {
    if (cancelled) return;
    if (startTime === undefined) startTime = now;
    const t = Math.min((now - startTime) / duration, 1);
    const d = trapezoid(t) * total;
    const pos = pointAt(path, cum, d);

    // Road direction from a short window around the rider — stable even
    // at the very start and end of the route
    const roadBearing = bearingBetween(
      pointAt(path, cum, Math.max(0, d - 20)),
      pointAt(path, cum, Math.min(d + 40, total))
    );
    heading = lerpAngle(heading, roadBearing, 0.12);

    const groundTarget = groundAt(pos);
    elevSmooth =
      elevSmooth == null
        ? groundTarget
        : elevSmooth + (groundTarget - elevSmooth) * 0.06;

    // Aim a fixed distance down the road at ground height: constant,
    // jitter-free pitch all the way through
    const aim = destinationPoint(pos, heading, lookahead);
    const cam = map.calculateCameraOptionsFromTo(
      { lng: pos[0], lat: pos[1] },
      elevSmooth + hover,
      { lng: aim[0], lat: aim[1] },
      elevSmooth
    );

    // Blend in from wherever the camera was over the first stretch so the
    // dive to road level is a swoop, not a jump cut
    const settle = Math.min(t / 0.14, 1);
    map.jumpTo({
      center: [
        startCenter.lng + (cam.center.lng - startCenter.lng) * settle,
        startCenter.lat + (cam.center.lat - startCenter.lat) * settle,
      ],
      zoom: startZoom + (cam.zoom - startZoom) * settle,
      pitch: startPitch + (cam.pitch - startPitch) * settle,
      bearing: lerpAngle(map.getBearing(), cam.bearing, Math.max(settle, 0.25)),
    });

    if (t < 1) {
      raf = requestAnimationFrame(frame);
    } else if (!cancelled) {
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
