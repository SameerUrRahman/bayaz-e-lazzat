import { OVERVIEW } from './mapStyle';
import { fetchRoute } from './routing';
import { driveAlong } from './driveAlong';

const once = (map, event) => new Promise((resolve) => map.once(event, resolve));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cinematic tour: swoop down to the first stop, then DRIVE the streets
 * between stops (real OSRM road routes; falls back to a flyTo hop if
 * routing fails), lingering at each stop, then pull back out.
 *
 * Returns a cancel function. onEnd fires exactly once whether the tour
 * finishes or is cancelled.
 */
export function runFlyThrough(map, stops, { onArrive, onEnd }) {
  let cancelled = false;
  let ended = false;
  let cancelDrive = null;

  const finish = () => {
    if (!ended) {
      ended = true;
      onEnd();
    }
  };

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    map.stop();
    if (cancelDrive) cancelDrive();
    finish();
  };

  const prefetchLeg = (i) => {
    if (i + 1 < stops.length) {
      fetchRoute(stops[i], stops[i + 1]).catch(() => {});
    }
  };

  (async () => {
    // Aerial approach to the first stop
    prefetchLeg(0);
    const first = stops[0];
    map.flyTo({
      center: [first.lng, first.lat],
      zoom: 16.1,
      pitch: 60,
      speed: 0.9,
      curve: 1.5,
      essential: true,
    });
    await once(map, 'moveend');
    if (cancelled) return;
    onArrive(first, 0);
    await sleep(3000);
    if (cancelled) return;

    for (let i = 1; i < stops.length; i++) {
      const stop = stops[i];
      prefetchLeg(i);
      let route = null;
      try {
        route = await fetchRoute(stops[i - 1], stop);
      } catch {
        // fall through to flyTo
      }
      if (cancelled) return;

      if (route && route.coords.length > 1) {
        await new Promise((resolve) => {
          cancelDrive = driveAlong(map, route.coords, { onEnd: resolve });
        });
        cancelDrive = null;
      } else {
        map.flyTo({
          center: [stop.lng, stop.lat],
          zoom: 16.1,
          pitch: 60,
          speed: 0.85,
          curve: 1.5,
          essential: true,
        });
        await once(map, 'moveend');
      }
      if (cancelled) return;
      onArrive(stop, i);
      await sleep(3000);
      if (cancelled) return;
    }

    map.flyTo({ ...OVERVIEW, duration: 3000, essential: true });
    await once(map, 'moveend');
    finish();
  })();

  return cancel;
}
