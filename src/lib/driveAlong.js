import { measureLine, pointAt, bearingBetween, haversine } from './routing';

const easeInOutQuad = (t) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/**
 * Street-level camera ride along a route: the camera travels the line at
 * ~street height with the bearing steering into the road ahead, zooming
 * out slightly mid-leg and settling back in at the destination.
 *
 * Returns a cancel function; onEnd(cancelled) fires exactly once.
 */
export function driveAlong(map, coords, opts = {}) {
  const {
    cruiseZoom = 15.4,
    stopZoom = 16.1,
    pitch = 60,
    speed = 0.72, // metres per millisecond
    minDuration = 3500,
    maxDuration = 11000,
    lookahead = 130, // metres ahead used to steer the bearing
    onEnd = () => {},
  } = opts;

  const cum = measureLine(coords);
  const total = cum[cum.length - 1];
  if (total < 40) {
    map.easeTo({ center: coords[coords.length - 1], duration: 600 });
    onEnd(false);
    return () => {};
  }

  const duration = Math.min(maxDuration, Math.max(minDuration, total / speed));
  const startPitch = map.getPitch();
  const startZoom = map.getZoom();
  let heading = map.getBearing();
  let raf = null;
  let startTime;
  let cancelled = false;
  let ended = false;

  const finish = (was) => {
    if (!ended) {
      ended = true;
      onEnd(was);
    }
  };

  const frame = (now) => {
    if (cancelled) return;
    if (startTime === undefined) startTime = now;
    const t = Math.min((now - startTime) / duration, 1);
    const d = easeInOutQuad(t) * total;
    const pos = pointAt(coords, cum, d);
    const ahead = pointAt(coords, cum, Math.min(d + lookahead, total));

    // Steer smoothly toward the road ahead (damped, wraparound-safe)
    if (haversine(pos, ahead) > 5) {
      const target = bearingBetween(pos, ahead);
      const delta = ((((target - heading) % 360) + 540) % 360) - 180;
      heading += delta * 0.08;
    }

    // Blend pitch/zoom in over the first stretch so the dive-in isn't a jump cut
    const settle = Math.min(t / 0.12, 1);
    // Zoom breathes: tight at either end, looser mid-cruise
    const edge = Math.min(1, Math.min(d, total - d) / 500);
    const targetZoom = stopZoom + (cruiseZoom - stopZoom) * edge;

    map.jumpTo({
      center: pos,
      bearing: heading,
      pitch: startPitch + (pitch - startPitch) * settle,
      zoom: startZoom + (targetZoom - startZoom) * settle,
    });

    if (t < 1) raf = requestAnimationFrame(frame);
    else finish(false);
  };

  raf = requestAnimationFrame(frame);

  return () => {
    if (!cancelled) {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      finish(true);
    }
  };
}
