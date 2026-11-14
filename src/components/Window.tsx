import type { ReactNode } from 'react'
import type { MannequinGender } from '../db/db'

/** Mannequin pictures live in /public/mannequins. Replace the files to upgrade them; no code changes needed. */
export const mannequinSrc = (gender: MannequinGender, view: 'front' | 'back') => `./mannequins/${gender}-${view}.png`

/** Width ÷ height of every mannequin picture. Keep new pictures in this shape. */
export const MANNEQUIN_RATIO = 680 / 1603

/** The fitting-room backdrop used wherever the mannequin appears. */
export function Studio({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`studio relative isolate overflow-hidden rounded-[1.75rem] ${className}`}>
      <div className="studio-floor absolute inset-x-[10%] bottom-[1%] h-[8%]" />
      {children}
    </div>
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
    <div className={`relative ${animate ? 'pop-in' : ''} ${className}`} style={{ aspectRatio: `${MANNEQUIN_RATIO}` }}>
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
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
            }}
          />
        )
      })}
    </div>
  )
}

/** A full-height mannequin inside the studio backdrop. */
export function MannequinStage({
  gender,
  view = 'front',
  layers = [],
  className = '',
  animate = true,
  children,
}: {
  gender: MannequinGender
  view?: 'front' | 'back'
  layers?: WornLayer[]
  className?: string
  animate?: boolean
  children?: ReactNode
}) {
  return (
    <Studio className={className}>
      <DressedMannequin gender={gender} view={view} layers={layers} animate={animate} className="absolute bottom-[2%] left-1/2 h-[94%] -translate-x-1/2" />
      {children}
    </Studio>
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
      <div className="w-full rounded-[1.2rem] bg-[linear-gradient(160deg,#ffffff,#c9c8d8_40%,#8e8da6_70%,#e9e8f2)] p-[3px] shadow-[0_14px_30px_-16px_rgb(29_27_75/0.5)]">
        <div className="studio relative flex aspect-[1/3] items-end justify-center overflow-hidden rounded-[1rem]">
          <DressedMannequin gender={gender} view="back" layers={layers} className="relative z-0 h-[94%] opacity-90" />
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,rgba(255,255,255,0.28)_0%,transparent_30%,transparent_58%,rgba(255,255,255,0.12)_66%,transparent_74%)]" />
          {note && (
            <span className="absolute top-[4%] z-20 mx-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-center text-[0.58rem] leading-tight font-semibold text-bg">
              {note}
            </span>
          )}
        </div>
      </div>
      <figcaption className="mt-1.5 text-[0.75rem] font-medium text-ink-3">{label}</figcaption>
    </figure>
  )
}
