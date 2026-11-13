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

/** The tall mirror beside the mannequin, showing the back view (read-only). */
export function Mirror({
  gender,
  label,
  layers = [],
  note,
}: {
  gender: MannequinGender
  label: string
  layers?: WornLayer[]
  note?: string
}) {
  return (
    <figure className="flex flex-col items-center">
      <div className="mirror-frame w-full rounded-[999px_999px_14px_14px] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)]">
        <div className="mirror-glass relative flex aspect-[1/3.1] items-end justify-center overflow-hidden rounded-[999px_999px_12px_12px]">
          <DressedMannequin gender={gender} view="back" layers={layers} className="relative z-0 h-[94%] opacity-85" />
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,rgba(255,255,255,0.14)_0%,transparent_30%,transparent_60%,rgba(255,255,255,0.07)_68%,transparent_76%)]" />
          {note && (
            <span className="absolute bottom-[3%] z-20 mx-1 rounded-full bg-black/60 px-2 py-1 text-center text-[0.62rem] leading-tight text-ivory">
              {note}
            </span>
          )}
        </div>
      </div>
      <figcaption className="mt-2 text-[0.8rem] text-ink-3">{label}</figcaption>
    </figure>
  )
}

export interface WornLayer {
  key: string
  url: string
  rect: { x: number; y: number; w: number; h: number }
  /** Mirror the picture (used for "approximate back" from a front photo). */
  flip?: boolean
  faded?: boolean
}

/**
 * The mannequin wearing fitted pieces. Each fitted picture is positioned on the mannequin picture
 * with fractions, so everything lines up at any screen size.
 */
export function DressedMannequin({
  gender,
  view = 'front',
  layers,
  className = '',
  animate = false,
}: {
  gender: MannequinGender
  view?: 'front' | 'back'
  layers: WornLayer[]
  className?: string
  animate?: boolean
}) {
  return (
    <div className={`relative ${animate ? 'rise-in' : ''} ${className}`} style={{ aspectRatio: `${MANNEQUIN_RATIO}` }}>
      <img src={mannequinSrc(gender, view)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
      {layers.map((l) => {
        const x = l.flip ? 1 - l.rect.x - l.rect.w : l.rect.x
        return (
          <img
            key={l.key}
            src={l.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{
              left: `${x * 100}%`,
              top: `${l.rect.y * 100}%`,
              width: `${l.rect.w * 100}%`,
              height: `${l.rect.h * 100}%`,
              transform: l.flip ? 'scaleX(-1)' : undefined,
              opacity: l.faded ? 0.55 : 1,
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.38))',
            }}
          />
        )
      })}
    </div>
  )
}
