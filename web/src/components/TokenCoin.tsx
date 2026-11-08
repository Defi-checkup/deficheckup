/** Fit the complete symbol in the coin; a plus explicitly marks longer symbols as abbreviated. */
export default function TokenCoin({ symbol = 'POS', index }: { symbol?: string; index: number }) {
  const label = symbol.length > 5 ? `${symbol.slice(0, 3)}+` : symbol;
  return (
    <span className={`coin coin-${index % 4}`} role="img" aria-label={symbol}>
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <text
          x="20"
          y="20"
          textAnchor="middle"
          dominantBaseline="central"
          textLength={label.length > 3 ? 32 : undefined}
          lengthAdjust="spacingAndGlyphs"
        >
          {label}
        </text>
      </svg>
    </span>
  );
}
