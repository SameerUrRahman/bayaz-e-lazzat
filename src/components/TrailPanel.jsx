export default function TrailPanel({
  trail,
  open,
  onToggle,
  touring,
  onStart,
  onStop,
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="parchment-card absolute right-4 bottom-8 z-10 rounded-sm px-4 py-2 font-fell text-sm tracking-wide hover:text-lacquer"
      >
        ✦ Food Trails
      </button>
    );
  }

  return (
    <aside className="parchment-card absolute right-4 bottom-8 z-10 w-72 max-w-[calc(100vw-2rem)] rounded-sm px-5 py-4">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Close trails"
        className="absolute top-1.5 right-2.5 font-old text-lg text-ink-soft hover:text-lacquer"
      >
        ✕
      </button>
      <div className="font-fell text-xs uppercase tracking-widest text-ink-soft">
        Food Trail
      </div>
      <h2 className="font-fell text-lg leading-tight">{trail.name}</h2>
      <p className="mt-1 font-old text-sm italic leading-snug text-ink-soft">
        {trail.description}
      </p>
      <ol className="mt-2 space-y-1">
        {trail.stops.map((stop, i) => (
          <li key={stop.id} className="flex gap-2 font-old text-sm leading-snug">
            <span className="font-fell text-gold">{i + 1}.</span>
            <span>{stop.name}</span>
          </li>
        ))}
      </ol>
      {touring ? (
        <button
          type="button"
          onClick={onStop}
          className="mt-3 w-full rounded-sm border border-lacquer bg-paper-light px-3 py-1.5 font-fell text-sm tracking-wide text-lacquer hover:bg-paper-dark"
        >
          ◼ Halt the ride
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          className="mt-3 w-full rounded-sm border border-lacquer bg-lacquer px-3 py-1.5 font-fell text-sm tracking-wide text-paper-light hover:bg-deccan hover:border-deccan"
        >
          ✦ Begin the ride
        </button>
      )}
    </aside>
  );
}
