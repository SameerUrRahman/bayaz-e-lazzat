export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || '';

// With a (free) MapTiler key we get their tiles + terrain DEM.
// Without one, fall back to OpenFreeMap's keyless tiles — no terrain, but the map still works.
export const STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/liberty';

// 3.4 made the Deccan roll enough that the chase cam visibly bobbed
export const TERRAIN_EXAGGERATION = 2.2;

export const OVERVIEW = {
  center: [78.4650, 17.3920],
  zoom: 11.6,
  pitch: 40,
  bearing: -8,
};

const PALETTE = {
  paper: '#f0e2c4',
  paperShade: '#e9d8b6',
  water: '#a9bfba',
  green: '#dcd4a8',
  building: '#e0cda4',
  buildingWall: '#d3b98c',
  roadMinor: '#c7ab84',
  roadMajor: '#a8845c',
  boundary: '#9c7a58',
  rail: '#b39a78',
  ink: '#453222',
};

// Repaint whatever base style loaded into a sepia "old manuscript" palette.
// Heuristic on layer type + source-layer/id so it works on both MapTiler and OpenFreeMap.
export function applyParchment(map) {
  const layers = map.getStyle().layers || [];
  for (const layer of layers) {
    const { id, type } = layer;
    const key = `${layer['source-layer'] || ''} ${id}`.toLowerCase();
    try {
      if (/poi|housenumber|airport|aeroway|transit|oneway/.test(key)) {
        map.setLayoutProperty(id, 'visibility', 'none');
        continue;
      }
      if (type === 'background') {
        map.setPaintProperty(id, 'background-color', PALETTE.paper);
      } else if (type === 'fill') {
        let color = PALETTE.paperShade;
        if (/water/.test(key)) color = PALETTE.water;
        else if (/landcover|park|grass|wood|forest|vegetation|cemetery|golf/.test(key)) color = PALETTE.green;
        else if (/building/.test(key)) color = PALETTE.building;
        else if (/sand|beach|glacier|snow/.test(key)) color = PALETTE.paper;
        map.setPaintProperty(id, 'fill-color', color);
        map.setPaintProperty(id, 'fill-outline-color', color);
      } else if (type === 'fill-extrusion') {
        // MapTiler ships this at 0.4 opacity in near-ground color — the
        // buildings render but read flat. Deepen + solidify so walls show.
        map.setPaintProperty(id, 'fill-extrusion-color', PALETTE.buildingWall);
        map.setPaintProperty(id, 'fill-extrusion-opacity', 0.85);
        map.setLayerZoomRange(id, 14, 24);
      } else if (type === 'line') {
        let color = PALETTE.roadMinor;
        if (/water/.test(key)) color = PALETTE.water;
        else if (/motorway|trunk|primary|highway|major/.test(key)) color = PALETTE.roadMajor;
        else if (/boundary|admin/.test(key)) color = PALETTE.boundary;
        else if (/rail|ferry/.test(key)) color = PALETTE.rail;
        map.setPaintProperty(id, 'line-color', color);
      } else if (type === 'symbol') {
        map.setPaintProperty(id, 'text-color', PALETTE.ink);
        map.setPaintProperty(id, 'text-halo-color', PALETTE.paper);
        map.setPaintProperty(id, 'text-halo-width', 1.2);
        map.setPaintProperty(id, 'icon-opacity', 0.35);
      }
    } catch {
      // Individual layers may reject a property (e.g. data expressions) — skip them.
    }
  }
}

// Terrain + hillshade need MapTiler's DEM tiles, so this is key-gated.
export function addTerrain(map) {
  if (!MAPTILER_KEY) return;
  const demUrl = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

  map.addSource('terrain-dem', { type: 'raster-dem', url: demUrl });
  map.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION });

  // Hillshade needs its own DEM source; slot it under the first label layer
  // so the relief shading sits beneath text like ink on aged paper.
  map.addSource('hillshade-dem', { type: 'raster-dem', url: demUrl });
  const firstSymbol = (map.getStyle().layers || []).find((l) => l.type === 'symbol');
  map.addLayer(
    {
      id: 'parchment-hillshade',
      type: 'hillshade',
      source: 'hillshade-dem',
      paint: {
        'hillshade-shadow-color': '#75583c',
        'hillshade-highlight-color': '#fffbe8',
        'hillshade-accent-color': '#b08d3e',
        'hillshade-exaggeration': 0.8,
      },
    },
    firstSymbol ? firstSymbol.id : undefined
  );
}
