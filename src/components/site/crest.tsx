/**
 * Crest — inline SVG, zero network requests (§11.1).
 * Shield + open book + rising peaks per §5.1.
 */

const GOLD = "var(--gold)";
const GOLD_LIGHT = "var(--gold-strong)";
const GREEN_DEEP = "var(--primary-strong)";
const GREEN_MID = "var(--primary)";

export function Crest({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="GHSS Ghallanai crest">
      <defs>
        <linearGradient id="crestShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GREEN_MID} />
          <stop offset="1" stopColor={GREEN_DEEP} />
        </linearGradient>
      </defs>
      <path
        d="M256 64 L416 104 L416 240 C 416 330 352 400 256 448 C 160 400 96 330 96 240 L96 104 Z"
        fill="url(#crestShield)"
        stroke={GOLD}
        strokeWidth="12"
      />
      <path
        d="M256 322 C 226 300 190 296 158 300 L158 352 C 190 348 226 352 256 372 C 286 352 322 348 354 352 L354 300 C 322 296 286 300 256 322 Z"
        fill={GOLD}
      />
      <rect x="252" y="318" width="8" height="56" rx="3" fill={GREEN_DEEP} />
      <path d="M196 306 L196 352" stroke={GREEN_DEEP} strokeWidth="4" opacity="0.5" />
      <path d="M316 306 L316 352" stroke={GREEN_DEEP} strokeWidth="4" opacity="0.5" />
      <path d="M116 236 L170 158 L206 206 L232 168 L296 236 Z" fill={GREEN_MID} opacity="0.95" />
      <circle cx="256" cy="128" r="20" fill={GOLD_LIGHT} />
      <g stroke={GOLD_LIGHT} strokeWidth="8" strokeLinecap="round" opacity="0.9">
        <path d="M256 96 L256 82" />
        <path d="M222 106 L212 92" />
        <path d="M290 106 L300 92" />
      </g>
    </svg>
  );
}

export function CrestMark({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`}>
      <Crest className="h-full w-full" />
    </span>
  );
}
