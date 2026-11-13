// Reads the shape of a garment cut-out: which way is up, and where the collar, shoulders,
// armpits, sleeves, hem, waist, crotch and leg openings are.
import type { Pt } from './tps'

export interface Bin {
  w: number
  h: number
  d: Uint8Array // 1 = garment
}

export type Kind = 'top' | 'bottom' | 'skirt' | 'shoes' | 'cap' | 'belt' | 'tie' | 'scarf' | 'bag'

// ---------- Mask helpers ----------

/** A small black-and-white version of the cut-out (longest side ~360px) for fast measuring. */
export function binFromAlpha(img: ImageData, maxSide = 360): { bin: Bin; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const d = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y + 0.5) / scale))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x + 0.5) / scale))
      d[y * w + x] = img.data[(sy * img.width + sx) * 4 + 3] > 110 ? 1 : 0
    }
  }
  const bin = { w, h, d }
  keepLargest(bin)
  fillHoles(bin)
  return { bin, scale }
}

function keepLargest(b: Bin) {
  const label = new Int32Array(b.w * b.h)
  let best = 0
  let bestSize = 0
  let next = 1
  const stack: number[] = []
  for (let i = 0; i < b.d.length; i++) {
    if (!b.d[i] || label[i]) continue
    let size = 0
    stack.push(i)
    label[i] = next
    while (stack.length) {
      const p = stack.pop()!
      size++
      const x = p % b.w
      const y = (p - x) / b.w
      const nb = [x > 0 ? p - 1 : -1, x < b.w - 1 ? p + 1 : -1, y > 0 ? p - b.w : -1, y < b.h - 1 ? p + b.w : -1]
      for (const q of nb) {
        if (q >= 0 && b.d[q] && !label[q]) {
          label[q] = next
          stack.push(q)
        }
      }
    }
    if (size > bestSize) {
      bestSize = size
      best = next
    }
    next++
  }
  for (let i = 0; i < b.d.length; i++) b.d[i] = label[i] === best ? 1 : 0
}

function fillHoles(b: Bin) {
  const outside = new Uint8Array(b.w * b.h)
  const stack: number[] = []
  const push = (i: number) => {
    if (!b.d[i] && !outside[i]) {
      outside[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < b.w; x++) {
    push(x)
    push((b.h - 1) * b.w + x)
  }
  for (let y = 0; y < b.h; y++) {
    push(y * b.w)
    push(y * b.w + b.w - 1)
  }
  while (stack.length) {
    const p = stack.pop()!
    const x = p % b.w
    const y = (p - x) / b.w
    if (x > 0) push(p - 1)
    if (x < b.w - 1) push(p + 1)
    if (y > 0) push(p - b.w)
    if (y < b.h - 1) push(p + b.w)
  }
  for (let i = 0; i < b.d.length; i++) if (!outside[i]) b.d[i] = 1
}

/** Rotates a mask clockwise by quarter turns. */
export function rotateBin(b: Bin, quarter: number): Bin {
  quarter = ((quarter % 4) + 4) % 4
  if (quarter === 0) return b
  const w = quarter % 2 ? b.h : b.w
  const h = quarter % 2 ? b.w : b.h
  const d = new Uint8Array(w * h)
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const [nx, ny] = quarter === 1 ? [b.h - 1 - y, x] : quarter === 2 ? [b.w - 1 - x, b.h - 1 - y] : [y, b.w - 1 - x]
      d[ny * w + nx] = b.d[y * b.w + x]
    }
  }
  return { w, h, d }
}

interface Profile {
  top: number
  bottom: number
  xl: Float32Array
  xr: Float32Array
  runs: (y: number) => [number, number][]
}

function profile(b: Bin): Profile {
  const xl = new Float32Array(b.h).fill(-1)
  const xr = new Float32Array(b.h).fill(-1)
  let top = -1
  let bottom = -1
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.d[y * b.w + x]) {
        if (xl[y] < 0) xl[y] = x
        xr[y] = x
      }
    }
    if (xl[y] >= 0) {
      if (top < 0) top = y
      bottom = y
    }
  }
  const runs = (y: number) => {
    const out: [number, number][] = []
    let s = -1
    for (let x = 0; x < b.w; x++) {
      const v = b.d[y * b.w + x]
      if (v && s < 0) s = x
      if (!v && s >= 0) {
        out.push([s, x - 1])
        s = -1
      }
    }
    if (s >= 0) out.push([s, b.w - 1])
    return out
  }
  return { top, bottom, xl, xr, runs }
}

