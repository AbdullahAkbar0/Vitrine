// Turns a garment cut-out into a "digital garment": its exact fabric colour, its print lifted off the
// photo (logos, text, artwork), and its measurements (sleeve length, body length, neckline...).
// The app then rebuilds the piece from a clean template instead of using the crumpled photo.
import { garmentKind } from '../../config/fitRules'
import { ctx2d, makeCanvas } from '../image'
import { binFromAlpha, bottomMarks, skirtMarks, topMarks, type BottomMarks, type SkirtMarks, type TopMarks } from './analyze'
import type { Pt } from './tps'

export type RGB = [number, number, number]

export interface TopParams {
  shHalf: number // shoulder half-width (unit: chest half-width)
  shRise: number // armpit up to shoulder
  neckHalf: number
  neckDip: number
  bodyLen: number // armpit down to hem
  hemHalf: number
  sleeveLen: number // 0 = sleeveless
  cuffHalf: number
}
export interface BottomParams {
  waistHalf: number // unit: hip half-width
  rise: number
  legLen: number
  kneeHalf: number
  hemHalf: number
}
export interface SkirtParams {
  len: number // unit: waist half-width
  hemHalf: number
}

export interface Digital {
  kind: 'top' | 'bottom' | 'skirt'
  sub: string
  src: ImageData
  color: RGB
  /** One plain fabric colour (prints allowed) — or false for stripes, checks and other all-over patterns. */
  solid: boolean
  /** The print lifted from the photo: same size as `src`, transparent where there is only fabric. */
  print: HTMLCanvasElement | null
  top?: { m: TopMarks; p: TopParams; u: number; cx: number; apY: number }
  bottom?: { m: BottomMarks; p: BottomParams; u: number; cx: number; crY: number }
  skirt?: { m: SkirtMarks; p: SkirtParams; u: number; cx: number; wY: number }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

function rgb2lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    v /= 255
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047)
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722)
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

