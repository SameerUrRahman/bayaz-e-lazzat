export default function Header() {
  return (
    <header className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 text-center">
      <div className="parchment-card pointer-events-auto rounded-sm px-6 py-2">
        <div className="font-nastaliq text-lg leading-tight text-lacquer">
          بیاضِ لذّت
        </div>
        <h1 className="font-fell text-2xl leading-tight tracking-wide">
          Bayaz-e-Lazzat
        </h1>
        <p className="font-old text-sm italic text-ink-soft">
          an anthology of Hyderabad&rsquo;s delights
        </p>
      </div>
    </header>
  );
}