const topAt = (b: Bin, x: number) => {
  const xi = Math.max(0, Math.min(b.w - 1, Math.round(x)))
  for (let y = 0; y < b.h; y++) if (b.d[y * b.w + xi]) return y
  return b.h
}

// ---------- Which way is up? ----------

/** Centre line of the garment, and the width of the solid run through it on a given row. */
function centreRunWidth(p: Profile, y: number, cx: number): number {
  const rs = p.runs(Math.round(y))
  const r = rs.find((q) => q[0] <= cx && cx <= q[1])
  return r ? r[1] - r[0] : 0
}

function centreX(p: Profile): number {
  const mids: number[] = []
  for (let y = p.top; y <= p.bottom; y++) if (p.xl[y] >= 0) mids.push((p.xl[y] + p.xr[y]) / 2)
  mids.sort((a, b) => a - b)
  return mids[Math.floor(mids.length / 2)] ?? 0
}

/** How deep the notch is in the middle of the top edge (a neckline), as a share of the height. */
function neckDip(b: Bin, p: Profile): number {
  const H = p.bottom - p.top
  const cx = centreX(p)
  // width of the shoulder line just below the top, through the centre
  const span = centreRunWidth(p, p.top + H * 0.06, cx)
  if (!span) return 0
  const centre = topAt(b, cx)
  let side = Infinity
  for (const f of [0.14, 0.2, 0.26]) side = Math.min(side, topAt(b, cx - span * f), topAt(b, cx + span * f))
  return Math.max(0, (centre - side) / Math.max(1, H))
}

/** How far the gap between two trouser legs reaches up from the bottom edge, as a share of the height. */
function legGap(p: Profile): number {
  const H = p.bottom - p.top
  let y = p.bottom - Math.round(H * 0.04)
  let gapRows = 0
  for (; y > p.top; y--) {
    const rs = p.runs(y).filter((r) => r[1] - r[0] > 2)
    if (rs.length >= 2) gapRows++
    else break
  }
  return gapRows / Math.max(1, H)
}

function widthIn(p: Profile, from: number, to: number) {
  let max = 0
  for (let y = Math.round(from); y <= Math.round(to); y++) if (p.xl[y] >= 0) max = Math.max(max, p.xr[y] - p.xl[y])
  return max
}

/** Score for "this rotation is upright", per kind of garment. */
function uprightScore(b: Bin, kind: Kind, group: string): number {
  const p = profile(b)
  if (p.top < 0) return -Infinity
  const H = p.bottom - p.top
  if (kind === 'bottom') return legGap(p) * 3 - legGap(profile(rotateBin(b, 2)))
  if (kind === 'skirt') {
    return (widthIn(p, p.bottom - H * 0.1, p.bottom) - widthIn(p, p.top, p.top + H * 0.1)) / Math.max(1, b.w)
  }
  // tops and dresses: a neckline notch at the top, and the shoulder end is wider than the hem end
  // (sleeves join the body at the shoulders, wherever their cuffs end up)
  const maxW = widthIn(p, p.top, p.bottom) || 1
  const cx = centreX(p)
  let upper = 0
  let lower = 0
  for (let f = 0.1; f <= 0.25; f += 0.03) {
    upper += centreRunWidth(p, p.top + H * f, cx)
    lower += centreRunWidth(p, p.bottom - H * f, cx)
  }
  upper /= 6
  lower /= 6
  const dip = neckDip(b, p)
  if (group === 'fullbody') {
    const narrowTop = (widthIn(p, p.bottom - H * 0.1, p.bottom) - widthIn(p, p.top, p.top + H * 0.1)) / maxW
    return dip * 4 + narrowTop
  }
  return (upper - lower) / maxW + dip * 4
}

