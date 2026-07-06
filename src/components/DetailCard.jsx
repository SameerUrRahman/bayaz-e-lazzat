import Diamonds from './Diamonds';

export default function DetailCard({ spot, trailNote, onClose }) {
  if (!spot) return null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    spot.mapsQuery
  )}`;
  return (
    <aside className="parchment-card absolute bottom-8 left-4 z-10 w-80 max-w-[calc(100vw-2rem)] rounded-sm px-5 py-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-1.5 right-2.5 font-old text-lg text-ink-soft hover:text-lacquer"
      >
        ✕
      </button>
      <div className="font-nastaliq text-base leading-loose text-lacquer">
        {spot.urdu}
      </div>
      <h2 className="font-fell text-xl leading-tight">{spot.name}</h2>
      <div className="mt-0.5 font-old text-sm uppercase tracking-widest text-ink-soft">
        {spot.area} · {spot.cuisine}
      </div>
      <div className="mt-1.5">
        <Diamonds rating={spot.rating} />
      </div>
      <p className="mt-2 font-old text-base italic leading-snug">
        &ldquo;{spot.review}&rdquo;
      </p>
      {trailNote && (
        <p className="mt-2 border-t border-ink/20 pt-2 font-old text-sm text-deccan">
          <span className="font-fell text-xs uppercase tracking-widest">
            On the trail:
          </span>{' '}
          {trailNote}
        </p>
      )}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block font-old text-sm text-lacquer underline underline-offset-2 hover:text-deccan"
      >
        Open in Google Maps →
      </a>
    </aside>
  );
}
