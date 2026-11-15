// Puts the real cut-out photo of a garment on the mannequin, paper-doll style.
// The photo is only scaled and positioned: shoulders on the shoulders for tops and coats,
// waistband at the waist for trousers and skirts, shoes at the feet. Nothing is redrawn or bent.
import rigData from '../../config/mannequinRig.json'
import { garmentKind } from '../../config/fitRules'
import type { MannequinGender } from '../../db/db'
import { ctx2d, makeCanvas } from '../image'
import { binFromAlpha, bottomMarks, skirtMarks, topMarks } from './analyze'
import type { Pt } from './tps'

export type View = 'front' | 'back'

export const MANNEQUIN_W = rigData.width
export const MANNEQUIN_H = rigData.height

export interface FitResult {
  canvas: HTMLCanvasElement
  /** Position on the mannequin picture, as fractions (0..1) of its width and height. */
  rect: { x: number; y: number; w: number; h: number }
}
interface Box {
  x: number
  y: number
  w: number
  h: number
}

// ---------- The mannequin body (measured by scripts/mannequin/rig.py) ----------

type RigJson = typeof rigData.female
interface Rig {
  c: number
  p: (key: keyof RigJson) => Pt
  y: (key: 'waistY' | 'hipsY' | 'footY') => number
  bodyHalf: (y: number) => number
  headHalf: number
}

const rigCache = new Map<MannequinGender, Rig>()
function getRig(g: MannequinGender): Rig {
  const hit = rigCache.get(g)
  if (hit) return hit
  const r = rigData[g] as RigJson
  const torsoKeys = Object.keys(r.torsoHalfW).map(Number).sort((a, b) => a - b)
  const torsoVals = torsoKeys.map((k) => (r.torsoHalfW as Record<string, number>)[String(k)])
  const legKeys = Object.keys(r.legL).map(Number).sort((a, b) => a - b)
  const legVals = legKeys.map((k) => (r.legL as Record<string, number[]>)[String(k)])
  const nearest = (keys: number[], y: number) => {
    let lo = 0
    let hi = keys.length - 1
    if (y <= keys[0]) return 0
    if (y >= keys[hi]) return hi
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (keys[m] <= y) lo = m
      else hi = m
    }
    return y - keys[lo] < keys[hi] - y ? lo : hi
  }
  const c0 = r.centerX
  const rig: Rig = {
    c: c0,
    p: (key) => {
      const v = r[key] as unknown as number[]
      return [v[0], v[1]]
    },
    y: (key) => r[key] as number,
    bodyHalf: (y) => {
      if (y <= r.crotch[1]) return torsoVals[nearest(torsoKeys, y)]
      const l = legVals[nearest(legKeys, y)]
      return c0 - l[0]
    },
    headHalf: r.headHalfW,
  }
  rigCache.set(g, rig)
  return rig
}

// ---------- Gentle body shading (the photo's own pixels, slightly darker where the body turns away) ----------

const shadeCache = new Map<string, Promise<ImageData | null>>()
function getShade(g: MannequinGender, view: View): Promise<ImageData | null> {
  const key = `${g}-${view}`
  let p = shadeCache.get(key)
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(new URL(`mannequins/shade-${key}.png`, document.baseURI))
        const bmp = await createImageBitmap(await res.blob())
        const c = makeCanvas(bmp.width, bmp.height)
        ctx2d(c).drawImage(bmp, 0, 0)
        return ctx2d(c).getImageData(0, 0, c.width, c.height)
      } catch {
        return null
      }
    })()
    shadeCache.set(key, p)
  }
  return p
}

function shadeCanvas(canvas: HTMLCanvasElement, shade: ImageData, ox: number, oy: number, strength: number) {
  const ctx = ctx2d(canvas)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  const w = canvas.width
  for (let y = 0; y < canvas.height; y++) {
    const sy = Math.max(0, Math.min(shade.height - 1, Math.round(y + oy)))
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!px[i + 3]) continue
      const sx = Math.max(0, Math.min(shade.width - 1, Math.round(x + ox)))
      const j = (sy * shade.width + sx) * 4
      const cov = shade.data[j + 3] / 255
      const f = Math.max(0.82, Math.min(1.05, 0.55 + 0.6 * (shade.data[j] / 255)))
      const k = 1 + (cov * f + (1 - cov) * 0.96 - 1) * strength
      px[i] = Math.min(255, px[i] * k)
      px[i + 1] = Math.min(255, px[i + 1] * k)
      px[i + 2] = Math.min(255, px[i + 2] * k)
    }
  }
  ctx.putImageData(img, 0, 0)
}

// ---------- Where each kind of piece goes ----------

/** How much wider than the body a worn piece sits, by type. */
const EASE: Record<string, number> = {
  undershirt: 1.0, 'crop-top': 1.02, tshirt: 1.05, polo: 1.05, blouse: 1.06, kurti: 1.08, 'shirt-casual': 1.07, 'shirt-formal': 1.05,
  sweater: 1.1, sweatshirt: 1.12, hoodie: 1.14, cardigan: 1.12, waistcoat: 1.02, jacket: 1.14, blazer: 1.1, 'long-coat': 1.16,
  dress: 1.04, gown: 1.04, jumpsuit: 1.05, 'kurta-set': 1.08, 'suit-set': 1.1,
}

