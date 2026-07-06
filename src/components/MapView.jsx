import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { STYLE_URL, OVERVIEW, applyParchment, addTerrain } from '../lib/mapStyle';
import { runFlyThrough } from '../lib/flyThrough';
import { fetchRoute, haversine } from '../lib/routing';
import { driveAlong } from '../lib/driveAlong';

const TRAIL_SOURCE = 'trail-line';

export default function MapView({
  spots,
  selectedId,
  onSelect,
  trail, // active trail with stops resolved to restaurant objects, or null
  touring, // true while the fly-through is running
  onTourEnd,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const driveRef = useRef(null); // cancel fn for an in-flight selection drive
  const driveToken = useRef(0); // invalidates stale async route fetches
  const [ready, setReady] = useState(false);

  const stopDrive = () => {
    driveToken.current++;
    if (driveRef.current) {
      driveRef.current();
      driveRef.current = null;
    }
  };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      ...OVERVIEW,
      attributionControl: { compact: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );
    map.on('load', () => {
      applyParchment(map);
      addTerrain(map);
      setReady(true);
    });
    mapRef.current = map;
    if (import.meta.env.DEV) window.__blMap = map;
    return () => {
      stopDrive();
      setReady(false);
      map.remove();
    };
  }, []);

  // Diamond pins for the (filtered) spots
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    for (const spot of spots) {
      const el = document.createElement('div');
      el.className = 'pin';
      el.title = spot.name;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(spot.id);
      });
      markersRef.current[spot.id] = new maplibregl.Marker({ element: el })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map);
    }
  }, [spots, ready, onSelect]);

  // Selecting a pin: when it reads as "moving between spots" (already zoomed
  // into the city, destination within riding distance), drive the actual
  // streets there. Otherwise ease/fly like a normal map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [id, marker] of Object.entries(markersRef.current)) {
      marker.getElement().classList.toggle('selected', id === selectedId);
    }
    if (!selectedId || touring) return;
    const marker = markersRef.current[selectedId];
    if (!marker) return;

    stopDrive();
    const token = driveToken.current;
    const to = marker.getLngLat();
    const from = map.getCenter();
    const crowFlies = haversine([from.lng, from.lat], [to.lng, to.lat]);

    const flyFallback = () =>
      map.flyTo({
        center: to,
        zoom: Math.max(map.getZoom(), 14.5),
        pitch: 55,
        speed: 0.9,
        curve: 1.5,
        essential: true,
      });

    if (crowFlies < 300) {
      map.easeTo({
        center: to,
        zoom: Math.max(map.getZoom(), 15),
        duration: 800,
      });
      return;
    }
    if (crowFlies > 9000 || map.getZoom() < 12.8) {
      flyFallback();
      return;
    }

    (async () => {
      try {
        const { coords } = await fetchRoute(from, to);
        if (token !== driveToken.current) return; // superseded meanwhile
        const interrupt = () => stopDrive();
        driveRef.current = driveAlong(map, coords, {
          onEnd: () => {
            driveRef.current = null;
            map.off('dragstart', interrupt);
            map.off('wheel', interrupt);
          },
        });
        map.on('dragstart', interrupt);
        map.on('wheel', interrupt);
      } catch {
        if (token === driveToken.current) flyFallback();
      }
    })();
  }, [selectedId, ready, touring]);

  // Trail line: drawn straight immediately, then upgraded to the real
  // street route once OSRM responds (which also warms the tour's cache)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const setLine = (coordinates) => {
      const geojson = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
      };
      if (map.getSource(TRAIL_SOURCE)) {
        map.getSource(TRAIL_SOURCE).setData(geojson);
      } else {
        map.addSource(TRAIL_SOURCE, { type: 'geojson', data: geojson });
        map.addLayer({
          id: TRAIL_SOURCE,
          type: 'line',
          source: TRAIL_SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#8b2635',
            'line-width': 2.5,
            'line-dasharray': [0.8, 2],
          },
        });
      }
    };

    if (trail) {
      let disposed = false;
      setLine(trail.stops.map((s) => [s.lng, s.lat]));
      (async () => {
        try {
          const legs = [];
          for (let i = 1; i < trail.stops.length; i++) {
            legs.push(await fetchRoute(trail.stops[i - 1], trail.stops[i]));
          }
          if (!disposed && map.getSource(TRAIL_SOURCE)) {
            setLine(
              legs.flatMap((leg, i) =>
                i ? leg.coords.slice(1) : leg.coords
              )
            );
          }
        } catch {
          // keep the straight-line sketch
        }
      })();
      return () => {
        disposed = true;
      };
    }
    if (map.getLayer(TRAIL_SOURCE)) {
      map.removeLayer(TRAIL_SOURCE);
      map.removeSource(TRAIL_SOURCE);
    }
  }, [trail, ready]);

  // The fly-through itself; user grabbing the map cancels it
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !touring || !trail) return;
    stopDrive(); // a selection drive must not fight the tour
    const cancel = runFlyThrough(map, trail.stops, {
      onArrive: (stop) => onSelect(stop.id),
      onEnd: onTourEnd,
    });
    map.on('dragstart', cancel);
    map.on('wheel', cancel);
    return () => {
      map.off('dragstart', cancel);
      map.off('wheel', cancel);
      cancel();
    };
  }, [touring, trail, ready, onSelect, onTourEnd]);

  // Inline style: maplibre's stylesheet sets .maplibregl-map { position: relative }
  // which loads after Tailwind and would override the `absolute` utility.
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
