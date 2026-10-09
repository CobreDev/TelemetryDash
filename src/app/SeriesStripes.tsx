/** Stacked full-width color bands from the series profile. Decorative only. */
export function SeriesStripes({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column' }} aria-hidden>
      {colors.map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </div>
  );
}