/** Garment measurements, in photo pixels. */
interface Measured {
  /** Shoulder seam to shoulder seam (tops) or waistband width (bottoms, skirts). */
  width: number
  /** The y of that line in the photo. */
  lineY: number
  /** Centre x of that line in the photo. */
  cx: number
  /** Half-width of the body of the garment just below the armpits (tops only). */
  chestHalf?: number
  chestY?: number
}

function measureTop(img: ImageData): Measured | null {
  const { bin, scale } = binFromAlpha(img)
  const m = topMarks(bin)
  if (!m) return null
  const S = (v: number) => v / scale
  const width = S(m.shoulderR[0] - m.shoulderL[0])
  if (width < img.width * 0.15) return null
  return {
    width,
    lineY: S((m.shoulderL[1] + m.shoulderR[1]) / 2),
    cx: S((m.shoulderL[0] + m.shoulderR[0]) / 2),
    chestHalf: S(m.chestR - m.chestL) / 2,
    chestY: S(m.chestY),
  }
}

function measureBottom(img: ImageData): Measured | null {
  const { bin, scale } = binFromAlpha(img)
  const m = bottomMarks(bin) ?? skirtMarks(bin)
  if (!m) return null
  const S = (v: number) => v / scale
  const width = S(m.waistR[0] - m.waistL[0])
  if (width < img.width * 0.2) return null
  return { width, lineY: S(m.waistL[1]), cx: S((m.waistL[0] + m.waistR[0]) / 2) }
}

/** Fallback when the shape cannot be read: the width of the piece a little below its top. */
function measureFallback(img: ImageData, fromTop: number): Measured {
  const { bin, scale } = binFromAlpha(img)
  let top = -1
  let bottom = -1
  for (let y = 0; y < bin.h; y++) {
    let any = false
    for (let x = 0; x < bin.w; x++) if (bin.d[y * bin.w + x]) any = true
    if (any) {
      if (top < 0) top = y
      bottom = y
    }
  }
  const y = Math.round(top + (bottom - top) * fromTop)
  let l = bin.w
  let r = -1
  for (let x = 0; x < bin.w; x++) {
    if (bin.d[y * bin.w + x]) {
      l = Math.min(l, x)
      r = Math.max(r, x)
    }
  }
  if (r < 0) return { width: img.width, lineY: 0, cx: img.width / 2 }
  return { width: (r - l) / scale, lineY: y / scale, cx: (l + r) / 2 / scale }
}

const FULL_LENGTH = new Set(['jeans', 'trousers-casual', 'trousers-formal', 'leggings'])

/** Scale and position (in mannequin pixels) for the whole photo. */
function place(img: ImageData, sub: string, rig: Rig): Box {
  const kind = garmentKind(sub)
  const c = rig.c
  const shL = rig.p('shoulderL')
  const shR = rig.p('shoulderR')
  const fit = (m: Measured, targetWidth: number, lineY: number): Box => {
    const s = targetWidth / Math.max(1, m.width)
    return { x: c - m.cx * s, y: lineY - m.lineY * s, w: img.width * s, h: img.height * s }
  }

  if (kind === 'top') {
    const m = measureTop(img) ?? measureFallback(img, 0.12)
    const ease = EASE[sub] ?? 1.08
    const shoulderY = shL[1] - 0.004 * MANNEQUIN_H
    let box = fit(m, (shR[0] - shL[0]) * ease, shoulderY)
    // the body of the garment must at least cover the body underneath
    if (m.chestHalf && m.chestY !== undefined) {
      const s = box.w / img.width
      const need = rig.bodyHalf(box.y + m.chestY * s) * 1.04
      if (m.chestHalf * s < need) box = fit(m, (shR[0] - shL[0]) * ease * (need / (m.chestHalf * s)), shoulderY)
    }
    return box
  }

  if (kind === 'bottom' || kind === 'skirt') {
    const m = measureBottom(img) ?? measureFallback(img, 0.04)
    const waistY = rig.y('hipsY') - (rig.y('hipsY') - rig.y('waistY')) * 0.45
    const width = rig.bodyHalf(waistY) * 2 * (sub === 'leggings' ? 1.0 : 1.06)
    let box = fit(m, width, waistY)
    if (FULL_LENGTH.has(sub)) {
      // full-length trousers reach the ankle; the photo may be a shorter cut, so only lengthen a little
      const ankle = rig.p('ankleL')[1]
      const hem = box.y + box.h
      if (hem < ankle - 0.02 * MANNEQUIN_H) box = fit(m, width * Math.min(1.12, (ankle - box.y) / (hem - box.y)), waistY)
    }
    return box
  }

  // shoes and accessories
  const ar = img.width / img.height
  const span = shR[0] - shL[0]
  const byWidth = (w: number, cx: number, top: number): Box => ({ x: cx - w / 2, y: top, w, h: w / ar })
  switch (kind) {
    case 'shoes': {
      const w = (rig.p('ankleR')[0] - rig.p('ankleL')[0]) * 1.9
      return { x: c - w / 2, y: rig.y('footY') + 14 - w / ar, w, h: w / ar }
    }
    case 'cap': {
      const w = rig.headHalf * 2 * 1.45
      return byWidth(w, c, rig.p('headTop')[1] - (w / ar) * 0.18)
    }
    case 'belt': {
      const y = (rig.y('waistY') + rig.y('hipsY')) / 2
      const w = rig.bodyHalf(y) * 2 * 1.08
      const h = Math.min(w / ar, 40)
      return { x: c - w / 2, y: y - h / 2, w, h }
    }
    case 'tie': {
      const n = rig.p('neckL')
      const h = (rig.y('waistY') - n[1]) * 0.95
      return { x: c - (h * ar) / 2, y: n[1] + 4, w: h * ar, h }
    }
    case 'scarf':
      return byWidth(span * 0.62, c, rig.p('neckL')[1] - 8)
    case 'bag': {
      const wr = rig.p('wristR')
      const w = span * 0.5
      return byWidth(w, wr[0] + w * 0.15, wr[1] - (w / ar) * 0.25)
    }
    default:
      return byWidth(span * 1.25, c, rig.p('neckL')[1] - 6)
  }
}