/** Quarter turns (clockwise) that make the garment upright. 0 when unsure. */
export function detectRotation(b: Bin, kind: Kind, group: string): number {
  if (!['top', 'bottom', 'skirt'].includes(kind)) return 0
  const scores = [0, 1, 2, 3].map((q) => uprightScore(rotateBin(b, q), kind, group))
  let best = 0
  for (let q = 1; q < 4; q++) if (scores[q] > scores[best]) best = q
  // only turn when clearly better than leaving it as it is
  return scores[best] - scores[0] > 0.08 ? best : 0
}

// ---------- Landmarks ----------

export interface TopMarks {
  neckL: Pt
  neckR: Pt
  neckC: Pt
  shoulderL: Pt
  shoulderR: Pt
  armpitL: Pt
  armpitR: Pt
  sideL: Pt[]
  sideR: Pt[]
  hemL: Pt
  hemR: Pt
  chestY: number
  chestL: number
  chestR: number
  sleeveL?: { outer: Pt; inner: Pt; root: Pt }
  sleeveR?: { outer: Pt; inner: Pt; root: Pt }
}

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

export function topMarks(b: Bin): TopMarks | null {
  const p = profile(b)
  if (p.top < 0) return null
  const H = p.bottom - p.top
  if (H < 20) return null

  // centre line of the garment, from the lower half (where it is just the body)
  const mids: number[] = []
  for (let y = p.top + Math.round(H * 0.55); y < p.bottom; y++) if (p.xl[y] >= 0) mids.push((p.xl[y] + p.xr[y]) / 2)
  const cx = median(mids)

  // torso edges per row = the solid run that contains the centre line (sleeves hanging beside it are separate)
  const cl = new Float32Array(b.h).fill(-1)
  const cr = new Float32Array(b.h).fill(-1)
  for (let y = p.top; y <= p.bottom; y++) {
    const rs = p.runs(y)
    let r = rs.find((q) => q[0] <= cx && cx <= q[1])
    if (!r && rs.length) r = rs.reduce((a, q) => (Math.abs((q[0] + q[1]) / 2 - cx) < Math.abs((a[0] + a[1]) / 2 - cx) ? q : a))
    if (r) {
      cl[y] = r[0]
      cr[y] = r[1]
    }
  }
  const sm = (arr: Float32Array, y: number) => {
    const vals: number[] = []
    for (let k = -2; k <= 2; k++) {
      const v = arr[Math.max(p.top, Math.min(p.bottom, y + k))]
      if (v >= 0) vals.push(v)
    }
    return vals.length ? median(vals) : cx
  }

  // Walk up from the lower body; the armpit is where the torso outline suddenly steps outwards.
  const start = p.bottom - Math.round(H * 0.3)
  const torsoW = median(Array.from({ length: 10 }, (_, i) => sm(cr, start + i) - sm(cl, start + i)))
  const findArmpit = (side: 'L' | 'R'): Pt | null => {
    const arr = side === 'L' ? cl : cr
    let base = sm(arr, start)
    for (let y = start; y > p.top + H * 0.08; y--) {
      const v = sm(arr, y)
      const out = side === 'L' ? base - v : v - base
      if (out > torsoW * 0.09) {
        let ok = true
        for (let k = 1; k <= 3; k++) {
          const v2 = sm(arr, y - k)
          if ((side === 'L' ? base - v2 : v2 - base) < torsoW * 0.07) ok = false
        }
        if (ok) return [base, y + 1]
      }
      base = base * 0.8 + v * 0.2 // follow gentle tapering of the body
    }
    return null
  }

  let aL = findArmpit('L')
  let aR = findArmpit('R')
  const sleeveless = !aL || !aR
  const fallbackY = p.top + Math.round(H * 0.3)
  if (!aL) aL = [sm(cl, fallbackY), fallbackY]
  if (!aR) aR = [sm(cr, fallbackY), fallbackY]
  const ay = Math.round((aL[1] + aR[1]) / 2)
  aL = [aL[0], ay]
  aR = [aR[0], ay]

  const inset = (aR[0] - aL[0]) * 0.04
  const sLx = aL[0] + inset
  const sRx = aR[0] - inset
  const shoulderL: Pt = [sLx, topAt(b, sLx)]
  const shoulderR: Pt = [sRx, topAt(b, sRx)]

  // neckline
  const span = sRx - sLx
  const ncx = (sLx + sRx) / 2
  let nL: Pt = [ncx - span * 0.18, topAt(b, ncx - span * 0.18)]
  let nR: Pt = [ncx + span * 0.18, topAt(b, ncx + span * 0.18)]
  for (let x = sLx + span * 0.12; x < ncx - span * 0.04; x++) {
    const y = topAt(b, x)
    if (y < nL[1]) nL = [x, y]
  }
  for (let x = sRx - span * 0.12; x > ncx + span * 0.04; x--) {
    const y = topAt(b, x)
    if (y < nR[1]) nR = [x, y]
  }
  const neckC: Pt = [ncx, Math.max(topAt(b, ncx), Math.min(nL[1], nR[1]))]

  const hemY = p.bottom - Math.max(1, Math.round(H * 0.012))
  const hemL: Pt = [sm(cl, hemY), hemY]
  const hemR: Pt = [sm(cr, hemY), hemY]

  // sleeves: everything outside the torso (above the armpit: beyond the armpit; below: beyond the side seam)
  const sleeve = (side: 'L' | 'R', armpit: Pt, shoulder: Pt, hem: Pt) => {
    if (sleeveless) return undefined
    const root: Pt = [(armpit[0] + shoulder[0]) / 2, (armpit[1] + shoulder[1]) / 2]
    const pts: Pt[] = []
    for (let y = p.top; y <= p.bottom; y++) {
      let limit: number
      if (y <= armpit[1] + 2) limit = armpit[0]
      else {
        const t = (y - armpit[1]) / Math.max(1, hem[1] - armpit[1])
        limit = armpit[0] + (hem[0] - armpit[0]) * Math.min(1, t)
      }
      for (let x = 0; x < b.w; x++) {
        if (!b.d[y * b.w + x]) continue
        if (side === 'L' ? x < limit - 3 : x > limit + 3) pts.push([x, y])
      }
    }
    if (pts.length < 30) return undefined
    let tip = pts[0]
    let best = -1
    for (const q of pts) {
      const d = (q[0] - root[0]) ** 2 + (q[1] - root[1]) ** 2
      if (d > best) {
        best = d
        tip = q
      }
    }
    const len = Math.sqrt(best)
    const u: Pt = [(tip[0] - root[0]) / len, (tip[1] - root[1]) / len]
    const v: Pt = [-u[1], u[0]]
    let minV = Infinity
    let maxV = -Infinity
    let a: Pt = tip
    let c: Pt = tip
    for (const q of pts) {
      const pr = (q[0] - root[0]) * u[0] + (q[1] - root[1]) * u[1]
      if (pr < len * 0.9) continue
      const pv = (q[0] - root[0]) * v[0] + (q[1] - root[1]) * v[1]
      if (pv < minV) {
        minV = pv
        a = q
      }
      if (pv > maxV) {
        maxV = pv
        c = q
      }
    }
    const sv = (shoulder[0] - root[0]) * v[0] + (shoulder[1] - root[1]) * v[1]
    return { outer: sv > 0 ? c : a, inner: sv > 0 ? a : c, root }
  }

  const sides = [0.3, 0.62].map((f) => Math.round(ay + (hemY - ay) * f))
  const chestY = Math.min(hemY - 2, ay + Math.round(H * 0.05))
  return {
    neckL: nL,
    neckR: nR,
    neckC,
    shoulderL,
    shoulderR,
    armpitL: aL,
    armpitR: aR,
    sideL: sides.map((y) => [sm(cl, y), y] as Pt),
    sideR: sides.map((y) => [sm(cr, y), y] as Pt),
    hemL,
    hemR,
    chestY,
    chestL: sm(cl, chestY),
    chestR: sm(cr, chestY),
    sleeveL: sleeve('L', aL, shoulderL, hemL),
    sleeveR: sleeve('R', aR, shoulderR, hemR),
  }
}

