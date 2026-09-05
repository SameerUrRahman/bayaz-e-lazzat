// Solid ink line tracing the journey actually traveled — the parchment-map
// answer to the red line crawling across the map in adventure films.
// One journey at a time: legs accumulate via commitLeg until resetInk.

const SRC = 'ink-trail';

// Coords already inked by completed legs of the current journey
let committed = [];

const asFeature = (coordinates) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
});

export function ensureInk(map) {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: asFeature([]) });
  map.addLayer({
    id: SRC,
    type: 'line',
    source: SRC,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#8b2635',
      'line-width': 3,
      'line-opacity': 0.85,
    },
  });
}

export function resetInk(map) {
  committed = [];
  const src = map.getSource(SRC);
  if (src) src.setData(asFeature([]));
}

// Redraw the journey: everything committed plus the leg in progress
export function drawInk(map, legCoords) {
  const src = map.getSource(SRC);
  if (src) src.setData(asFeature(committed.concat(legCoords)));
}

export function commitLeg(legCoords) {
  committed = committed.concat(legCoords);
}