/**
 * Seen from the front, the mannequin's neck and head are in front of the inside back of a collar or hood,
 * and of anything a hanging photo shows there (the hanger, its hook, the brand label). Those pixels are
 * made see-through so the neck shows, as it would on a person. Nothing else of the photo changes.
 */
function showNeck(canvas: HTMLCanvasElement, box: Box, rig: Rig) {
  const neckL = rig.p('neckL')
  const neckR = rig.p('neckR')
  const head = rig.p('headCenter')
  const top = rig.p('headTop')
  const neckBase = neckL[1] + 0.004 * MANNEQUIN_H
  const neckHalf = ((neckR[0] - neckL[0]) / 2) * 0.9
  const chin = head[1] + (head[1] - top[1]) * 0.95
  const feather = 0.004 * MANNEQUIN_H
  const sx = box.w / canvas.width
  const ctx = ctx2d(canvas)
  const dip = 0.007 * MANNEQUIN_H // the neck meets the chest in a soft curve, lowest in the middle
  const rows = Math.min(canvas.height, Math.ceil((neckBase + dip + feather - box.y) / (box.h / canvas.height)))
  if (rows <= 0) return
  const img = ctx.getImageData(0, 0, canvas.width, rows)
  const px = img.data
  for (let y = 0; y < rows; y++) {
    const my = box.y + (y + 0.5) * (box.h / canvas.height)
    // neck width below the chin, head width above it, blended over the jaw
    const t = Math.max(0, Math.min(1, (my - (chin - 0.02 * MANNEQUIN_H)) / (0.03 * MANNEQUIN_H)))
    const half = rig.headHalf * (1 - t) + neckHalf * t
    for (let x = 0; x < canvas.width; x++) {
      const mx = box.x + (x + 0.5) * sx
      const d = Math.min(1, Math.abs(mx - rig.c) / neckHalf)
      const vy = Math.max(0, Math.min(1, (neckBase + dip * (1 - d * d) - my) / feather)) // fades out at the neck base
      const hx = Math.max(0, Math.min(1, (half - Math.abs(mx - rig.c)) / feather))
      const k = hx * vy
      if (k <= 0) continue
      const i = (y * canvas.width + x) * 4 + 3
      px[i] = Math.round(px[i] * (1 - k))
    }
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Places the real cut-out (transparent background, upright) on a mannequin.
 * Returns the picture to overlay and where it sits, as fractions of the mannequin picture.
 */
export async function fitGarment(img: ImageData, subCategory: string, gender: MannequinGender, view: View): Promise<FitResult> {
  const rig = getRig(gender)
  const b = place(img, subCategory, rig)
  const box: Box = { x: Math.round(b.x), y: Math.round(b.y), w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)) }
  const src = makeCanvas(img.width, img.height)
  ctx2d(src).putImageData(img, 0, 0)
  const canvas = makeCanvas(box.w, box.h)
  ctx2d(canvas).drawImage(src, 0, 0, box.w, box.h)

  const kind = garmentKind(subCategory)
  if (kind === 'top' && view === 'front') showNeck(canvas, box, rig)
  const shade = await getShade(gender, view)
  if (shade) shadeCanvas(canvas, shade, box.x, box.y, kind === 'top' || kind === 'bottom' || kind === 'skirt' ? 0.4 : 0.2)

  return { canvas, rect: { x: box.x / MANNEQUIN_W, y: box.y / MANNEQUIN_H, w: box.w / MANNEQUIN_W, h: box.h / MANNEQUIN_H } }
}