export interface BottomMarks {
  waistL: Pt
  waistR: Pt
  hipL: Pt
  hipR: Pt
  crotch: Pt
  midL: Pt
  midR: Pt
  legL: { outer: Pt; inner: Pt; kneeOuter: Pt; kneeInner: Pt }
  legR: { outer: Pt; inner: Pt; kneeOuter: Pt; kneeInner: Pt }
}

export function bottomMarks(b: Bin): BottomMarks | null {
  const p = profile(b)
  if (p.top < 0) return null
  const H = p.bottom - p.top
  // find the crotch: walking up from the hems while two legs are separate
  let y = p.bottom - Math.round(H * 0.04)
  let crotchY = -1
  for (; y > p.top; y--) {
    const rs = p.runs(y).filter((r) => r[1] - r[0] > 2)
    if (rs.length < 2) {
      crotchY = y + 1
      break
    }
  }
  if (crotchY < 0 || (p.bottom - crotchY) / H < 0.12) return null
  const gap = p.runs(crotchY + 2).filter((r) => r[1] - r[0] > 2)
  if (gap.length < 2) return null
  const crotch: Pt = [(gap[0][1] + gap[gap.length - 1][0]) / 2, crotchY]

  const leg = (side: 'L' | 'R') => {
    let last = crotchY
    let outerAtBottom = 0
    let innerAtBottom = 0
    for (let yy = crotchY + 2; yy <= p.bottom; yy++) {
      const rs = p.runs(yy).filter((r) => r[1] - r[0] > 2)
      if (!rs.length) continue
      const r = side === 'L' ? rs[0] : rs[rs.length - 1]
      if (side === 'L' ? r[0] > crotch[0] : r[1] < crotch[0]) continue
      last = yy
      outerAtBottom = side === 'L' ? r[0] : r[1]
      innerAtBottom = side === 'L' ? Math.min(r[1], crotch[0] - 1) : Math.max(r[0], crotch[0] + 1)
    }
    const hy = last - Math.max(1, Math.round(H * 0.01))
    const ky = Math.round(crotchY + (hy - crotchY) * 0.5)
    const rs = p.runs(ky).filter((r) => r[1] - r[0] > 2)
    const r = rs.length ? (side === 'L' ? rs[0] : rs[rs.length - 1]) : [outerAtBottom, innerAtBottom]
    return {
      outer: [outerAtBottom, hy] as Pt,
      inner: [innerAtBottom, hy] as Pt,
      kneeOuter: [side === 'L' ? r[0] : r[1], ky] as Pt,
      kneeInner: [side === 'L' ? r[1] : r[0], ky] as Pt,
    }
  }
  const wy = p.top + Math.max(1, Math.round(H * 0.012))
  const my = Math.round(wy + (crotchY - wy) * 0.5)
  return {
    waistL: [p.xl[wy], wy],
    waistR: [p.xr[wy], wy],
    hipL: [p.xl[crotchY], crotchY],
    hipR: [p.xr[crotchY], crotchY],
    midL: [p.xl[my], my],
    midR: [p.xr[my], my],
    crotch,
    legL: leg('L'),
    legR: leg('R'),
  }
}

