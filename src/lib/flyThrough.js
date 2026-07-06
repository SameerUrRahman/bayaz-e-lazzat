import { OVERVIEW } from './mapStyle';

const once = (map, event) =>
  new Promise((resolve) => map.once(event, resolve));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cinematic tour: overview shot, then swoop into each stop in order,
 * lingering long enough to read the card, then pull back out.
 *
 * Returns a cancel function. Cancelling stops the camera mid-flight;
 * onEnd fires exactly once whether the tour finishes or is cancelled.
 */
export function runFlyThrough(map, stops, { onArrive, onEnd }) {
  let cancelled = false;
  let ended = false;

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
    finish();
  };

  (async () => {
    map.flyTo({ ...OVERVIEW, zoom: 12.4, duration: 2500, essential: true });
    await once(map, 'moveend');
    if (cancelled) return;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      map.flyTo({
        center: [stop.lng, stop.lat],
        zoom: 16.1,
        pitch: 58,
        bearing: -30 + i * 40,
        speed: 0.85,
        curve: 1.5,
        essential: true,
      });
      await once(map, 'moveend');
      if (cancelled) return;
      onArrive(stop, i);
      await sleep(3200);
      if (cancelled) return;
    }

    map.flyTo({ ...OVERVIEW, duration: 3000, essential: true });
    await once(map, 'moveend');
    finish();
  })();

  return cancel;
}
