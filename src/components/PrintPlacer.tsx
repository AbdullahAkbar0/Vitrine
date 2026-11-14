import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { t } from '../i18n'
import { ctx2d, makeCanvas } from '../lib/image'
import { Button } from './ui'

export interface Placement {
  cx: number // centre, fraction of photo width
  cy: number // centre, fraction of photo height
  w: number // width, fraction of photo width
  angle: number // degrees
}

/** Paints a sharp close-up of the print into the garment photo, with soft edges so no seam shows. */
export function pastePrint(photo: ImageData, closeup: HTMLImageElement, p: Placement): ImageData {
  const c = makeCanvas(photo.width, photo.height)
  const x = ctx2d(c)
  x.putImageData(photo, 0, 0)
  const w = p.w * photo.width
  const h = (w * closeup.naturalHeight) / closeup.naturalWidth
  // soft-edged copy of the close-up at the size it will be drawn
  const fw = Math.max(2, Math.round(Math.min(w * 1.5, closeup.naturalWidth)))
  const fh = Math.max(2, Math.round((fw * closeup.naturalHeight) / closeup.naturalWidth))
  const f = makeCanvas(fw, fh)
  const fx = ctx2d(f)
  fx.drawImage(closeup, 0, 0, fw, fh)
  const d = fx.getImageData(0, 0, fw, fh)
  const feather = Math.max(2, Math.min(fw, fh) * 0.12)
  for (let yy = 0; yy < fh; yy++) {
    for (let xx = 0; xx < fw; xx++) {
      const edge = Math.min(xx, yy, fw - 1 - xx, fh - 1 - yy)
      const a = Math.max(0, Math.min(1, edge / feather))
      d.data[(yy * fw + xx) * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a))
    }
  }
  fx.putImageData(d, 0, 0)
  x.save()
  x.translate(p.cx * photo.width, p.cy * photo.height)
  x.rotate((p.angle * Math.PI) / 180)
  x.drawImage(f, -w / 2, -h / 2, w, h)
  x.restore()
  return x.getImageData(0, 0, photo.width, photo.height)
}

/** Lets the user lay the close-up over the print on the garment, then applies it. */
export function PrintPlacer({
  preview,
  closeup,
  onApply,
  onCancel,
}: {
  preview: HTMLCanvasElement // the cut-out at full working size
  closeup: HTMLImageElement
  onApply: (p: Placement) => void
  onCancel: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const [p, setP] = useState<Placement>({ cx: 0.5, cy: 0.35, w: 0.3, angle: 0 })
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    const h = holder.current
    if (!h) return
    preview.className = 'block max-h-[52dvh] w-auto max-w-full'
    h.replaceChildren(preview)
  }, [preview])

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, cx: p.cx, cy: p.cy }
  }
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !box.current) return
    const r = box.current.getBoundingClientRect()
    setP((q) => ({
      ...q,
      cx: Math.max(0, Math.min(1, drag.current!.cx + (e.clientX - drag.current!.x) / r.width)),
      cy: Math.max(0, Math.min(1, drag.current!.cy + (e.clientY - drag.current!.y) / r.height)),
    }))
  }
  const up = () => {
    drag.current = null
  }
  const ratio = closeup.naturalHeight / closeup.naturalWidth
  const photoRatio = preview.height / preview.width

  return (
    <div>
      <p className="mb-3 leading-[1.5] text-ink-2">{t('add.printHint')}</p>
      <div className="flex justify-center overflow-hidden checker rounded-[1.4rem]">
        <div ref={box} className="relative inline-block touch-none">
          <div ref={holder} />
          <div
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className="absolute cursor-move outline-2 outline-dashed outline-primary"
            style={{
              left: `${(p.cx - p.w / 2) * 100}%`,
              top: `${(p.cy - (p.w * ratio) / photoRatio / 2) * 100}%`,
              width: `${p.w * 100}%`,
              height: `${((p.w * ratio) / photoRatio) * 100}%`,
              transform: `rotate(${p.angle}deg)`,
            }}
          >
            <img src={closeup.src} alt="" className="pointer-events-none h-full w-full opacity-75" />
          </div>
        </div>
      </div>
      <label className="mt-4 flex items-center gap-4 text-[0.9rem] text-ink-2">
        <span className="w-16 shrink-0">{t('add.printSize')}</span>
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round(p.w * 100)}
          onChange={(e) => setP((q) => ({ ...q, w: Number(e.target.value) / 100 }))}
          className="h-11 flex-1 accent-[var(--c-primary)]"
        />
      </label>
      <label className="flex items-center gap-4 text-[0.9rem] text-ink-2">
        <span className="w-16 shrink-0">{t('add.printTurn')}</span>
        <input
          type="range"
          min={-45}
          max={45}
          value={p.angle}
          onChange={(e) => setP((q) => ({ ...q, angle: Number(e.target.value) }))}
          className="h-11 flex-1 accent-[var(--c-primary)]"
        />
      </label>
      <div className="mt-3 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          {t('add.printCancel')}
        </Button>
        <Button className="flex-1" onClick={() => onApply(p)}>
          {t('add.printApply')}
        </Button>
      </div>
    </div>
  )
}