export interface SkirtMarks {
  waistL: Pt
  waistR: Pt
  hemL: Pt
  hemR: Pt
  midL: Pt
  midR: Pt
}

export function skirtMarks(b: Bin): SkirtMarks | null {
  const p = profile(b)
  if (p.top < 0) return null
  const H = p.bottom - p.top
  const wy = p.top + Math.max(1, Math.round(H * 0.012))
  const hy = p.bottom - Math.max(1, Math.round(H * 0.012))
  const my = Math.round((wy + hy) / 2)
  return {
    waistL: [p.xl[wy], wy],
    waistR: [p.xr[wy], wy],
    hemL: [p.xl[hy], hy],
    hemR: [p.xr[hy], hy],
    midL: [p.xl[my], my],
    midR: [p.xr[my], my],
  }
}

/** Sharpness of the garment photo (higher is sharper). Below ~35 the print is likely soft. */
export function sharpness(img: ImageData, mask: Uint8Array): number {
  const { width: w, height: h, data } = img
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114
  let n = 0
  let sum = 0
  let sum2 = 0
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x
      if (mask[i] < 250 || mask[i - 1] < 250 || mask[i + 1] < 250 || mask[i - w] < 250 || mask[i + w] < 250) continue
      const lap = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]
      sum += lap
      sum2 += lap * lap
      n++
    }
  }
  if (!n) return 100
  const mean = sum / n
  return sum2 / n - mean * mean
}