const smooth = (v: number, a: number, b: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ---------- Fabric and print ----------

interface FabricResult {
  color: RGB
  solid: boolean
  print: HTMLCanvasElement | null
}

/**
 * Finds the fabric colour and separates the print from the fabric.
 * `region` (same size as the small analysis image) marks where to look: the body of the garment.
 */
function analyseFabric(src: ImageData, poly: Pt[] | null, minY: number): FabricResult {
  const k = Math.min(1, 520 / Math.max(src.width, src.height))
  const w = Math.max(2, Math.round(src.width * k))
  const h = Math.max(2, Math.round(src.height * k))
  const full = makeCanvas(src.width, src.height)
  ctx2d(full).putImageData(src, 0, 0)
  const small = makeCanvas(w, h)
  ctx2d(small).drawImage(full, 0, 0, w, h)
  const px = ctx2d(small).getImageData(0, 0, w, h).data

  // where to look: inside the body outline, pulled in from the edges (seams and edge shadows are not prints)
  const rc = makeCanvas(w, h)
  const rx = ctx2d(rc)
  const erode = Math.max(2, w * 0.022)
  if (poly) {
    rx.beginPath()
    poly.forEach(([x, y], i) => (i ? rx.lineTo(x * k, y * k) : rx.moveTo(x * k, y * k)))
    rx.closePath()
    rx.fillStyle = '#000'
    rx.fill()
  } else rx.drawImage(small, 0, 0)
  rx.globalCompositeOperation = 'destination-in'
  rx.drawImage(small, 0, 0)
  const ra = rx.getImageData(0, 0, w, h).data
  const solidA = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) solidA[i] = ra[i * 4 + 3] > 200 && px[i * 4 + 3] > 200 ? 1 : 0
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && solidA[y * w + x] === 1
  const e = Math.round(erode)
  const region = new Uint8Array(w * h)
  const my = minY * k
  let area = 0
  for (let y = 0; y < h; y++) {
    if (y < my) continue
    for (let x = 0; x < w; x++) {
      if (inside(x, y) && inside(x - e, y) && inside(x + e, y) && inside(x, y - e) && inside(x, y + e)) {
        region[y * w + x] = 1
        area++
      }
    }
  }
  if (area < 200) return { color: [128, 128, 128], solid: false, print: null }

  // fabric colour = the most common colour in the region
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < w * h; i++) {
    if (!region[i]) continue
    const r = px[i * 4]
    const g = px[i * 4 + 1]
    const b = px[i * 4 + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bin.n++
    bin.r += r
    bin.g += g
    bin.b += b
    bins.set(key, bin)
  }
  let best = { n: 0, r: 0, g: 0, b: 0 }
  let bestScore = -1
  for (const [key, bin] of bins) {
    let score = bin.n
    for (const dk of [1, 16, 256]) score += ((bins.get(key + dk)?.n ?? 0) + (bins.get(key - dk)?.n ?? 0)) * 0.5
    if (score > bestScore) {
      bestScore = score
      best = bin
    }
  }
  const base: RGB = [best.r / best.n, best.g / best.n, best.b / best.n]
  const [bL, bA, bB] = rgb2lab(...base)

  // Lab for every pixel in the region
  const L = new Float32Array(w * h)
  const A = new Float32Array(w * h)
  const B = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    if (!region[i]) continue
    const lab = rgb2lab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
    L[i] = lab[0]
    A[i] = lab[1]
    B[i] = lab[2]
  }
  // shading changes brightness but keeps the hue: expected chroma scales with brightness
  const chromaOff = (i: number) => {
    const s = clamp(L[i] / Math.max(8, bL), 0.35, 1.6)
    return Math.hypot(A[i] - bA * s, B[i] - bB * s)
  }
  // pass 1: rough fabric, to learn the local lighting (soft shadows, wrinkles)
  const S = new Float64Array((w + 1) * (h + 1))
  const C = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rs = 0
    let rcnt = 0
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (region[i] && Math.abs(L[i] - bL) < 30 && chromaOff(i) < 16) {
        rs += L[i]
        rcnt++
      }
      S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + rs
      C[(y + 1) * (w + 1) + x + 1] = C[y * (w + 1) + x + 1] + rcnt
    }
  }
  // the fabric colour to rebuild with: the fabric where it is well lit (not its shadowed average)
  const hist = new Uint32Array(101)
  let fabN = 0
  for (let i = 0; i < w * h; i++) {
    if (region[i] && Math.abs(L[i] - bL) < 30 && chromaOff(i) < 16) {
      hist[clamp(Math.round(L[i]), 0, 100)]++
      fabN++
    }
  }
  const pct = (q: number) => {
    let acc = 0
    for (let v = 0; v <= 100; v++) {
      acc += hist[v]
      if (acc >= fabN * q) return v
    }
    return 100
  }
  const lo = pct(0.6)
  const hi = pct(0.93)
  let lr = 0
  let lg = 0
  let lb = 0
  let ln = 0
  for (let i = 0; i < w * h; i++) {
    if (region[i] && L[i] >= lo && L[i] <= hi && Math.abs(L[i] - bL) < 30 && chromaOff(i) < 16) {
      lr += px[i * 4]
      lg += px[i * 4 + 1]
      lb += px[i * 4 + 2]
      ln++
    }
  }
  const lit: RGB = ln > 50 ? [lr / ln, lg / ln, lb / ln] : base
  const litL = rgb2lab(...lit)[0]
  const rad = Math.max(4, Math.round(w * 0.07))
  const boxAt = (T: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    T[y1 * (w + 1) + x1] - T[y0 * (w + 1) + x1] - T[y1 * (w + 1) + x0] + T[y0 * (w + 1) + x0]
  // pass 2: print = clearly different hue, or far brighter/darker than the fabric around it
  const matte = new Float32Array(w * h)
  const gain = new Float32Array(w * h).fill(1) // how much to brighten a print pixel that sits in shadow
  const Yof = (l: number) => ((Math.max(0, l) + 16) / 116) ** 3
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!region[i]) continue
      const x0 = Math.max(0, x - rad)
      const y0 = Math.max(0, y - rad)
      const x1 = Math.min(w, x + rad + 1)
      const y1 = Math.min(h, y + rad + 1)
      const cnt = boxAt(C, x0, y0, x1, y1)
      const localL = cnt > 12 ? boxAt(S, x0, y0, x1, y1) / cnt : bL
      matte[i] = Math.max(smooth(chromaOff(i), 9, 18), smooth(Math.abs(L[i] - localL), 18, 32))
      gain[i] = clamp(Yof(Math.max(litL, 12)) / Yof(Math.max(localL, 12)), 0.8, 1.8)
    }
  }
  // drop specks
  const label = new Int32Array(w * h)
  const stack: number[] = []
  let next = 1
  const minSize = Math.max(8, area * 0.00025)
  for (let i = 0; i < w * h; i++) {
    if (matte[i] <= 0.5 || label[i]) continue
    const members: number[] = []
    stack.push(i)
    label[i] = next
    while (stack.length) {
      const p = stack.pop()!
      members.push(p)
      const x = p % w
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < w * h && matte[q] > 0.5 && !label[q]) {
          label[q] = next
          stack.push(q)
        }
      }
    }
    if (members.length < minSize) for (const p of members) matte[p] = 0
    next++
  }
  for (let i = 0; i < w * h; i++) if (matte[i] <= 0.5 && matte[i] > 0) matte[i] *= label[i] ? 1 : 0.6

  // how much is print, and does it reach the edges everywhere (an all-over pattern)?
  let printN = 0
  let bandN = 0
  let bandPrint = 0
  const band = Math.max(3, Math.round(w * 0.05))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!region[i]) continue
      const isPrint = matte[i] > 0.5
      if (isPrint) printN++
      if (!(region[i - band] && region[i + band])) {
        bandN++
        if (isPrint) bandPrint++
      }
    }
  }
  const printFrac = printN / area
  const solid = printFrac < 0.45 && (bandN < 50 || bandPrint / bandN < 0.12)
  if (!solid) return { color: lit.map(Math.round) as RGB, solid: false, print: null }
  if (printFrac < 0.002) return { color: lit.map(Math.round) as RGB, solid: true, print: null }

  // full-size print layer: the photo's own pixels, kept only where the print is
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height)
  const at = (x: number, y: number) => matte[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)]
  for (let y = 0; y < src.height; y++) {
    const fy = y * k - 0.5
    const y0 = Math.floor(fy)
    const ty = fy - y0
    for (let x = 0; x < src.width; x++) {
      const fx = x * k - 0.5
      const x0 = Math.floor(fx)
      const tx = fx - x0
      const m =
        (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
      const o = (y * src.width + x) * 4
      const a = smooth(m, 0.3, 0.7)
      out.data[o + 3] = Math.round(out.data[o + 3] * a)
      if (a > 0) {
        const gn = gain[clamp(Math.round(fy), 0, h - 1) * w + clamp(Math.round(fx), 0, w - 1)]
        if (gn !== 1) {
          const gk = Math.pow(gn, 1 / 2.2)
          out.data[o] = Math.min(255, out.data[o] * gk)
          out.data[o + 1] = Math.min(255, out.data[o + 1] * gk)
          out.data[o + 2] = Math.min(255, out.data[o + 2] * gk)
        }
      }
    }
  }
  const pc = makeCanvas(src.width, src.height)
  ctx2d(pc).putImageData(out, 0, 0)
  return { color: lit.map(Math.round) as RGB, solid: true, print: pc }
}

