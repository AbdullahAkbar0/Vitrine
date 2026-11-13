import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Dexie from 'dexie'
import { CATEGORIES, GENDERS, STYLES, findSub } from '../config/categories'
import { db, newId, type Category, type Gender, type ItemImage, type Style, type WardrobeItem } from '../db/db'
import { t } from '../i18n'
import { isToolReady, removeBackground, type BgProgress } from '../lib/bgremove'
import { dominantColor, nameColor } from '../lib/colors'
import { cleanMask, composeCutout, coverage } from '../lib/cutout'
import {
  NotAnImageError,
  canvasToImageData,
  ctx2d,
  encode,
  fitToCanvas,
  loadImage,
  releaseImage,
  rotateCanvas,
  rotateMask,
} from '../lib/image'
import { binFromAlpha, detectRotation, sharpness } from '../lib/fit/analyze'
import { fitGarment } from '../lib/fit/fit'
import { gendersFor, makeFitImage } from '../lib/fitStore'
import { garmentKind } from '../config/fitRules'
import { getSetting, type MannequinGender } from '../db/db'
import { DressedMannequin } from '../components/Window'
import { PrintPlacer, pastePrint, type Placement } from '../components/PrintPlacer'
import { CategoryIcon } from '../components/CategoryIcons'
import { EdgeEditor } from '../components/EdgeEditor'
import { AlertIcon, CameraIcon, CheckIcon, PlusIcon } from '../components/Icons'
import { Button } from '../components/ui'

// ---------- Types ----------

type Side = 'front' | 'back'
interface Shot {
  file: Blob
  url: string
}
interface Detail {
  id: string
  shot: Shot
  label: string
}
interface Processed {
  photo: ImageData // working size (max 1400px), exact photo pixels
  original: HTMLCanvasElement // max 1600px, kept as the original
  mask: Uint8Array
  manual: boolean // background removal failed; user erases by hand
  turned: number // quarter turns applied automatically
}

/** Quarter-turns photo, original and mask together. */
function turn(p: Processed, q: number): Processed {
  if (!(((q % 4) + 4) % 4)) return p
  const c = document.createElement('canvas')
  c.width = p.photo.width
  c.height = p.photo.height
  ctx2d(c).putImageData(p.photo, 0, 0)
  const photo = canvasToImageData(rotateCanvas(c, q))
  return {
    ...p,
    photo,
    original: rotateCanvas(p.original, q),
    mask: rotateMask(p.mask, p.photo.width, p.photo.height, q),
  }
}
type Stage = 'resize' | 'tool' | 'remove' | 'edges' | 'colour'

const STEPS = 7
const shot = (file: Blob): Shot => ({ file, url: URL.createObjectURL(file) })

// ---------- Small building blocks ----------

function WizardHeader({ step, onBack, onClose }: { step: number; onBack?: () => void; onClose: () => void }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 pt-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className="min-h-11 rounded-full px-3 text-[0.95rem] text-ink-2 disabled:invisible"
        >
          ‹ {t('add.back')}
        </button>
        <span className="text-[0.85rem] text-ink-3">{t('add.stepOf', { n: step, total: STEPS })}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('add.close')}
          className="grid size-11 place-items-center rounded-full text-ink-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="mx-auto mt-2 h-px max-w-xl bg-line">
        <div className="brass-fill h-px transition-[width] duration-500" style={{ width: `${(step / STEPS) * 100}%` }} />
      </div>
    </header>
  )
}

function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[1.9rem] leading-[1.1] font-normal tracking-[-0.01em]">{title}</h1>
      {hint && <p className="mt-2 leading-[1.55] text-ink-2">{hint}</p>}
    </div>
  )
}

