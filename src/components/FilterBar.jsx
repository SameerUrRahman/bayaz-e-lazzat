function ChipRow({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 font-fell text-xs uppercase tracking-widest text-ink-soft">
        {label}
      </span>
      {['All', ...options].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full border px-3 py-0.5 font-old text-sm transition-colors ${
            value === opt
              ? 'border-lacquer bg-lacquer text-paper-light'
              : 'border-ink/40 bg-paper-light/80 text-ink hover:border-lacquer'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function FilterBar({
  cuisines,
  areas,
  cuisine,
  area,
  onCuisine,
  onArea,
  shown,
  total,
}) {
  return (
    <div className="pointer-events-none absolute top-28 left-1/2 z-10 w-full max-w-3xl -translate-x-1/2 px-4">
      <div className="parchment-card pointer-events-auto flex flex-col gap-1.5 rounded-sm px-4 py-2.5">
        <ChipRow label="Fare" options={cuisines} value={cuisine} onChange={onCuisine} />
        <ChipRow label="Quarter" options={areas} value={area} onChange={onArea} />
        <div className="text-center font-old text-xs italic text-ink-soft">
          {shown} of {total} entries on the page
        </div>
      </div>
    </div>
  );
}