// ---------- Measurements ----------

const SHORT = new Set(['tshirt', 'polo', 'crop-top'])
const LONG = new Set(['shirt-formal', 'sweater', 'hoodie', 'sweatshirt', 'jacket', 'blazer', 'long-coat', 'cardigan'])
const SLEEVELESS_OK = new Set(['undershirt', 'waistcoat', 'dress', 'gown', 'jumpsuit', 'blouse', 'kurti', 'crop-top'])

const cache = new WeakMap<ImageData, Map<string, Digital | null>>()

/** Reads a cut-out (upright, transparent background) and describes it as a digital garment. */
export function digitize(src: ImageData, sub: string): Digital | null {
  let per = cache.get(src)
  if (!per) cache.set(src, (per = new Map()))
  if (per.has(sub)) return per.get(sub)!
  const result = build(src, sub)
  per.set(sub, result)
  return result
}

function build(src: ImageData, sub: string): Digital | null {
  const kind = garmentKind(sub)
  if (kind !== 'top' && kind !== 'bottom' && kind !== 'skirt') return null
  const { bin, scale } = binFromAlpha(src)
  const S = (p: Pt): Pt => [p[0] / scale, p[1] / scale]

  if (kind === 'top') {
    const b = topMarks(bin)
    if (!b) return null
    const sl = (s?: { outer: Pt; inner: Pt; root: Pt }) => (s ? { outer: S(s.outer), inner: S(s.inner), root: S(s.root) } : undefined)
    const m: TopMarks = {
      neckL: S(b.neckL), neckR: S(b.neckR), neckC: S(b.neckC),
      shoulderL: S(b.shoulderL), shoulderR: S(b.shoulderR),
      armpitL: S(b.armpitL), armpitR: S(b.armpitR),
      sideL: b.sideL.map(S), sideR: b.sideR.map(S),
      hemL: S(b.hemL), hemR: S(b.hemR),
      chestY: b.chestY / scale, chestL: b.chestL / scale, chestR: b.chestR / scale,
      sleeveL: sl(b.sleeveL), sleeveR: sl(b.sleeveR),
    }
    const u = Math.max(8, (m.armpitR[0] - m.armpitL[0]) / 2)
    const cx = (m.armpitL[0] + m.armpitR[0]) / 2
    const apY = m.armpitL[1]
    const neckY = (m.neckL[1] + m.neckR[1]) / 2
    let sleeveLen = 0
    let cuffHalf = 0.4
    const sls = [m.sleeveL, m.sleeveR].filter((x): x is NonNullable<typeof x> => !!x)
    if (sls.length) {
      const roots: Pt[] = [mid(m.shoulderL, m.armpitL), mid(m.shoulderR, m.armpitR)]
      const lens = sls.map((s, i) => dist(mid(s.outer, s.inner), m.sleeveL && i === 0 ? roots[0] : roots[1]) / u)
      sleeveLen = Math.max(...lens) // a crumpled sleeve reads short; trust the longer one
      cuffHalf = clamp(Math.max(...sls.map((s) => dist(s.outer, s.inner) / 2 / u)), 0.24, 0.62)
    }
    if (SHORT.has(sub)) sleeveLen = sleeveLen ? clamp(sleeveLen, 0.55, 1.0) : sub === 'crop-top' ? 0 : 0.72
    else if (LONG.has(sub)) sleeveLen = sleeveLen < 1.3 ? 2.25 : clamp(sleeveLen, 1.7, 2.6)
    else if (!sleeveLen) sleeveLen = SLEEVELESS_OK.has(sub) ? 0 : 0.72
    else sleeveLen = clamp(sleeveLen, 0.45, 2.6)
    if (sleeveLen > 1.3) cuffHalf = clamp(cuffHalf, 0.2, 0.34)
    else if (sleeveLen > 0) cuffHalf = clamp(cuffHalf, 0.34, 0.56)
    const p: TopParams = {
      shHalf: clamp((m.shoulderR[0] - m.shoulderL[0]) / 2 / u, 0.86, 1.1),
      shRise: clamp((apY - (m.shoulderL[1] + m.shoulderR[1]) / 2) / u, 0.62, 1.0),
      neckHalf: clamp((m.neckR[0] - m.neckL[0]) / 2 / u, 0.3, 0.46),
      neckDip: clamp((m.neckC[1] - neckY) / u, 0.12, 0.95),
      bodyLen: clamp((m.hemL[1] - apY) / u, 0.6, 5.2),
      hemHalf: clamp((m.hemR[0] - m.hemL[0]) / 2 / u, 0.85, 2.4),
      sleeveLen,
      cuffHalf,
    }
    const poly: Pt[] = [m.neckL, m.shoulderL, m.armpitL, ...m.sideL, m.hemL, m.hemR, ...[...m.sideR].reverse(), m.armpitR, m.shoulderR, m.neckR]
    const fab = analyseFabric(src, poly, m.neckC[1] + u * 0.1)
    return { kind, sub, src, ...fab, top: { m, p, u, cx, apY } }
  }

  if (kind === 'bottom') {
    const b = bottomMarks(bin)
    if (b) {
      const leg = (l: BottomMarks['legL']) => ({ outer: S(l.outer), inner: S(l.inner), kneeOuter: S(l.kneeOuter), kneeInner: S(l.kneeInner) })
      const m: BottomMarks = {
        waistL: S(b.waistL), waistR: S(b.waistR), hipL: S(b.hipL), hipR: S(b.hipR), crotch: S(b.crotch),
        midL: S(b.midL), midR: S(b.midR), legL: leg(b.legL), legR: leg(b.legR),
      }
      const u = Math.max(8, (m.hipR[0] - m.hipL[0]) / 2)
      const hemY = Math.max(m.legL.outer[1], m.legR.outer[1])
      const p: BottomParams = {
        waistHalf: clamp((m.waistR[0] - m.waistL[0]) / 2 / u, 0.74, 1.0),
        rise: clamp((m.crotch[1] - m.waistL[1]) / u, 0.9, 1.8),
        legLen: clamp((hemY - m.crotch[1]) / u, 0.25, 4.4),
        kneeHalf: clamp((dist(m.legL.kneeOuter, m.legL.kneeInner) + dist(m.legR.kneeOuter, m.legR.kneeInner)) / 4 / u, 0.3, 0.6),
        hemHalf: clamp((dist(m.legL.outer, m.legL.inner) + dist(m.legR.outer, m.legR.inner)) / 4 / u, 0.22, 0.62),
      }
      const fab = analyseFabric(src, null, 0)
      return { kind, sub, src, color: fab.color, solid: fab.solid, print: null, bottom: { m, p, u, cx: m.crotch[0], crY: m.crotch[1] } }
    }
  }

  // skirts (and "bottoms" photographed with the legs together)
  const b = skirtMarks(bin)
  if (!b) return null
  const m: SkirtMarks = { waistL: S(b.waistL), waistR: S(b.waistR), hemL: S(b.hemL), hemR: S(b.hemR), midL: S(b.midL), midR: S(b.midR) }
  const u = Math.max(8, (m.waistR[0] - m.waistL[0]) / 2)
  const p: SkirtParams = {
    len: clamp((m.hemL[1] - m.waistL[1]) / u, 0.6, 6),
    hemHalf: clamp((m.hemR[0] - m.hemL[0]) / 2 / u, 1, 3),
  }
  const fab = analyseFabric(src, null, 0)
  return { kind: 'skirt', sub, src, color: fab.color, solid: fab.solid, print: null, skirt: { m, p, u, cx: (m.waistL[0] + m.waistR[0]) / 2, wY: m.waistL[1] } }
}
