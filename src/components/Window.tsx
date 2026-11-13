import type { ReactNode } from 'react'
import type { MannequinGender } from '../db/db'

/** Mannequin pictures live in /public/mannequins. Replace the files to upgrade them; no code changes needed. */
export const mannequinSrc = (gender: MannequinGender, view: 'front' | 'back') => `./mannequins/${gender}-${view}.png`

/** Width ÷ height of every mannequin picture. Keep new pictures in this shape. */
export const MANNEQUIN_RATIO = 680 / 1603

/**
 * A lit boutique window: velvet backdrop, spotlight, brass arch, and the mannequin on its stand.
 * Always dark, whatever the phone theme — like a shop window at night.
 */
export function ShopWindow({
  children,
  className = '',
  animate = true,
}: {
  children: ReactNode
  className?: string
  animate?: boolean
}) {
  return (
    <div className={`relative isolate ${className}`}>
      {/* brass arch frame */}
      <div className="window-arch absolute inset-0 bg-[linear-gradient(160deg,#f3e0b5,#c9a56c_30%,#7c5b2c_60%,#d9b984)] p-[2px]">
        <div className="window-arch velvet relative h-full w-full overflow-hidden">
          <div className="velvet-folds absolute inset-0" />
          <div className={`spotlight absolute inset-0 ${animate ? 'lights-on' : ''}`} />
          <div className="floor-glow absolute inset-x-[12%] bottom-[2%] h-[9%]" />
          {children}
        </div>
      </div>
    </div>
  )
}

export function Mannequin({
  gender,
  view = 'front',
  className = '',
  animate = true,
}: {
  gender: MannequinGender
  view?: 'front' | 'back'
  className?: string
  animate?: boolean
}) {
  return (
    <img
      src={mannequinSrc(gender, view)}
      alt=""
      draggable={false}
      className={`pointer-events-none select-none ${animate ? 'rise-in' : ''} ${className}`}
      style={{ aspectRatio: `${MANNEQUIN_RATIO}` }}
    />
  )
}

/** The tall mirror beside the mannequin, showing the back view. */
export function Mirror({ gender, label }: { gender: MannequinGender; label: string }) {
  return (
    <figure className="flex flex-col items-center">
      <div className="mirror-frame w-full rounded-[999px_999px_14px_14px] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)]">
        <div className="mirror-glass relative flex aspect-[1/3.1] items-end justify-center overflow-hidden rounded-[999px_999px_12px_12px]">
          <Mannequin gender={gender} view="back" className="relative z-0 h-[94%] w-auto opacity-80" animate={false} />
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,rgba(255,255,255,0.14)_0%,transparent_30%,transparent_60%,rgba(255,255,255,0.07)_68%,transparent_76%)]" />
        </div>
      </div>
      <figcaption className="mt-2 text-[0.8rem] text-ink-3">{label}</figcaption>
    </figure>
  )
}
