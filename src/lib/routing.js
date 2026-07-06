// Street routing via the free OSRM demo server, with an in-memory cache.
// Coordinates are [lng, lat] pairs throughout, matching GeoJSON/MapLibre.

const cache = new Map();

export async function fetchRoute(from, to) {
  const key = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  if (!cache.has(key)) {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;
    const promise = fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const route = d.routes && d.routes[0];
        if (!route) throw new Error('no route found');
        return { coords: route.geometry.coordinates, distance: route.distance };
      })
      .catch((err) => {
        cache.delete(key); // don't cache failures
        throw err;
      });
    cache.set(key, promise);
  }
  return cache.get(key);
}

const R = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearingBetween(a, b) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

// Point reached from `start` heading `bearingDeg` for `dist` metres
export function destinationPoint(start, bearingDeg, dist) {
  const δ = dist / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(start[1]);
  const λ1 = toRad(start[0]);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return [(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI];
}

// Cumulative distance at each vertex of a line
export function measureLine(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  }
  return cum;
}

// Point at a given distance along the line
export function pointAt(coords, cum, dist) {
  if (dist <= 0) return coords[0];
  const total = cum[cum.length - 1];
  if (dist >= total) return coords[coords.length - 1];
  let i = 1;
  while (cum[i] < dist) i++;
  const t = (dist - cum[i - 1]) / (cum[i] - cum[i - 1]);
  const a = coords[i - 1];
  const b = coords[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
