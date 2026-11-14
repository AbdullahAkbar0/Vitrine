import type { ReactNode } from 'react'

// Small drawings for empty screens, in the app's colours. They adapt to light and dark mode.

const ink = 'var(--c-ink)'

/** A clothes rail with a few hangers: two pieces, one empty hanger, and a dashed spot waiting for yours. */
export function ClosetRail({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 210" className={className} aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="170" cy="200" rx="150" ry="7" fill="var(--c-surface-2)" />
      {/* rail */}
      <path d="M22 196V30M318 196V30" stroke={ink} strokeWidth="5" />
      <path d="M14 30h312" stroke={ink} strokeWidth="6" />
      <path d="M12 196h22M306 196h22" stroke={ink} strokeWidth="5" />
      {/* hanger + tee */}
      <g>
        <path d="M80 30v6a6 6 0 1 1-6-6" stroke={ink} strokeWidth="3" />
        <path d="M80 44 52 60h56L80 44Z" stroke={ink} strokeWidth="3" />
        <path d="M60 60h40l18 12-8 14-8-5v58H58V81l-8 5-8-14 18-12Z" fill="var(--t-tops)" stroke={ink} strokeWidth="3" />
        <path d="M71 60c2 6 16 6 18 0" stroke={ink} strokeWidth="3" />
      </g>
      {/* hanger + dress */}
      <g>
        <path d="M150 30v6a6 6 0 1 1-6-6" stroke={ink} strokeWidth="3" />
        <path d="M150 44 124 60h52L150 44Z" stroke={ink} strokeWidth="3" />
        <path d="M137 60h26l3 22 22 86h-76l22-86 3-22Z" fill="var(--t-fullbody)" stroke={ink} strokeWidth="3" />
        <path d="M134 98h32" stroke={ink} strokeWidth="3" />
      </g>
      {/* empty hanger */}
      <g>
        <path d="M212 30v6a6 6 0 1 1-6-6" stroke={ink} strokeWidth="3" />
        <path d="M212 44 186 60h52L212 44Z" stroke={ink} strokeWidth="3" />
      </g>
      {/* waiting for your piece */}
      <g>
        <path d="M274 30v6a6 6 0 1 1-6-6" stroke={ink} strokeWidth="3" />
        <path d="M274 44 248 60h52L274 44Z" stroke={ink} strokeWidth="3" />
        <path d="M252 60h44l14 10v84h-72V70l14-10Z" fill="var(--c-surface)" stroke="var(--c-primary)" strokeWidth="2.5" strokeDasharray="6 6" />
        <circle cx="274" cy="108" r="13" fill="var(--c-primary)" />
        <path d="M274 101v14M267 108h14" stroke="var(--c-on-primary)" strokeWidth="3" />
      </g>
      {/* swing tag */}
      <path d="M100 66l14 10" stroke={ink} strokeWidth="1.5" />
      <rect x="108" y="74" width="16" height="22" rx="3" transform="rotate(-18 116 85)" fill="var(--c-accent)" />
    </svg>
  )
}

/** Three outfit cards fanned out. */
export function OutfitStack({ className = '' }: { className?: string }) {
  const card = (rot: number, x: number, fill: string, children: ReactNode) => (
    <g transform={`rotate(${rot} ${x + 55} 170)`}>
      <rect x={x} y="20" width="110" height="150" rx="16" fill="var(--c-surface)" stroke={ink} strokeWidth="3" />
      <rect x={x + 10} y="30" width="90" height="102" rx="10" fill={fill} />
      {children}
      <rect x={x + 10} y="142" width="54" height="8" rx="4" fill="var(--c-surface-2)" />
      <rect x={x + 10} y="155" width="34" height="6" rx="3" fill="var(--c-surface-2)" />
    </g>
  )
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      {card(-12, 30, 'var(--t-bottoms)', (
        <>
          <path d="M70 44h30l10 7-5 9-5-3v24H70V57l-5 3-5-9 10-7Z" fill="var(--t-tops)" stroke={ink} strokeWidth="2.5" />
          <path d="M72 82h26l2 40h-11l-4-28-4 28H70l2-40Z" fill="var(--c-surface)" stroke={ink} strokeWidth="2.5" />
        </>
      ))}
      {card(10, 180, 'var(--t-outerwear)', (
        <path d="M222 44h26l14 8v68h-14V70m-26-26-14 8v68h14V70m0-26 13 16 13-16" fill="var(--t-accessories)" stroke={ink} strokeWidth="2.5" />
      ))}
      {card(0, 105, 'var(--t-fullbody)', (
        <>
          <path d="M150 42h20l2 16 18 66h-60l18-66 2-16Z" fill="var(--c-surface)" stroke={ink} strokeWidth="2.5" />
          <path d="M146 72h28" stroke={ink} strokeWidth="2.5" />
        </>
      ))}
      <circle cx="262" cy="30" r="16" fill="var(--c-accent)" />
      <path d="m255 30 5 5 9-10" stroke="#fff" strokeWidth="3" />
    </svg>
  )
}
