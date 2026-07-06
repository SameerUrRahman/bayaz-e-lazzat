import { useCallback, useMemo, useState } from 'react';
import restaurants from './data/restaurants.json';
import trails from './data/trails.json';
import { MAPTILER_KEY } from './lib/mapStyle';
import MapView from './components/MapView';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import DetailCard from './components/DetailCard';
import TrailPanel from './components/TrailPanel';

const byId = Object.fromEntries(restaurants.map((r) => [r.id, r]));

// Resolve trail stop ids to full restaurant records, keeping the stop note
const resolvedTrails = trails.map((t) => ({
  ...t,
  stops: t.stops.map((s) => ({ ...byId[s.restaurantId], trailNote: s.note })),
}));

const cuisines = [...new Set(restaurants.map((r) => r.cuisine))];
const areas = [...new Set(restaurants.map((r) => r.area))];

export default function App() {
  const [cuisine, setCuisine] = useState('All');
  const [area, setArea] = useState('All');
  const [selectedId, setSelectedId] = useState(null);
  const [trailOpen, setTrailOpen] = useState(false);
  const [touring, setTouring] = useState(false);

  const trail = resolvedTrails[0];

  const filtered = useMemo(
    () =>
      restaurants.filter(
        (r) =>
          (cuisine === 'All' || r.cuisine === cuisine) &&
          (area === 'All' || r.area === area)
      ),
    [cuisine, area]
  );

  // While the trail panel is open, show all trail pins even if filters would hide them
  const spots = useMemo(() => {
    if (!trailOpen) return filtered;
    const ids = new Set(filtered.map((r) => r.id));
    return [...filtered, ...trail.stops.filter((s) => !ids.has(s.id))];
  }, [filtered, trailOpen, trail]);

  const selected = selectedId ? byId[selectedId] : null;
  const selectedTrailNote =
    trailOpen && selected
      ? trail.stops.find((s) => s.id === selected.id)?.trailNote
      : null;

  const handleTourEnd = useCallback(() => setTouring(false), []);

  return (
    <div className="relative h-full overflow-hidden">
      <MapView
        spots={spots}
        selectedId={selectedId}
        onSelect={setSelectedId}
        trail={trailOpen ? trail : null}
        touring={touring}
        onTourEnd={handleTourEnd}
      />
      <Header />
      <FilterBar
        cuisines={cuisines}
        areas={areas}
        cuisine={cuisine}
        area={area}
        onCuisine={setCuisine}
        onArea={setArea}
        shown={filtered.length}
        total={restaurants.length}
      />
      <DetailCard
        spot={selected}
        trailNote={selectedTrailNote}
        onClose={() => setSelectedId(null)}
      />
      <TrailPanel
        trail={trail}
        open={trailOpen}
        onToggle={() => {
          setTrailOpen((o) => !o);
          if (trailOpen) setTouring(false);
        }}
        touring={touring}
        onStart={() => setTouring(true)}
        onStop={() => setTouring(false)}
      />
      {!MAPTILER_KEY && (
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-sm border border-ink/30 bg-paper-light/90 px-3 py-1 font-old text-xs text-ink-soft">
          Fallback tiles — add a free MapTiler key in <code>.env</code> to
          unlock terrain (see README)
        </div>
      )}
    </div>
  );
}
