import type { ReactNode } from 'react'
import type { MannequinGender } from '../db/db'

/** Mannequin pictures live in /public/mannequins. Replace the files to upgrade them; no code changes needed. */
export const mannequinSrc = (gender: MannequinGender, view: 'front' | 'back') => `./mannequins/${gender}-${view}.png`

/** Width ÷ height of every mannequin picture. Keep new pictures in this shape. */
export const MANNEQUIN_RATIO = 972 / 2160

/** The fitting-room backdrop used wherever the mannequin appears. */
export function Studio({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`studio relative isolate overflow-hidden rounded-[1.75rem] ${className}`}>
      <div className="studio-floor absolute inset-x-[10%] bottom-[8%] h-[7%]" />
      {children}
    </div>
  )
}

export interface WornLayer {
  key: string
  url: string
  rect: { x: number; y: number; w: number; h: number }
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
    <div
      className={`${/\babsolute\b/.test(className) ? '' : 'relative'} ${animate ? 'pop-in' : ''} ${className}`}
      style={{ aspectRatio: `${MANNEQUIN_RATIO}` }}
    >
      <img src={mannequinSrc(gender, view)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
      {layers.map((l) => {
        const pos = {
          left: `${l.rect.x * 100}%`,
          top: `${l.rect.y * 100}%`,
          width: `${l.rect.w * 100}%`,
          height: `${l.rect.h * 100}%`,
        }
        return (
          <img
            key={l.key}
            src={l.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{ ...pos, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
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
      <DressedMannequin gender={gender} view={view} layers={layers} animate={animate} className="absolute bottom-[10%] left-1/2 h-[86%] -translate-x-1/2" />
      {children}
    </Studio>
  )
}
