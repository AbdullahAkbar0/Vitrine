import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { t } from '../i18n'
import { ctx2d } from '../lib/image'

type Mode = 'erase' | 'restore'

/**
 * Shows the cut-out and lets the user fix edges with a brush.
 * Erase removes leftover background; Restore brings back parts that were wrongly removed.
 */
export function EdgeEditor({
  photo,
  mask,
  onChange,
  editing,
  background,
}: {
  photo: ImageData
  mask: Uint8Array
  onChange: (mask: Uint8Array) => void
  editing: boolean
  background: 'light' | 'dark'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const composite = useRef<ImageData | null>(null)
  const working = useRef<Uint8Array>(mask)
  const undo = useRef<Uint8Array[]>([])
  const last = useRef<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<Mode>('erase')
  const [size, setSize] = useState(22)
  const [undoCount, setUndoCount] = useState(0)
  const [cursor, setCursor] = useState<{ x: number; y: number; r: number } | null>(null)

  // Draw the whole cut-out whenever a new photo or mask comes in from outside.
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = photo.width
    c.height = photo.height
    const comp = new ImageData(new Uint8ClampedArray(photo.data), photo.width, photo.height)
    for (let i = 0; i < mask.length; i++) comp.data[i * 4 + 3] = mask[i]
    composite.current = comp
    working.current = new Uint8Array(mask)
    ctx2d(c).putImageData(comp, 0, 0)
  }, [photo, mask])

  useEffect(() => {
    undo.current = []
    setUndoCount(0)
  }, [photo])

  const toImage = (e: RPointerEvent) => {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    const scale = c.width / rect.width
    return {
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
      scale,
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
    }
  }

  const dab = (cx: number, cy: number, r: number) => {
    const w = photo.width
    const h = photo.height
    const m = working.current
    const comp = composite.current!
    const x0 = Math.max(0, Math.floor(cx - r))
    const y0 = Math.max(0, Math.floor(cy - r))
    const x1 = Math.min(w - 1, Math.ceil(cx + r))
    const y1 = Math.min(h - 1, Math.ceil(cy + r))
    const hard = r * 0.65
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > r) continue
        const s = d <= hard ? 1 : 1 - (d - hard) / (r - hard)
        const i = y * w + x
        const v = mode === 'erase' ? Math.round(m[i] * (1 - s)) : Math.max(m[i], Math.round(255 * s))
        m[i] = v
        comp.data[i * 4 + 3] = v
      }
    }
    return { x0, y0, x1, y1 }
  }

  const paintTo = (x: number, y: number, r: number) => {
    const from = last.current ?? { x, y }
    const dist = Math.hypot(x - from.x, y - from.y)
    const steps = Math.max(1, Math.ceil(dist / (r / 3)))
    let box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for (let s = 1; s <= steps; s++) {
      const px = from.x + ((x - from.x) * s) / steps
      const py = from.y + ((y - from.y) * s) / steps
      const b = dab(px, py, r)
      box = { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) }
    }
    last.current = { x, y }
    if (box.x1 >= box.x0) {
      ctx2d(canvasRef.current!).putImageData(composite.current!, 0, 0, box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1)
    }
  }

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!editing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    undo.current.push(new Uint8Array(working.current))
    if (undo.current.length > 12) undo.current.shift()
    setUndoCount(undo.current.length)
    const p = toImage(e)
    last.current = null
    const r = size * p.scale
    paintTo(p.x, p.y, r)
    setCursor({ x: p.sx, y: p.sy, r: size })
  }
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!editing || !last.current) return
    const p = toImage(e)
    paintTo(p.x, p.y, size * p.scale)
    setCursor({ x: p.sx, y: p.sy, r: size })
  }
  const onUp = () => {
    if (!last.current) return
    last.current = null
    setCursor(null)
    onChange(new Uint8Array(working.current))
  }

  const doUndo = () => {
    const prev = undo.current.pop()
    setUndoCount(undo.current.length)
    if (prev) onChange(prev)
  }

  return (
    <div>
      <div
        className={`relative mx-auto flex max-h-[52dvh] items-center justify-center overflow-hidden rounded-[1.4rem] border border-line ${
          background === 'light' ? 'checker' : 'bg-[#1d1b4b]'
        }`}
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className={`block max-h-[52dvh] w-auto max-w-full ${editing ? 'cursor-crosshair touch-none' : ''}`}
            aria-label={t('add.reviewTitle')}
            role="img"
          />
          {cursor && (
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-full border-2 border-accent shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              style={{ left: cursor.x - cursor.r, top: cursor.y - cursor.r, width: cursor.r * 2, height: cursor.r * 2 }}
            />
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div role="radiogroup" className="flex flex-1 rounded-full border border-line bg-surface p-1">
              {(['erase', 'restore'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-11 flex-1 rounded-full text-[0.95rem] ${mode === m ? 'bg-primary text-on-primary font-semibold' : 'text-ink-2'}`}
                >
                  {t(m === 'erase' ? 'add.erase' : 'add.restore')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={doUndo}
              disabled={undoCount === 0}
              className="min-h-12 rounded-full border border-line px-5 text-[0.95rem] text-ink disabled:opacity-35"
            >
              {t('add.undo')}
            </button>
          </div>
          <label className="flex items-center gap-4 text-[0.9rem] text-ink-2">
            <span className="shrink-0">{t('add.brushSize')}</span>
            <input
              type="range"
              min={6}
              max={60}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="h-11 flex-1 accent-[var(--c-primary)]"
            />
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full border border-line"
            >
              <span className="rounded-full bg-primary" style={{ width: Math.max(4, size * 0.6), height: Math.max(4, size * 0.6) }} />
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
