export default function Diamonds({ rating, max = 5 }) {
  return (
    <span
      className="tracking-widest text-gold"
      title={`${rating} of ${max} diamonds`}
      aria-label={`${rating} of ${max} diamonds`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < rating ? '' : 'opacity-25'}>
          ◆
        </span>
      ))}
    </span>
  );
}