/** The action bar that sits above the bottom dock. */
function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-safe fixed inset-x-0 bottom-[5.25rem] z-20 px-4">
      <div className="mx-auto flex max-w-md items-center gap-3">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`min-h-12 rounded-full border px-5 text-[0.95rem] transition-colors ${
        on ? 'brass-fill border-transparent font-medium' : 'border-line bg-surface text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-4 flex gap-2.5 rounded-2xl border border-warn/30 px-4 py-3 text-[0.95rem] text-warn">
      <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function PhotoTips() {
  const tips = ['add.tip1', 'add.tip2', 'add.tip3', 'add.tip4'] as const
  return (
    <details className="group mt-6 rounded-2xl border border-line px-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[0.95rem] text-ink">
        {t('add.tipsToggle')}
        <span className="text-brass transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <ul className="space-y-2.5 pb-4 text-[0.95rem] leading-[1.5] text-ink-2">
        {tips.map((k) => (
          <li key={k} className="flex gap-3">
            <span className="mt-[0.65rem] h-px w-3.5 shrink-0 bg-brass" aria-hidden />
            {t(k)}
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Camera + gallery buttons. The phone's own camera app is used: the most reliable way on every phone. */
function PhotoPicker({ onPick, hasPhoto }: { onPick: (file: File) => void; hasPhoto: boolean }) {
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onPick(f)
  }
  return (
    <div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <div className="flex flex-col gap-3">
        <Button onClick={() => camRef.current?.click()} variant={hasPhoto ? 'outline' : 'brass'} className="w-full">
          <CameraIcon width={21} height={21} strokeWidth={1.5} /> {t('add.takePhoto')}
        </Button>
        <Button onClick={() => galRef.current?.click()} variant="outline" className="w-full">
          {hasPhoto ? t('add.retake') : t('add.choosePhoto')}
        </Button>
      </div>
      <p className="mt-3 text-center text-[0.85rem] leading-[1.5] text-ink-3">{t('add.cameraNote')}</p>
    </div>
  )
}

/** Arch-shaped frame that shows the chosen photo, or a dashed placeholder. */
function PhotoFrame({ url }: { url?: string }) {
  return (
    <div className="mx-auto mb-6 w-52">
      <div className="window-arch bg-[linear-gradient(160deg,#f3e0b5,#c9a56c_30%,#7c5b2c_60%,#d9b984)] p-[2px]">
        <div className="window-arch velvet relative grid aspect-[3/4] place-items-center overflow-hidden">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 200 200" className="w-[58%]" aria-hidden>
              <path
                d="M70 30 C 78 42 122 42 130 30 L 168 48 C 172 50 174 54 172 58 L 160 84 C 158 88 154 89 150 87 L 140 82 L 140 168 C 140 172 137 175 133 175 L 67 175 C 63 175 60 172 60 168 L 60 82 L 50 87 C 46 89 42 88 40 84 L 28 58 C 26 54 28 50 32 48 Z"
                fill="none"
                stroke="#d6b47c"
                strokeWidth="1.5"
                strokeDasharray="4 5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

/** A compact lit window for previews. */
function ShopWindowSmall({ children }: { children: ReactNode }) {
  return (
    <div className="window-arch mx-auto h-[min(60dvh,520px)] max-w-sm bg-[linear-gradient(160deg,#f3e0b5,#c9a56c_30%,#7c5b2c_60%,#d9b984)] p-[2px]">
      <div className="window-arch velvet relative h-full w-full overflow-hidden">
        <div className="velvet-folds absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        {children}
      </div>
    </div>
  )
}

// ---------- The wizard ----------

export function AddItemScreen({ onSaved, onExit }: { onSaved: () => void; onExit: () => void }) {
  const [step, setStep] = useState(1)
  const [group, setGroup] = useState<Category | null>(null)
  const [sub, setSub] = useState<string | null>(null)
  const [gender, setGender] = useState<Gender>('unisex')
  const [style, setStyle] = useState<Style>('casual')
  const [front, setFront] = useState<Shot | null>(null)
  const [back, setBack] = useState<Shot | null>(null)
  const [details, setDetails] = useState<Detail[]>([])
  const [processed, setProcessed] = useState<Partial<Record<Side, Processed>>>({})
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  // processing
  const [stage, setStage] = useState<Stage>('resize')
  const [side, setSide] = useState<Side>('front')
  const [toolPct, setToolPct] = useState<number | null>(null)
  const [failed, setFailed] = useState<{ side: Side; message: string } | null>(null)

  // review
  const [view, setView] = useState<Side>('front')
  const [editing, setEditing] = useState(false)
  const [bg, setBg] = useState<'white' | 'velvet'>('white')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'fitted' | 'cutout'>('fitted')
  const [fitted, setFitted] = useState<Partial<Record<Side, { url: string; rect: { x: number; y: number; w: number; h: number } }>>>({})
  const [fitting, setFitting] = useState(false)
  const [previewGender, setPreviewGender] = useState<MannequinGender>('female')
  const [soft, setSoft] = useState(false)
  const [printFor, setPrintFor] = useState<{ img: HTMLImageElement; file: Blob; canvas: HTMLCanvasElement } | null>(null)
  const [printShots, setPrintShots] = useState<Blob[]>([])
  const jobs = useRef<Partial<Record<Side, { shot: Shot; promise: Promise<Processed> }>>>({})

  const scrollTop = () => window.scrollTo({ top: 0 })
  const go = (n: number) => {
    setError(null)
    setStep(n)
    scrollTop()
  }

  const reset = () => {
    for (const s of [front, back, ...details.map((d) => d.shot)]) if (s) URL.revokeObjectURL(s.url)
    setStep(1)
    setGroup(null)
    setSub(null)
    setGender('unisex')
    setStyle('casual')
    setFront(null)
    setBack(null)
    setDetails([])
    setProcessed({})
    setError(null)
    setFailed(null)
    setEditing(false)
    setName('')
    setNameTouched(false)
    setView('front')
    setConfirmClose(false)
    setMode('fitted')
    setFitted((f) => {
      Object.values(f).forEach((v) => v && URL.revokeObjectURL(v.url))
      return {}
    })
    setSoft(false)
    setPrintFor(null)
    setPrintShots([])
    jobs.current = {}
  }

  const close = () => {
    if (front || sub) setConfirmClose(true)
    else onExit()
  }

  // Start downloading the cutting tool early, while the user is still taking photos.
  const warmed = useRef(false)
  useEffect(() => {
    if (step === 3 && !warmed.current) {
      warmed.current = true
      isToolReady().then((ready) => {
        if (!ready && navigator.onLine) {
          fetch(new URL(`${__BG_DIR__}/resources.json`, document.baseURI)).catch(() => undefined)
        }
      })
    }
  }, [step])

  const acceptPhoto = async (file: File, set: (s: Shot) => void) => {
    setError(null)
    try {
      const img = await loadImage(file) // checks it really is a picture
      releaseImage(img)
      set(shot(file))
    } catch (e) {
      setError(e instanceof NotAnImageError ? t('add.notImage') : t('add.notImage'))
    }
  }

  // ---------- Processing ----------

  const processSide = async (which: Side, s: Shot): Promise<Processed> => {
    setSide(which)
    setStage('resize')
    const img = await loadImage(s.file)
    const original = fitToCanvas(img, 1600, img.naturalWidth, img.naturalHeight)
    releaseImage(img)
    const work = fitToCanvas(original, 1400)
    const photo = ctx2d(work).getImageData(0, 0, work.width, work.height)

    const ready = await isToolReady()
    if (!ready && !navigator.onLine) throw new Error(t('add.offlineFirst'))
    setStage(ready ? 'remove' : 'tool')
    const raw = await removeBackground(photo, (p: BgProgress) => {
      if (p.phase === 'download') {
        setStage('tool')
        setToolPct(Math.round(p.fraction * 100))
      } else setStage('remove')
    })
    setStage('edges')
    const mask = cleanMask(raw, photo.width, photo.height)
    if (which === 'front') setStage('colour')
    let result: Processed = { photo, original, mask, manual: false, turned: 0 }
    // photos taken sideways or upside down are turned the right way up
    const cut = composeCutout(photo, mask)
    if (cut && sub && group) {
      const q = detectRotation(binFromAlpha(canvasToImageData(cut)).bin, garmentKind(sub), group)
      if (q) result = { ...turn(result, q), turned: q }
    }
    return result
  }

  /** Starts cutting out a photo straight away, so it is ready by the time the user gets to step 6. */
  const startJob = (which: Side, s: Shot) => {
    const promise = processSide(which, s)
    promise.catch(() => undefined)
    jobs.current[which] = { shot: s, promise }
  }

  const runProcessing = async () => {
    setFailed(null)
    setToolPct(null)
    const result: Partial<Record<Side, Processed>> = { ...processed }
    const todo: [Side, Shot | null][] = [
      ['front', front],
      ['back', back],
    ]
    for (const [which, s] of todo) {
      if (!s || result[which]) continue
      try {
        if (jobs.current[which]?.shot !== s) startJob(which, s)
        setSide(which)
        result[which] = await jobs.current[which]!.promise
        setProcessed({ ...result })
      } catch (e) {
        console.error(e)
        jobs.current[which] = undefined // "Try again" starts a fresh attempt
        const message = e instanceof Error && e.message === t('add.offlineFirst') ? e.message : t('add.failed')
        setFailed({ side: which, message })
        return
      }
    }
    // Default name, e.g. "Navy T-shirt"
    const f = result.front!
    if (!nameTouched) {
      const colour = t(nameColor(dominantColor(f.photo, f.mask)))
      const info = sub ? findSub(sub) : null
      setName(info ? `${colour} ${t(info.sub.label)}` : colour)
    }
    setView('front')
    setEditing(f.manual)
    setMode(f.manual ? 'cutout' : 'fitted')
    setSoft(sharpness(f.photo, f.mask) < 35)
    go(7)
  }

  const useOriginal = async () => {
    if (!failed) return
    const which = failed.side
    const s = which === 'front' ? front : back
    if (!s) return
    const img = await loadImage(s.file)
    const original = fitToCanvas(img, 1600, img.naturalWidth, img.naturalHeight)
    releaseImage(img)
    const work = fitToCanvas(original, 1400)
    const photo = ctx2d(work).getImageData(0, 0, work.width, work.height)
    const mask = new Uint8Array(photo.width * photo.height).fill(255)
    const next = { ...processed, [which]: { photo, original, mask, manual: true, turned: 0 } }
    setProcessed(next)
    setFailed(null)
    // continue with the other side if needed
    if (which === 'front' && back && !next.back) {
      setTimeout(runProcessing, 0)
      return
    }
    if (!nameTouched && sub) {
      const info = findSub(sub)
      setName(info ? t(info.sub.label) : '')
    }
    setView(which)
    setEditing(true)
    setMode('cutout')
    go(7)
  }

  // which mannequin shows the preview
  useEffect(() => {
    if (step !== 7) return
    if (gender !== 'unisex') setPreviewGender(gender)
    else getSetting<MannequinGender>('tryonGender', 'female').then(setPreviewGender).catch(() => undefined)
  }, [step, gender])

  // fit the piece on the mannequin whenever the cut-out changes
  useEffect(() => {
    if (step !== 7 || editing || !sub) return
    const p = processed[view]
    if (!p) return
    let cancelled = false
    setFitting(true)
    const run = async () => {
      const cut = composeCutout(p.photo, p.mask)
      if (!cut) return
      const r = await fitGarment(canvasToImageData(cut), sub, previewGender, view)
      const blob = await new Promise<Blob | null>((res) => r.canvas.toBlob(res, 'image/png'))
      if (cancelled || !blob) return
      const url = URL.createObjectURL(blob)
      setFitted((f) => {
        if (f[view]) URL.revokeObjectURL(f[view]!.url)
        return { ...f, [view]: { url, rect: r.rect } }
      })
    }
    run()
      .catch((e) => console.error(e))
      .finally(() => !cancelled && setFitting(false))
    return () => {
      cancelled = true
    }
  }, [step, editing, processed, view, previewGender, sub])

  useEffect(() => {
    if (step === 6) runProcessing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ---------- Saving ----------

  const save = async () => {
    const f = processed.front
    if (!f || !sub || !group) return
    setError(null)
    setSaving(true)
    try {
      const frontCut = composeCutout(f.photo, f.mask)
      const backCut = processed.back ? composeCutout(processed.back.photo, processed.back.mask) : null
      if (!frontCut || (processed.back && !backCut)) {
        setError(t('add.emptyCut'))
        setSaving(false)
        return
      }
      const hex = dominantColor(f.photo, f.mask)
      const colourKey = nameColor(hex)
      const id = newId()
      const now = Date.now()
      const images: ItemImage[] = []
      const img = (kind: ItemImage['kind'], blob: Blob, extra: Partial<ItemImage> = {}) =>
        images.push({ id: newId(), itemId: id, kind, blob, ...extra })

      img('front-cutout', await encode(frontCut, { transparent: true, quality: 0.9 }))
      img('front-original', await encode(f.original, { transparent: false, quality: 0.85 }))
      img('thumb', await encode(fitToCanvas(frontCut, 300), { transparent: true, quality: 0.85 }))
      if (processed.back && backCut) {
        img('back-cutout', await encode(backCut, { transparent: true, quality: 0.9 }))
        img('back-original', await encode(processed.back.original, { transparent: false, quality: 0.85 }))
      }
      for (const g of gendersFor({ gender })) {
        images.push(await makeFitImage(id, canvasToImageData(frontCut), sub, g, 'front'))
        if (backCut) images.push(await makeFitImage(id, canvasToImageData(backCut), sub, g, 'back'))
      }
      let order = 0
      for (const blob of printShots) {
        const pi = await loadImage(blob)
        const c = fitToCanvas(pi, 1600, pi.naturalWidth, pi.naturalHeight)
        releaseImage(pi)
        img('detail', await encode(c, { transparent: false, quality: 0.88 }), { label: t('add.printLabel'), order: order++ })
      }
      for (const d of details) {
        const di = await loadImage(d.shot.file)
        const c = fitToCanvas(di, 1600, di.naturalWidth, di.naturalHeight)
        releaseImage(di)
        img('detail', await encode(c, { transparent: false, quality: 0.85 }), { label: d.label.trim(), order: order++ })
      }

      const info = findSub(sub)
      const item: WardrobeItem = {
        id,
        name: name.trim() || (info ? t(info.sub.label) : ''),
        category: group,
        subCategory: sub,
        gender,
        style,
        dominantColor: hex,
        colorName: t(colourKey),
        tags: [t(colourKey).toLowerCase(), info ? t(info.sub.label).toLowerCase() : sub],
        notes: '',
        createdAt: now,
        updatedAt: now,
        hasBack: processed.back ? 1 : 0,
        isSample: 0,
        fitData: {},
      }
      await db.transaction('rw', db.items, db.images, async () => {
        await db.items.add(item)
        await db.images.bulkAdd(images)
      })
      reset()
      onSaved()
    } catch (e) {
      console.error(e)
      const quota =
        e instanceof Dexie.QuotaExceededError ||
        (e instanceof Error && /quota/i.test(`${e.name} ${e.message} ${(e as { inner?: Error }).inner?.name ?? ''}`))
      setError(quota ? t('add.storageFull') : t('add.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const current = processed[view]
  const setMaskFor = (which: Side) => (mask: Uint8Array) =>
    setProcessed((p) => (p[which] ? { ...p, [which]: { ...p[which]!, mask } } : p))
  const lowCoverage = useMemo(() => (current ? coverage(current.mask) < 0.01 : false), [current])

  // ---------- Screens ----------

  const body = (() => {
    switch (step) {
      case 1: {
        const g = CATEGORIES.find((c) => c.id === group)
        return (
          <>
            <StepTitle title={t('add.catTitle')} hint={t('add.catHint')} />
            <div role="radiogroup" className="grid grid-cols-3 gap-2.5">
              {CATEGORIES.map((c) => {
                const on = group === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setGroup(c.id)
                      if (!c.items.some((i) => i.id === sub)) setSub(null)
                    }}
                    className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-[1.25rem] border text-[0.9rem] transition-colors ${
                      on ? 'border-brass bg-surface text-ink shadow-[inset_0_0_0_1px_var(--c-brass)]' : 'border-line bg-surface text-ink-2'
                    }`}
                  >
                    <CategoryIcon id={c.id} className={`size-11 ${on ? 'text-brass' : ''}`} />
                    {t(c.label)}
                  </button>
                )
              })}
            </div>
            {g && (
              <div role="radiogroup" aria-label={t(g.label)} className="mt-7 flex flex-wrap gap-2.5">
                {g.items.map((i) => (
                  <Chip key={i.id} on={sub === i.id} onClick={() => setSub(i.id)}>
                    {t(i.label)}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )
      }
      case 2:
        return (
          <>
            <StepTitle title={t('add.whoTitle')} />
            <h2 className="mb-3 text-[0.95rem] text-ink-2">{t('add.whoGender')}</h2>
            <div role="radiogroup" className="flex flex-wrap gap-2.5">
              {GENDERS.map((o) => (
                <Chip key={o.id} on={gender === o.id} onClick={() => setGender(o.id)}>
                  {t(o.label)}
                </Chip>
              ))}
            </div>
            <h2 className="mt-8 mb-3 text-[0.95rem] text-ink-2">{t('add.whoStyle')}</h2>
            <div role="radiogroup" className="flex flex-wrap gap-2.5">
              {STYLES.map((o) => (
                <Chip key={o.id} on={style === o.id} onClick={() => setStyle(o.id)}>
                  {t(o.label)}
                </Chip>
              ))}
            </div>
          </>
        )
      case 3:
      case 4: {
        const isFront = step === 3
        const s = isFront ? front : back
        return (
          <>
            <StepTitle
              title={t(isFront ? 'add.frontTitle' : 'add.backTitle')}
              hint={t(isFront ? 'add.frontHint' : 'add.backHint')}
            />
            <PhotoFrame url={s?.url} />
            <PhotoPicker
              hasPhoto={!!s}
              onPick={(file) =>
                acceptPhoto(file, (ns) => {
                  if (s) URL.revokeObjectURL(s.url)
                  if (isFront) setFront(ns)
                  else setBack(ns)
                  setProcessed((p) => ({ ...p, [isFront ? 'front' : 'back']: undefined }))
                  startJob(isFront ? 'front' : 'back', ns)
                })
              }
            />
            {error && <ErrorNote>{error}</ErrorNote>}
            <PhotoTips />
            <p className="mt-4 text-[0.85rem] leading-[1.5] text-ink-3">{t('add.cameraBlocked')}</p>
          </>
        )
      }
      case 5:
        return (
          <>
            <StepTitle title={t('add.detailsTitle')} hint={t('add.detailsHint')} />
            <ul className="space-y-3">
              {details.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
                  <img src={d.shot.url} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                  <label className="flex-1">
                    <span className="sr-only">{t('add.detailLabel')}</span>
                    <input
                      value={d.label}
                      maxLength={60}
                      placeholder={t('add.detailPlaceholder')}
                      onChange={(e) =>
                        setDetails((all) => all.map((x) => (x.id === d.id ? { ...x, label: e.target.value } : x)))
                      }
                      className="min-h-11 w-full rounded-xl bg-transparent px-2 text-[1rem] text-ink placeholder:text-ink-3 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={t('add.removeDetail')}
                    onClick={() => {
                      URL.revokeObjectURL(d.shot.url)
                      setDetails((all) => all.filter((x) => x.id !== d.id))
                    }}
                    className="grid size-11 place-items-center rounded-full text-ink-3"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            {details.length < 4 && (
              <label className="mt-3 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-brass/50 text-[0.95rem] text-ink">
                <PlusIcon width={20} height={20} strokeWidth={1.5} className="text-brass" />
                {t('add.addDetail')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f)
                      acceptPhoto(f, (s) => setDetails((all) => [...all, { id: newId(), shot: s, label: '' }]))
                  }}
                />
              </label>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
          </>
        )
      case 6: {
        const stages: { id: Stage; label: string }[] = [
          { id: 'resize', label: t('add.stepResize') },
          ...(toolPct !== null
            ? [{ id: 'tool' as Stage, label: toolPct >= 100 ? t('add.stepTool') : t('add.stepToolPct', { pct: toolPct }) }]
            : []),
          { id: 'remove', label: t('add.stepRemove') },
          { id: 'edges', label: t('add.stepEdges') },
          ...(side === 'front' ? [{ id: 'colour' as Stage, label: t('add.stepColour') }] : []),
        ]
        const order: Stage[] = ['resize', 'tool', 'remove', 'edges', 'colour']
        const at = order.indexOf(stage)
        const s = side === 'front' ? front : back
        const sideCount = back ? 2 : 1
        const sideIndex = side === 'front' ? 0 : 1
        const within = stage === 'tool' && toolPct !== null ? 0.15 + 0.5 * (toolPct / 100) : [0.1, 0.15, 0.7, 0.9, 0.97][at]
        const overall = (sideIndex + within) / sideCount
        return (
          <>
            <StepTitle title={side === 'back' ? t('add.processBack') : t('add.processTitle')} />
            <PhotoFrame url={s?.url} />
            {!failed && (
              <>
                <div className="h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(overall * 100)}>
                  <div className="brass-fill h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(4, overall * 100)}%` }} />
                </div>
                <ul className="mt-6 space-y-3.5" aria-live="polite">
                  {stages.map((st) => {
                    const idx = order.indexOf(st.id)
                    const done = idx < at
                    const now = idx === at
                    return (
                      <li key={st.id} className={`flex items-start gap-3 ${done ? 'text-ink' : now ? 'text-ink' : 'text-ink-3'}`}>
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                          {done ? (
                            <CheckIcon width={18} height={18} className="text-brass" />
                          ) : now ? (
                            <span className="size-2.5 animate-pulse rounded-full bg-brass" />
                          ) : (
                            <span className="size-1.5 rounded-full bg-ink-3/50" />
                          )}
                        </span>
                        <span className="leading-[1.45]">{st.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {failed && (
              <>
                <ErrorNote>{failed.message}</ErrorNote>
                <div className="mt-5 flex flex-col gap-3">
                  <Button onClick={runProcessing}>{t('add.tryAgain')}</Button>
                  {failed.message !== t('add.offlineFirst') && (
                    <Button variant="outline" onClick={useOriginal}>
                      {t('add.useOriginal')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )
      }
      case 7: {
        const cur = processed[view]
        const fit = fitted[view]
        return (
          <>
            <StepTitle title={t('add.reviewTitle')} hint={t('add.reviewHint')} />
            {processed.back && (
              <div role="tablist" className="mb-3 flex rounded-full border border-line bg-surface p-1">
                {(['front', 'back'] as const).map((sd) => (
                  <button
                    key={sd}
                    type="button"
                    role="tab"
                    aria-selected={view === sd}
                    onClick={() => {
                      setView(sd)
                      setEditing(false)
                      setPrintFor(null)
                    }}
                    className={`min-h-11 flex-1 rounded-full text-[0.95rem] ${view === sd ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3'}`}
                  >
                    {t(sd === 'front' ? 'add.front' : 'add.back')}
                  </button>
                ))}
              </div>
            )}
            <div role="tablist" className="mb-4 flex rounded-full border border-line bg-surface p-1">
              {(['fitted', 'cutout'] as const).map((md) => (
                <button
                  key={md}
                  type="button"
                  role="tab"
                  aria-selected={mode === md}
                  onClick={() => {
                    setMode(md)
                    if (md === 'fitted') setEditing(false)
                  }}
                  className={`min-h-11 flex-1 rounded-full text-[0.95rem] ${mode === md ? 'brass-fill font-medium' : 'text-ink-2'}`}
                >
                  {t(md === 'fitted' ? 'add.viewFitted' : 'add.viewCutout')}
                </button>
              ))}
            </div>

            {mode === 'fitted' && (
              <>
                <ShopWindowSmall>
                  <DressedMannequin
                    gender={previewGender}
                    view={view}
                    layers={fit ? [{ key: 'fit', url: fit.url, rect: fit.rect }] : []}
                    className="absolute bottom-[2%] left-1/2 h-[94%] -translate-x-1/2"
                  />
                  {fitting && (
                    <div className="absolute inset-x-0 bottom-6 flex justify-center">
                      <span className="rounded-full bg-velvet-2/90 px-4 py-2 text-[0.85rem] text-ivory">{t('add.fitting')}</span>
                    </div>
                  )}
                </ShopWindowSmall>
                {gender === 'unisex' && (
                  <div role="radiogroup" className="mx-auto mt-3 flex max-w-60 rounded-full border border-line bg-surface p-1">
                    {(['female', 'male'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        role="radio"
                        aria-checked={previewGender === g}
                        onClick={() => setPreviewGender(g)}
                        className={`min-h-10 flex-1 rounded-full text-[0.9rem] ${previewGender === g ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3'}`}
                      >
                        {t(g === 'female' ? 'tryon.female' : 'tryon.male')}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-center text-[0.9rem] leading-[1.5] text-ink-3">{t('add.fittedHint')}</p>
              </>
            )}

            {mode === 'cutout' && cur && printFor && (
              <PrintPlacer
                preview={printFor.canvas}
                closeup={printFor.img}
                onCancel={() => setPrintFor(null)}
                onApply={(pl: Placement) => {
                  const photo = pastePrint(cur.photo, printFor.img, pl)
                  setProcessed((p) => (p[view] ? { ...p, [view]: { ...p[view]!, photo } } : p))
                  setPrintShots((all) => [...all, printFor.file])
                  setPrintFor(null)
                  setSoft(false)
                  setMode('fitted')
                }}
              />
            )}

            {mode === 'cutout' && cur && !printFor && (
              <>
                <EdgeEditor photo={cur.photo} mask={cur.mask} onChange={setMaskFor(view)} editing={editing} background={bg} />
                {cur.manual && editing && <p className="mt-3 text-[0.9rem] text-ink-2">{t('add.manualHint')}</p>}
                {lowCoverage && <ErrorNote>{t('add.emptyCut')}</ErrorNote>}
                <div className="mt-4 flex items-center gap-2">
                  <div role="radiogroup" className="flex flex-1 rounded-full border border-line bg-surface p-1">
                    {(['white', 'velvet'] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        role="radio"
                        aria-checked={bg === b}
                        onClick={() => setBg(b)}
                        className={`min-h-11 flex-1 rounded-full text-[0.9rem] ${bg === b ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3'}`}
                      >
                        {t(b === 'white' ? 'add.onWhite' : 'add.onVelvet')}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing((e) => !e)}
                    className={`min-h-12 rounded-full px-5 text-[0.95rem] ${editing ? 'brass-fill font-medium' : 'border border-brass/50 text-ink'}`}
                  >
                    {editing ? t('add.doneFixing') : t('add.fixEdges')}
                  </button>
                </div>
                {!editing && (
                  <div className="mt-3 flex gap-2">
                    {([-1, 1] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setProcessed((p) => (p[view] ? { ...p, [view]: { ...turn(p[view]!, q), turned: 0 } } : p))}
                        className="min-h-11 flex-1 rounded-full border border-line text-[0.9rem] text-ink"
                      >
                        {q < 0 ? '⟲ ' + t('add.rotateLeft') : t('add.rotateRight') + ' ⟳'}
                      </button>
                    ))}
                  </div>
                )}
                {cur.turned !== 0 && <p className="mt-3 text-[0.9rem] text-ink-2">{t('add.turned')}</p>}
              </>
            )}

            {!printFor && (
              <div className="mt-6">
                {soft && view === 'front' && <p className="mb-3 leading-[1.5] text-ink-2">{t('add.softPrint')}</p>}
                <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-brass/60 px-4 text-[0.95rem] text-ink">
                  <CameraIcon width={19} height={19} strokeWidth={1.5} className="text-brass" />
                  {t('add.addPrint')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f || !cur) return
                      try {
                        const img = await loadImage(f)
                        const full = new ImageData(new Uint8ClampedArray(cur.photo.data), cur.photo.width, cur.photo.height)
                        for (let i = 0; i < cur.mask.length; i++) full.data[i * 4 + 3] = cur.mask[i]
                        const c = document.createElement('canvas')
                        c.width = full.width
                        c.height = full.height
                        ctx2d(c).putImageData(full, 0, 0)
                        setEditing(false)
                        setMode('cutout')
                        setPrintFor({ img, file: f, canvas: c })
                      } catch {
                        setError(t('add.notImage'))
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <label className="mt-7 block">
              <span className="text-[0.95rem] text-ink-2">{t('add.nameLabel')}</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameTouched(true)
                }}
                className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[1rem] text-ink focus:border-brass focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => go(view === 'front' ? 3 : 4)}
              className="mt-5 min-h-11 text-[0.95rem] text-ink-2 underline decoration-brass/50 underline-offset-4"
            >
              {t('add.retake')}
            </button>
            {error && <ErrorNote>{error}</ErrorNote>}
          </>
        )
      }
    }
  })()

  const canNext = step === 1 ? !!sub : step === 3 ? !!front : true
  const action = (() => {
    switch (step) {
      case 1:
      case 2:
      case 3:
        return (
          <Button className="flex-1" onClick={() => canNext && go(step + 1)}>
            {t('add.next')}
          </Button>
        )
      case 4:
        return (
          <>
            {!back && (
              <Button variant="outline" className="flex-1 bg-bg/80 backdrop-blur" onClick={() => go(5)}>
                {t('add.skip')}
              </Button>
            )}
            {back && (
              <Button className="flex-1" onClick={() => go(5)}>
                {t('add.next')}
              </Button>
            )}
          </>
        )
      case 5:
        return (
          <Button className="flex-1" onClick={() => go(6)}>
            {details.length ? t('add.next') : t('add.skip')}
          </Button>
        )
      case 7:
        return (
          <Button className="flex-1" onClick={save}>
            {saving ? t('add.saving') : t('add.save')}
          </Button>
        )
      default:
        return null
    }
  })()

  return (
    <>
      <WizardHeader
        step={step}
        onBack={step > 1 && step !== 6 ? () => go(step === 7 ? 5 : step - 1) : undefined}
        onClose={close}
      />
      <main className="mx-auto max-w-xl px-6 pt-6 pb-48">{body}</main>
      {action && (
        <ActionBar>
          <div className={`flex w-full gap-3 ${canNext ? '' : 'opacity-40'}`}>{action}</div>
        </ActionBar>
      )}
      {confirmClose && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 p-4" onClick={() => setConfirmClose(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="mb-safe mx-auto w-full max-w-md rounded-[1.6rem] border border-line bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-[1.4rem]">{t('add.discardTitle')}</p>
            <p className="mt-2 text-ink-2">{t('add.discardBody')}</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmClose(false)}>
                {t('add.keepEditing')}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  reset()
                  onExit()
                }}
              >
                {t('add.discard')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
