// Builds the digital version of a piece and dresses the mannequin in it.
//
// A photo is never pasted onto the mannequin. Instead the piece is rebuilt from a clean garment
// template (a proper T-shirt, shirt, trousers or skirt shape) using what digitize.ts read from the
// photo: the exact fabric colour, the print, and the measurements. Patterned fabrics (stripes,
// checks) reuse the photo's fabric inside the clean shape.
import rigData from '../../config/mannequinRig.json'
import { garmentKind } from '../../config/fitRules'
import type { MannequinGender } from '../../db/db'
import { ctx2d, makeCanvas } from '../image'
import type { Kind } from './analyze'
import { digitize, type Digital, type RGB } from './digitize'
import { thinPlateSpline, type Pt } from './tps'

export type View = 'front' | 'back'
type Ctx = CanvasRenderingContext2D

/** Output resolution relative to the mannequin pictures (972 × 2160). */
const K = 1
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

// ---------- The mannequin body ----------

type RigJson = typeof rigData.female
interface Rig {
  c: number
  p: (key: keyof RigJson) => Pt
  y: (key: 'waistY' | 'hipsY' | 'footY') => number
  bodyHalf: (y: number) => number
  /** Height of the top of the left shoulder at x. */
  topY: (x: number) => number
  leg: (y: number) => { axis: number; half: number }
  armR: number[]
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
  const topKeys = Object.keys(r.shoulderTop).map(Number).sort((a, b) => a - b)
  const topVals = topKeys.map((k) => (r.shoulderTop as Record<string, number>)[String(k)])
  const rig: Rig = {
    c: c0 * K,
    p: (key) => {
      const v = r[key] as unknown as number[]
      return [v[0] * K, v[1] * K]
    },
    y: (key) => (r[key] as number) * K,
    bodyHalf: (y) => {
      const yy = y / K
      if (yy <= r.crotch[1]) return torsoVals[nearest(torsoKeys, yy)] * K
      const l = legVals[nearest(legKeys, yy)]
      return (c0 - l[0]) * K
    },
    topY: (x) => topVals[nearest(topKeys, x / K)] * K,
    leg: (y) => {
      const l = legVals[nearest(legKeys, y / K)]
      return { axis: ((l[0] + l[1]) / 2) * K, half: ((l[1] - l[0]) / 2) * K }
    },
    armR: r.armRadius.map((v) => v * K),
    headHalf: r.headHalfW * K,
  }
  rigCache.set(g, rig)
  return rig
}

const shadeCache = new Map<string, Promise<ImageData>>()
function getShade(g: MannequinGender, view: View): Promise<ImageData> {
  const key = `${g}-${view}`
  let p = shadeCache.get(key)
  if (!p) {
    p = (async () => {
      const res = await fetch(new URL(`mannequins/shade-${key}.png`, document.baseURI))
      const bmp = await createImageBitmap(await res.blob())
      const c = makeCanvas(bmp.width, bmp.height)
      ctx2d(c).drawImage(bmp, 0, 0)
      return ctx2d(c).getImageData(0, 0, c.width, c.height)
    })()
    shadeCache.set(key, p)
  }
  return p
}

// ---------- Small helpers ----------

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k]
const len = (a: Pt) => Math.hypot(a[0], a[1])
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const flipX = (p: Pt, c: number): Pt => [2 * c - p[0], p[1]]
const norm = (a: Pt): Pt => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}

function walk(path: Pt[], d: number): { p: Pt; dir: Pt; t: number } {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) total += len(sub(path[i + 1], path[i]))
  let left = d
  for (let i = 0; i < path.length - 1; i++) {
    const seg = sub(path[i + 1], path[i])
    const l = len(seg)
    if (left <= l || i === path.length - 2) {
      const dir = norm(seg)
      return { p: add(path[i], mul(dir, Math.min(left, l * 1.5))), dir, t: Math.min(1, d / total) }
    }
    left -= l
  }
  return { p: path[path.length - 1], dir: [0, 1], t: 1 }
}

/** Smooth curve from the current point through the given points. */
function through(ctx: Ctx, pts: Pt[]) {
  for (let i = 0; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1])
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1])
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last[0], last[1])
}

const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`
const lum = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
const shadeOf = (c: RGB, k: number): RGB => (k >= 0 ? [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k] : [c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)])
/** A tone that shows up against the fabric: lighter on dark fabric, darker on light fabric. */
const seamOf = (c: RGB, strength = 1): RGB => (lum(c) < 70 ? shadeOf(c, 0.2 * strength) : shadeOf(c, -0.2 * strength))

const BIG = 1e5
function fillAll(ctx: Ctx, style: string | CanvasGradient) {
  ctx.fillStyle = style
  ctx.fillRect(-BIG, -BIG, 2 * BIG, 2 * BIG)
}

/** Soft light-and-shadow across a rounded form, between its two edges a and b. */
function roundShade(ctx: Ctx, a: Pt, b: Pt, color: RGB, edge = 0.2) {
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1])
  const hi = lum(color) < 70 ? 0.09 : 0.05
  g.addColorStop(0, `rgba(0,0,0,${edge})`)
  g.addColorStop(0.24, 'rgba(0,0,0,0)')
  g.addColorStop(0.5, `rgba(255,255,255,${hi})`)
  g.addColorStop(0.76, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${edge})`)
  fillAll(ctx, g)
}

/** A soft, blurred line (fold shadows). */
function softLine(ctx: Ctx, pts: Pt[], width: number, color: string, blur: number) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = 20000
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#000'
  ctx.beginPath()
  ctx.moveTo(pts[0][0] - 20000 / (ctx.getTransform().a || 1), pts[0][1])
  for (const p of pts.slice(1)) ctx.lineTo(p[0] - 20000 / (ctx.getTransform().a || 1), p[1])
  ctx.stroke()
  ctx.restore()
}

function stitch(ctx: Ctx, color: RGB, w: number, draw: () => void) {
  ctx.save()
  ctx.strokeStyle = css(seamOf(color), 0.6)
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.beginPath()
  draw()
  ctx.stroke()
  ctx.restore()
}

// ---------- Photo fabric for patterned pieces ----------

interface Pair {
  t: Pt
  s: Pt
}

/** Bends the photo so its landmarks land on the template's landmarks. Returns a picture covering `box`. */
function warp(src: ImageData, pairs: Pair[], box: Box, res: number): HTMLCanvasElement {
  const map = thinPlateSpline(
    pairs.map((p) => p.t),
    pairs.map((p) => p.s),
  )
  const W = Math.max(1, Math.round(box.w * res))
  const H = Math.max(1, Math.round(box.h * res))
  const out = new ImageData(W, H)
  const G = 6
  const gw = Math.ceil(W / G) + 1
  const gh = Math.ceil(H / G) + 1
  const gx = new Float32Array(gw * gh)
  const gy = new Float32Array(gw * gh)
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const [sx, sy] = map(box.x + (i * G) / res, box.y + (j * G) / res)
      gx[j * gw + i] = sx
      gy[j * gw + i] = sy
    }
  }
  const { width: sw, height: sh, data } = src
  // where the photo has no fabric (a sleeve longer than in the photo, a fold), reuse the nearest
  // fabric on the way to the middle of the piece, so the pattern carries on instead of going blank
  let ax = 0
  let ay = 0
  for (const p of pairs) {
    ax += p.s[0] / pairs.length
    ay += p.s[1] / pairs.length
  }
  const solidAt = (x: number, y: number) => x >= 0 && y >= 0 && x <= sw - 1 && y <= sh - 1 && data[(Math.round(y) * sw + Math.round(x)) * 4 + 3] > 200
  for (let y = 0; y < H; y++) {
    const j = Math.min(gh - 2, Math.floor(y / G))
    const fy = y / G - j
    for (let x = 0; x < W; x++) {
      const i = Math.min(gw - 2, Math.floor(x / G))
      const fx = x / G - i
      const a = j * gw + i
      let sx = (gx[a] * (1 - fx) + gx[a + 1] * fx) * (1 - fy) + (gx[a + gw] * (1 - fx) + gx[a + gw + 1] * fx) * fy
      let sy = (gy[a] * (1 - fx) + gy[a + 1] * fx) * (1 - fy) + (gy[a + gw] * (1 - fx) + gy[a + gw + 1] * fx) * fy
      if (!solidAt(sx, sy)) {
        for (let t = 0.06; t < 1; t += 0.06) {
          const nx = sx + (ax - sx) * t
          const ny = sy + (ay - sy) * t
          if (solidAt(nx, ny)) {
            sx = nx + (ax - sx) * 0.02
            sy = ny + (ay - sy) * 0.02
            break
          }
        }
      }
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) continue
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const x1 = Math.min(sw - 1, x0 + 1)
      const y1 = Math.min(sh - 1, y0 + 1)
      const tx = sx - x0
      const ty = sy - y0
      let r = 0
      let g = 0
      let b = 0
      let al = 0
      const acc = (xx: number, yy: number, wt: number) => {
        const k = (yy * sw + xx) * 4
        const w = data[k + 3] * wt
        r += data[k] * w
        g += data[k + 1] * w
        b += data[k + 2] * w
        al += w
      }
      acc(x0, y0, (1 - tx) * (1 - ty))
      acc(x1, y0, tx * (1 - ty))
      acc(x0, y1, (1 - tx) * ty)
      acc(x1, y1, tx * ty)
      if (al <= 0) continue
      const o = (y * W + x) * 4
      out.data[o] = r / al
      out.data[o + 1] = g / al
      out.data[o + 2] = b / al
      out.data[o + 3] = Math.min(255, al)
    }
  }
  const c = makeCanvas(W, H)
  ctx2d(c).putImageData(out, 0, 0)
  return c
}

/** Fills the current clip with the piece's fabric: plain colour, or the photo's own fabric. */
function fabric(ctx: Ctx, d: Digital, pairs: Pair[] | null, box: Box, res: number) {
  fillAll(ctx, css(d.color))
  if (d.solid || !pairs || pairs.length < 4) return
  ctx.drawImage(warp(d.src, pairs, box, res), box.x, box.y, box.w, box.h)
}

// ---------- Tops (T-shirts, shirts, sweaters, jackets, dresses) ----------

interface Sleeve {
  outer: Pt[] // after the shoulder … cuff
  inner: Pt[] // cuff … before the armpit
}
interface TopShape {
  c: number
  u: number
  neckL: Pt
  dip: number
  shL: Pt
  apL: Pt
  shLine: Pt[] // along the top of the shoulder, between the collar and the shoulder seam
  side: (f: number) => Pt // left side seam, f = 0 (armpit) … 1 (hem)
  hemDrop: number
  sl?: Sleeve // left sleeve (the right one is mirrored)
  back: boolean
  flat: boolean
}

const COLLAR = new Set(['shirt-casual', 'shirt-formal', 'polo', 'jacket', 'blazer', 'long-coat'])
const OPEN_FRONT = new Set(['shirt-casual', 'shirt-formal', 'jacket', 'blazer', 'long-coat', 'cardigan', 'waistcoat'])
const EASE: Record<string, number> = {
  undershirt: 1.05, 'crop-top': 1.06, tshirt: 1.12, polo: 1.12, blouse: 1.12, kurti: 1.14, 'shirt-casual': 1.15, 'shirt-formal': 1.13,
  sweater: 1.19, sweatshirt: 1.22, hoodie: 1.24, cardigan: 1.2, waistcoat: 1.1, jacket: 1.26, blazer: 1.22, 'long-coat': 1.28,
  dress: 1.08, gown: 1.08, jumpsuit: 1.1, 'kurta-set': 1.14, 'suit-set': 1.2,
}

function flatTop(d: Digital): TopShape {
  const p = d.top!.p
  const U = 100
  const shL: Pt = [-p.shHalf * U, -p.shRise * U]
  const apL: Pt = [-U, 0]
  const hemY = p.bodyLen * U
  let sl: Sleeve | undefined
  if (p.sleeveLen > 0) {
    const a = ((p.sleeveLen > 1.3 ? 64 : 36) * Math.PI) / 180
    const dir: Pt = [-Math.cos(a), Math.sin(a)]
    const n: Pt = [-Math.sin(a), -Math.cos(a)]
    const cuff = add(mid(shL, apL), mul(dir, p.sleeveLen * U))
    sl = { outer: [add(cuff, mul(n, p.cuffHalf * U))], inner: [add(cuff, mul(n, -p.cuffHalf * U))] }
  }
  return {
    c: 0, u: U, shL, apL, shLine: [],
    neckL: [-p.neckHalf * U, shL[1] - 0.13 * U],
    dip: p.neckDip * U,
    side: (f) => [-U * lerp(1, p.hemHalf, f), f * hemY],
    hemDrop: 0.05 * U, sl, back: false, flat: true,
  }
}

function wornTop(d: Digital, rig: Rig, view: View): TopShape {
  const p = d.top!.p
  const c = rig.c
  const mAp = rig.p('armpitL')
  const mSh = rig.p('shoulderL')
  const mNeck = rig.p('neckL')
  const u = (c - mAp[0]) * (EASE[d.sub] ?? 1.12)
  const apL: Pt = [c - u, mAp[1] + 0.07 * u]
  // the fabric lies on the shoulders: follow the top of the body from the collar to the shoulder seam
  const lift = 0.035 * u
  const onShoulder = (x: number): Pt => [x, rig.topY(x) - lift]
  const shL = onShoulder(c - (c - mSh[0]) * 1.04)
  const neckBody = c - mNeck[0]
  const neckHalf = clamp(p.neckHalf * u * 0.75, neckBody * 1.14, neckBody * 1.6)
  const neckL = onShoulder(c - neckHalf)
  const shLine = [0.25, 0.5, 0.75].map((f) => onShoulder(lerp(neckL[0], shL[0], f)))
  const hemY = Math.min(apL[1] + p.bodyLen * u, rig.y('footY') - 24 * K)
  const side = (f: number): Pt => {
    const y = lerp(apL[1], hemY, f)
    const body = rig.bodyHalf(y)
    // hangs from the chest, and settles a little towards the body below it
    return [c - Math.max(lerp(u * lerp(1, p.hemHalf, f), body * 1.14, 0.45 * Math.min(1, f * 2.5)), body * 1.09 + 4 * K), y]
  }
  let sl: Sleeve | undefined
  if (p.sleeveLen > 0) {
    const root = mid(shL, apL)
    const elbow = rig.p('elbowL')
    const wrist = rig.p('wristL')
    const path: Pt[] = [root, elbow, wrist, add(wrist, mul(norm(sub(wrist, elbow)), 60 * K))]
    const toWrist = len(sub(elbow, root)) + len(sub(wrist, elbow))
    const long = p.sleeveLen > 1.3
    const L = long ? toWrist * 0.97 : Math.min(p.sleeveLen * u, toWrist * 0.52)
    const at = (dd: number, half: (armR: number) => number) => {
      const w = walk(path, dd)
      const armR = w.t < 0.5 ? lerp(rig.armR[0], rig.armR[1], w.t / 0.5) : lerp(rig.armR[1], rig.armR[2], (w.t - 0.5) / 0.5)
      const n: Pt = [-w.dir[1], w.dir[0]]
      const out: Pt = n[0] <= 0 ? n : mul(n, -1) // away from the body (left arm)
      const hw = half(armR)
      return { o: add(w.p, mul(out, hw)), i: add(w.p, mul(out, -hw)) }
    }
    const cuff = at(L, (r) => Math.max(Math.min(p.cuffHalf * u, r * (long ? 1.3 : 1.42)), r * 1.18))
    // the sleeve follows the arm closely: over the shoulder, then down its outside
    const cap0 = at(0, (r) => r * 1.32).o
    const cap = at(Math.min(L * 0.3, toWrist * 0.1), (r) => r * 1.3).o
    if (long) {
      const a1 = at(L * 0.3, (r) => r * 1.3)
      const a2 = at(L * 0.62, (r) => r * 1.32)
      sl = { outer: [cap0, cap, a1.o, a2.o, cuff.o], inner: [cuff.i, a2.i, a1.i] }
    } else {
      const m = at(L * 0.6, (r) => r * 1.3)
      sl = { outer: [cap0, cap, m.o, cuff.o], inner: [cuff.i] }
    }
  }
  return {
    c, u, shL, apL, neckL, shLine,
    dip: view === 'back' ? 0.07 * u : clamp(p.neckDip * u, 0.16 * u, 0.9 * u),
    side, hemDrop: 0.04 * u, sl, back: view === 'back', flat: false,
  }
}

const SIDE_F = [0.2, 0.4, 0.6, 0.8, 1]

function topPoints(s: TopShape): Pt[] {
  const pts: Pt[] = [s.neckL, s.shL, s.apL, ...s.shLine, ...SIDE_F.map(s.side), ...(s.sl ? [...s.sl.outer, ...s.sl.inner] : [])]
  const hem = s.side(1)
  return [...pts, ...pts.map((p) => flipX(p, s.c)), [s.c, hem[1] + s.hemDrop], [s.c, s.neckL[1] + s.dip]]
}

function paintTop(ctx: Ctx, s: TopShape, d: Digital, box: Box, res: number, withPrint: boolean) {
  const { c, u } = s
  const R = (p: Pt) => flipX(p, c)
  const hem = s.side(1)
  const armCtrl = (left: boolean): Pt => {
    const x = s.shL[0] + 0.17 * u
    const pt: Pt = [x, (s.shL[1] + s.apL[1]) / 2 + 0.12 * u]
    return left ? pt : R(pt)
  }
  const shoulderCtrl: Pt = add(mid(s.neckL, s.shL), [0, -0.04 * u])
  const neckline = (dip: number, inset = 0) => {
    ctx.moveTo(c + (c - s.neckL[0]) + inset, s.neckL[1] - inset * 0.25)
    ctx.quadraticCurveTo(c, s.neckL[1] + 2 * dip, s.neckL[0] - inset, s.neckL[1] - inset * 0.25)
  }
  const bodyPath = () => {
    ctx.beginPath()
    ctx.moveTo(s.neckL[0], s.neckL[1])
    if (s.shLine.length) through(ctx, [...s.shLine, s.shL])
    else ctx.quadraticCurveTo(shoulderCtrl[0], shoulderCtrl[1], s.shL[0], s.shL[1])
    ctx.quadraticCurveTo(...armCtrl(true), s.apL[0], s.apL[1])
    through(ctx, SIDE_F.map(s.side))
    ctx.quadraticCurveTo(c, hem[1] + 2 * s.hemDrop, R(hem)[0], hem[1])
    through(ctx, [...SIDE_F.slice(0, -1).reverse().map((f) => R(s.side(f))), R(s.apL)])
    ctx.quadraticCurveTo(...armCtrl(false), R(s.shL)[0], s.shL[1])
    if (s.shLine.length) through(ctx, [...[...s.shLine].reverse().map(R), R(s.neckL)])
    else ctx.quadraticCurveTo(R(shoulderCtrl)[0], shoulderCtrl[1], R(s.neckL)[0], s.neckL[1])
    ctx.quadraticCurveTo(c, s.neckL[1] + 2 * s.dip, s.neckL[0], s.neckL[1])
    ctx.closePath()
  }
  const sleevePath = (left: boolean) => {
    const sl = s.sl!
    const P = (p: Pt) => (left ? p : R(p))
    ctx.beginPath()
    ctx.moveTo(...P(s.shL))
    through(ctx, sl.outer.map(P))
    ctx.lineTo(...P(sl.inner[0]))
    through(ctx, [...sl.inner.slice(1), s.apL].map(P))
    ctx.quadraticCurveTo(...armCtrl(left), ...P(s.shL))
    ctx.closePath()
  }
  const m = d.top!.m
  const k = u / d.top!.u // photo → template scale
  const S = (x: number, y: number): Pt => [x, y]
  const T = (srcPt: Pt): Pt => [c + (srcPt[0] - d.top!.cx) * k, s.apL[1] + (srcPt[1] - d.top!.apY) * k]

  // the inside of the back, seen through the neck opening of a flat piece
  if (s.flat) {
    ctx.beginPath()
    neckline(s.dip * 0.22)
    ctx.quadraticCurveTo(c, s.neckL[1] + 2 * s.dip, c + (c - s.neckL[0]), s.neckL[1])
    ctx.closePath()
    ctx.fillStyle = css(shadeOf(d.color, lum(d.color) < 70 ? 0.07 : -0.3))
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillRect(c - 0.1 * u, s.neckL[1] + s.dip * 0.44 + 0.02 * u, 0.2 * u, 0.1 * u)
  }

  // sleeves
  if (s.sl) {
    for (const left of [true, false]) {
      const P = (p: Pt) => (left ? p : R(p))
      const sl = s.sl
      const cuffO = sl.outer[sl.outer.length - 1]
      const cuffI = sl.inner[0]
      ctx.save()
      sleevePath(left)
      ctx.clip()
      const sm = left ? m.sleeveL : m.sleeveR
      const sSh = left ? m.shoulderL : m.shoulderR
      const sAp = left ? m.armpitL : m.armpitR
      const pairs: Pair[] | null =
        sm && !d.solid
          ? [
              { t: P(s.shL), s: sSh }, { t: P(s.apL), s: sAp }, { t: P(mid(s.shL, s.apL)), s: mid(sSh, sAp) },
              { t: P(cuffO), s: sm.outer }, { t: P(cuffI), s: sm.inner }, { t: P(mid(cuffO, cuffI)), s: mid(sm.outer, sm.inner) },
              { t: P(sl.outer.length > 2 ? sl.outer[1] : mid(s.shL, cuffO)), s: mid(sSh, sm.outer) },
              { t: P(sl.inner.length > 1 ? sl.inner[1] : mid(s.apL, cuffI)), s: mid(sAp, sm.inner) },
            ]
          : null
      fabric(ctx, d, pairs, box, res)
      roundShade(ctx, P(mid(s.shL, cuffO)), P(mid(s.apL, cuffI)), d.color, s.flat ? 0.16 : 0.26)
      // cuff stitching
      const back = norm(sub(mid(s.shL, s.apL), mid(cuffO, cuffI)))
      stitch(ctx, d.color, Math.max(1, 0.012 * u), () => {
        ctx.moveTo(...P(add(cuffO, mul(back, 0.09 * u))))
        ctx.lineTo(...P(add(cuffI, mul(back, 0.09 * u))))
      })
      ctx.restore()
    }
  }

  // body
  ctx.save()
  bodyPath()
  ctx.clip()
  const bodyPairs: Pair[] | null = d.solid
    ? null
    : [
        { t: s.neckL, s: m.neckL }, { t: R(s.neckL), s: m.neckR }, { t: [c, s.neckL[1] + s.dip], s: m.neckC },
        { t: s.shL, s: m.shoulderL }, { t: R(s.shL), s: m.shoulderR }, { t: s.apL, s: m.armpitL }, { t: R(s.apL), s: m.armpitR },
        { t: s.side(0.3), s: m.sideL[0] }, { t: R(s.side(0.3)), s: m.sideR[0] }, { t: s.side(0.62), s: m.sideL[1] }, { t: R(s.side(0.62)), s: m.sideR[1] },
        { t: hem, s: m.hemL }, { t: R(hem), s: m.hemR },
        { t: [c, lerp(s.apL[1], hem[1], 0.25)], s: S(d.top!.cx, lerp(d.top!.apY, m.hemL[1], 0.25)) },
        { t: [c, lerp(s.apL[1], hem[1], 0.8)], s: S(d.top!.cx, lerp(d.top!.apY, m.hemL[1], 0.8)) },
      ]
  fabric(ctx, d, bodyPairs, box, res)
  if (d.solid && d.print && withPrint) {
    const o = T([0, 0])
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(d.print, o[0], o[1], d.src.width * k, d.src.height * k)
  }
  const widest = Math.max(u, c - hem[0])
  roundShade(ctx, [c - widest, 0], [c + widest, 0], d.color, s.flat ? 0.14 : 0.24)
  if (!s.flat) {
    // soft folds: from the armpits towards the waist, and a gentle drape at the hem
    const fold = lum(d.color) < 70 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'
    for (const left of [true, false]) {
      const P = (p: Pt) => (left ? p : R(p))
      softLine(ctx, [P(add(s.apL, [0.1 * u, 0.1 * u])), P([c - 0.45 * u, lerp(s.apL[1], hem[1], 0.42)])], 0.05 * u, fold, 0.09 * u)
      softLine(ctx, [P([c - 0.5 * u, lerp(s.apL[1], hem[1], 0.7)]), P([c - 0.38 * u, hem[1]])], 0.04 * u, fold, 0.08 * u)
    }
  }
  // neckline: ribbed band, or a shirt collar
  const collar = COLLAR.has(d.sub)
  const rib = (collar ? 0.07 : 0.085) * u
  ctx.strokeStyle = css(shadeOf(d.color, lum(d.color) < 70 ? 0.06 : -0.07))
  ctx.lineWidth = 2 * rib
  ctx.beginPath()
  neckline(s.dip)
  ctx.stroke()
  stitch(ctx, d.color, Math.max(1, 0.011 * u), () => neckline(s.dip + rib, rib * 0.9))
  if (OPEN_FRONT.has(d.sub) && !s.back && d.solid) {
    stitch(ctx, d.color, Math.max(1, 0.012 * u), () => {
      ctx.moveTo(c, s.neckL[1] + s.dip)
      ctx.lineTo(c, hem[1] + s.hemDrop)
    })
  }
  // hem stitching
  stitch(ctx, d.color, Math.max(1, 0.012 * u), () => {
    ctx.moveTo(hem[0], hem[1] - 0.09 * u)
    ctx.quadraticCurveTo(c, hem[1] + 2 * s.hemDrop - 0.09 * u, R(hem)[0], hem[1] - 0.09 * u)
  })
  ctx.restore()

  // shirt collar flaps sit on top of the body
  if (collar && !s.back) {
    const front: Pt = [c, s.neckL[1] + s.dip]
    for (const left of [true, false]) {
      const P = (p: Pt) => (left ? p : R(p))
      const tip: Pt = [c - 0.36 * u, front[1] + 0.3 * u]
      ctx.beginPath()
      ctx.moveTo(...P(add(s.neckL, [-0.04 * u, -0.03 * u])))
      ctx.quadraticCurveTo(...P([s.neckL[0] - 0.1 * u, front[1]]), ...P(tip))
      ctx.lineTo(...P(front))
      ctx.quadraticCurveTo(...P([c - 0.1 * u, s.neckL[1] + s.dip * 0.55]), ...P(add(s.neckL, [0.02 * u, 0])))
      ctx.closePath()
      ctx.fillStyle = css(shadeOf(d.color, lum(d.color) < 70 ? 0.05 : 0.03))
      ctx.fill()
      ctx.strokeStyle = css(seamOf(d.color), 0.55)
      ctx.lineWidth = Math.max(1, 0.012 * u)
      ctx.stroke()
    }
  }
  // armhole seams
  for (const left of [true, false]) {
    stitch(ctx, d.color, Math.max(1, 0.011 * u), () => {
      const P = (p: Pt) => (left ? p : R(p))
      ctx.moveTo(...P(s.shL))
      ctx.quadraticCurveTo(...armCtrl(left), ...P(s.apL))
    })
  }
}

// ---------- Trousers, jeans, shorts ----------

interface BottomShape {
  c: number
  u: number
  waistL: Pt
  outer: Pt[] // left leg, outside: below the waist … hem
  inner: Pt[] // left leg, inside: hem … below the crotch
  crotch: Pt
  back: boolean
  flat: boolean
}

function flatBottom(d: Digital): BottomShape {
  const p = d.bottom!.p
  const U = 100
  const crY = p.rise * U
  const hemY = crY + p.legLen * U
  const kneeY = crY + p.legLen * U * 0.5
  const kneeC = -0.5 * U - 0.03 * U
  const hemC = -0.5 * U - 0.06 * U
  return {
    c: 0, u: U, back: false, flat: true,
    waistL: [-p.waistHalf * U, 0],
    crotch: [0, crY + 0.04 * U],
    outer: [[-lerp(p.waistHalf, 1, 0.6) * U, crY * 0.45], [-U, crY], [kneeC - p.kneeHalf * U, kneeY], [hemC - p.hemHalf * U, hemY]],
    inner: [[Math.min(hemC + p.hemHalf * U, -2), hemY], [Math.min(kneeC + p.kneeHalf * U, -2), kneeY]],
  }
}

const FULL_LENGTH = new Set(['jeans', 'trousers-casual', 'trousers-formal', 'leggings'])

function wornBottom(d: Digital, rig: Rig, view: View): BottomShape {
  const p = d.bottom!.p
  const c = rig.c
  const cr = rig.p('crotch')
  const crY = cr[1] + 5 * K
  const tight = d.sub === 'leggings'
  const u = rig.bodyHalf(crY - 8 * K) * (tight ? 1.02 : 1.08)
  // the waistband sits between the hips and the natural waist, never above it
  const waistY = Math.max(crY - p.rise * u, lerp(rig.y('waistY'), crY, 0.22))
  const bodyAt = (y: number) => rig.bodyHalf(Math.min(y, crY - 2)) * 1.03 + 2 * K
  const foot = rig.y('footY')
  const hemY = FULL_LENGTH.has(d.sub) ? Math.max(rig.p('ankleL')[1] + 8 * K, 0) : Math.min(crY + p.legLen * u, foot - 8 * K)
  const legAt = (y: number, want: number, ease: number) => {
    const { axis, half } = rig.leg(y)
    // a flat trouser leg is half its circumference wide; on the body we see it as a rounded tube
    const hw = Math.max(tight ? 0 : want * u * 0.7, half * ease + 2 * K)
    return { o: [axis - hw, y] as Pt, i: [Math.min(axis + hw, c - 1.5 * K), y] as Pt }
  }
  const kneeY = lerp(crY, hemY, 0.5)
  const knee = legAt(kneeY, p.kneeHalf, 1.12)
  const hm = legAt(hemY, p.hemHalf, 1.16)
  const midY = lerp(waistY, crY, 0.5)
  return {
    c, u, back: view === 'back', flat: false,
    waistL: [c - bodyAt(waistY), waistY],
    crotch: [c, crY],
    outer: [[c - bodyAt(midY), midY], [c - Math.max(tight ? 0 : u * 0.98, bodyAt(crY)), crY], knee.o, hm.o],
    inner: [hm.i, knee.i],
  }
}

const bottomPoints = (s: BottomShape): Pt[] => {
  const pts = [s.waistL, ...s.outer, ...s.inner]
  return [...pts, ...pts.map((p) => flipX(p, s.c)), s.crotch]
}

function paintBottom(ctx: Ctx, s: BottomShape, d: Digital, box: Box, res: number) {
  const { c, u } = s
  const R = (p: Pt) => flipX(p, c)
  const hemO = s.outer[s.outer.length - 1]
  const hemI = s.inner[0]
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(...s.waistL)
  through(ctx, s.outer)
  ctx.lineTo(...hemI)
  through(ctx, [...s.inner.slice(1), s.crotch])
  through(ctx, [...s.inner.slice(1).reverse().map(R), R(hemI)])
  ctx.lineTo(...R(hemO))
  through(ctx, [...s.outer.slice(0, -1).reverse().map(R), R(s.waistL)])
  ctx.quadraticCurveTo(c, s.waistL[1] + 0.06 * u, ...s.waistL)
  ctx.closePath()
  ctx.clip()

  const m = d.bottom!.m
  const pairs: Pair[] | null = d.solid
    ? null
    : [
        { t: s.waistL, s: m.waistL }, { t: R(s.waistL), s: m.waistR }, { t: s.outer[0], s: m.midL }, { t: R(s.outer[0]), s: m.midR },
        { t: s.outer[1], s: m.hipL }, { t: R(s.outer[1]), s: m.hipR }, { t: s.crotch, s: m.crotch },
        { t: s.outer[2], s: m.legL.kneeOuter }, { t: s.inner[1], s: m.legL.kneeInner }, { t: hemO, s: m.legL.outer }, { t: hemI, s: m.legL.inner },
        { t: R(s.outer[2]), s: m.legR.kneeOuter }, { t: R(s.inner[1]), s: m.legR.kneeInner }, { t: R(hemO), s: m.legR.outer }, { t: R(hemI), s: m.legR.inner },
        { t: [c, lerp(s.waistL[1], s.crotch[1], 0.5)], s: [m.crotch[0], lerp(m.waistL[1], m.crotch[1], 0.5)] },
      ]
  fabric(ctx, d, pairs, box, res)
  const denim = d.sub === 'jeans'
  if (denim && d.solid) {
    // worn-in fade down the thighs
    const g = ctx.createLinearGradient(0, s.waistL[1], 0, hemO[1])
    g.addColorStop(0.12, 'rgba(255,255,255,0)')
    g.addColorStop(0.36, 'rgba(255,255,255,0.11)')
    g.addColorStop(0.68, 'rgba(255,255,255,0.03)')
    g.addColorStop(1, 'rgba(0,0,0,0.05)')
    fillAll(ctx, g)
  }
  // each leg is rounded; the seat is shaded as one form
  for (const left of [true, false]) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(left ? -BIG : c, s.crotch[1] - 0.25 * u, BIG + (left ? c : 0), BIG)
    ctx.clip()
    const P = (p: Pt) => (left ? p : R(p))
    // shade from the outside of the leg to the centre line, so the inner thighs fall into soft shadow
    roundShade(ctx, P(s.outer[2]), P([Math.max(s.inner[1][0], c - 0.05 * u), s.inner[1][1]]), d.color, s.flat ? 0.14 : 0.2)
    ctx.restore()
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(-BIG, -BIG, 2 * BIG, BIG + s.crotch[1] - 0.25 * u)
  ctx.clip()
  roundShade(ctx, s.outer[1], R(s.outer[1]), d.color, s.flat ? 0.12 : 0.22)
  ctx.restore()

  if (d.solid) {
    const thread: RGB = denim ? [201, 160, 99] : seamOf(d.color)
    const line = (draw: () => void, w = 0.012) => {
      ctx.save()
      ctx.strokeStyle = css(thread, denim ? 0.85 : 0.6)
      ctx.lineWidth = Math.max(1, w * u)
      ctx.lineCap = 'round'
      ctx.beginPath()
      draw()
      ctx.stroke()
      ctx.restore()
    }
    const wy = s.waistL[1]
    const band = 0.17 * u
    line(() => {
      ctx.moveTo(s.waistL[0] - u, wy + band)
      ctx.quadraticCurveTo(c, wy + band + 0.06 * u, R(s.waistL)[0] + u, wy + band)
    })
    if (!s.back) {
      // fly, button, front pockets
      line(() => {
        ctx.moveTo(c, wy + band)
        ctx.lineTo(c, s.crotch[1] - 0.12 * u)
        ctx.moveTo(c + 0.16 * u, wy + band)
        ctx.quadraticCurveTo(c + 0.16 * u, lerp(wy, s.crotch[1], 0.62), c, lerp(wy, s.crotch[1], 0.72))
      })
      for (const sx of [-1, 1]) {
        line(() => {
          ctx.moveTo(c + sx * 0.42 * u, wy + band)
          ctx.quadraticCurveTo(c + sx * 0.5 * u, wy + band + 0.36 * u, c + sx * 1.2 * u, wy + band + 0.44 * u)
        })
      }
      ctx.fillStyle = css(denim ? [190, 150, 90] : seamOf(d.color, 1.4))
      ctx.beginPath()
      ctx.arc(c, wy + band * 0.55, 0.045 * u, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // back yoke and pockets
      line(() => {
        ctx.moveTo(c - 1.3 * u, wy + band + 0.2 * u)
        ctx.lineTo(c, wy + band + 0.36 * u)
        ctx.lineTo(c + 1.3 * u, wy + band + 0.2 * u)
        ctx.moveTo(c, wy + band)
        ctx.lineTo(c, s.crotch[1])
      })
      for (const sx of [-1, 1]) {
        const x = c + sx * 0.5 * u
        const y = wy + band + 0.46 * u
        const w = 0.27 * u
        line(() => {
          ctx.moveTo(x - w, y)
          ctx.lineTo(x + w, y)
          ctx.lineTo(x + w, y + 0.42 * u)
          ctx.lineTo(x, y + 0.56 * u)
          ctx.lineTo(x - w, y + 0.42 * u)
          ctx.closePath()
        })
      }
    }
    // hems and outer seams
    for (const left of [true, false]) {
      const P = (p: Pt) => (left ? p : R(p))
      line(() => {
        ctx.moveTo(...P(add(hemO, [0, -0.1 * u])))
        ctx.lineTo(...P(add(hemI, [0, -0.1 * u])))
      })
    }
  }
  ctx.restore()
}

// ---------- Skirts ----------

interface SkirtShape {
  c: number
  u: number
  wY: number
  side: (f: number) => Pt
  hemDrop: number
  flat: boolean
  flare: number
}

function flatSkirt(d: Digital): SkirtShape {
  const p = d.skirt!.p
  const U = 100
  return { c: 0, u: U, wY: 0, flat: true, flare: p.hemHalf, hemDrop: 0.08 * U, side: (f) => [-U * lerp(1, p.hemHalf, Math.pow(f, 0.8)), f * p.len * U] }
}

function wornSkirt(d: Digital, rig: Rig): SkirtShape {
  const p = d.skirt!.p
  const c = rig.c
  const wY = rig.y('waistY')
  const u = rig.bodyHalf(wY) * 1.05
  const hemY = Math.min(wY + p.len * u, rig.y('footY') - 14 * K)
  return {
    c, u, wY, flat: false, flare: p.hemHalf, hemDrop: 0.06 * u,
    side: (f) => {
      const y = lerp(wY, hemY, f)
      return [c - Math.max(u * lerp(1, p.hemHalf, Math.pow(f, 0.8)), rig.bodyHalf(y) * 1.06 + 2 * K), y]
    },
  }
}

const skirtPoints = (s: SkirtShape): Pt[] => {
  const pts = [0, ...SIDE_F].map(s.side)
  return [...pts, ...pts.map((p) => flipX(p, s.c)), [s.c, s.side(1)[1] + 2 * s.hemDrop]]
}

function paintSkirt(ctx: Ctx, s: SkirtShape, d: Digital, box: Box, res: number) {
  const { c, u } = s
  const R = (p: Pt) => flipX(p, c)
  const top = s.side(0)
  const hem = s.side(1)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(...top)
  through(ctx, SIDE_F.map(s.side))
  ctx.quadraticCurveTo(c, hem[1] + 2 * s.hemDrop, ...R(hem))
  through(ctx, [...SIDE_F.slice(0, -1).reverse().map((f) => R(s.side(f))), R(top)])
  ctx.quadraticCurveTo(c, top[1] + 0.05 * u, ...top)
  ctx.closePath()
  ctx.clip()
  const m = d.skirt!.m
  const pairs: Pair[] | null = d.solid
    ? null
    : [
        { t: top, s: m.waistL }, { t: R(top), s: m.waistR }, { t: s.side(0.5), s: m.midL }, { t: R(s.side(0.5)), s: m.midR },
        { t: hem, s: m.hemL }, { t: R(hem), s: m.hemR }, { t: [c, lerp(top[1], hem[1], 0.5)], s: [d.skirt!.cx, m.midL[1]] },
      ]
  fabric(ctx, d, pairs, box, res)
  roundShade(ctx, [hem[0], 0], [R(hem)[0], 0], d.color, s.flat ? 0.12 : 0.22)
  if (d.solid && s.flare > 1.25) {
    const fold = lum(d.color) < 70 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
    for (const t of [-0.6, -0.2, 0.25, 0.62]) {
      softLine(ctx, [[c + t * u * 0.7, top[1] + 0.3 * u], [c + t * (c - hem[0]), hem[1]]], 0.05 * u, fold, 0.1 * u)
    }
  }
  stitch(ctx, d.color, Math.max(1, 0.012 * u), () => {
    ctx.moveTo(top[0] - u, top[1] + 0.15 * u)
    ctx.quadraticCurveTo(c, top[1] + 0.2 * u, R(top)[0] + u, top[1] + 0.15 * u)
    ctx.moveTo(hem[0], hem[1] - 0.08 * u)
    ctx.quadraticCurveTo(c, hem[1] + 2 * s.hemDrop - 0.08 * u, R(hem)[0], hem[1] - 0.08 * u)
  })
  ctx.restore()
}

// ---------- Finishing: fabric grain and body shading ----------

function finish(canvas: HTMLCanvasElement, shade: ImageData | null, ox: number, oy: number, strength: number) {
  const ctx = ctx2d(canvas)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  const w = canvas.width
  for (let y = 0; y < canvas.height; y++) {
    const sy = shade ? clamp(Math.round((y + oy) / K), 0, shade.height - 1) : 0
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!px[i + 3]) continue
      // fine fabric grain
      let n = (x * 374761393 + y * 668265263) | 0
      n = (n ^ (n >> 13)) * 1274126177
      const grain = (((n ^ (n >> 16)) & 255) / 255 - 0.5) * 7
      let kf = 1
      if (shade) {
        const j = (sy * shade.width + clamp(Math.round((x + ox) / K), 0, shade.width - 1)) * 4
        const cov = shade.data[j + 3] / 255
        const f = clamp(0.5 + 0.6 * (shade.data[j] / 255), 0.8, 1.07)
        kf = 1 + (cov * f + (1 - cov) * 0.94 - 1) * strength
      }
      px[i] = clamp(px[i] * kf + grain, 0, 255)
      px[i + 1] = clamp(px[i + 1] * kf + grain, 0, 255)
      px[i + 2] = clamp(px[i + 2] * kf + grain, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

function boundsOf(pts: Pt[], pad: number): Box {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + 2 * pad), h: Math.ceil(y1 - y0 + 2 * pad) }
}

/** Paints a garment shape into its own canvas. `res` = output pixels per shape unit. */
function render(pts: Pt[], res: number, pad: number, paint: (ctx: Ctx, box: Box) => void): { canvas: HTMLCanvasElement; box: Box } {
  const box = boundsOf(pts, pad)
  const canvas = makeCanvas(Math.round(box.w * res), Math.round(box.h * res))
  const ctx = ctx2d(canvas)
  ctx.setTransform(res, 0, 0, res, -box.x * res, -box.y * res)
  ctx.lineJoin = 'round'
  paint(ctx, box)
  return { canvas, box }
}

// ---------- Shoes and accessories: placed, not rebuilt ----------

function placeBox(img: ImageData, rig: Rig, kind: Kind): Box {
  const c = rig.c
  const ar = img.width / img.height
  const shL = rig.p('shoulderL')
  const span = rig.p('shoulderR')[0] - shL[0]
  const byWidth = (w: number, cx: number, top: number): Box => ({ x: cx - w / 2, y: top, w, h: w / ar })
  switch (kind) {
    case 'shoes': {
      const w = (rig.p('ankleR')[0] - rig.p('ankleL')[0]) * 1.9
      return { x: c - w / 2, y: rig.y('footY') + 14 * K - w / ar, w, h: w / ar }
    }
    case 'cap': {
      const w = rig.headHalf * 2 * 1.45
      return byWidth(w, c, rig.p('headTop')[1] - (w / ar) * 0.18)
    }
    case 'belt': {
      const y = (rig.y('waistY') + rig.y('hipsY')) / 2
      const w = rig.bodyHalf(y) * 2 * 1.08
      const h = Math.min(w / ar, 40 * K)
      return { x: c - w / 2, y: y - h / 2, w, h }
    }
    case 'tie': {
      const n = rig.p('neckL')
      const h = (rig.y('waistY') - n[1]) * 0.95
      return { x: c - (h * ar) / 2, y: n[1] + 4 * K, w: h * ar, h }
    }
    case 'scarf':
      return byWidth(span * 0.62, c, rig.p('neckL')[1] - 8 * K)
    case 'bag': {
      const wr = rig.p('wristR')
      const w = span * 0.5
      return byWidth(w, wr[0] + w * 0.15, wr[1] - (w / ar) * 0.25)
    }
    case 'bottom':
    case 'skirt': {
      const top = rig.y('waistY')
      const w = rig.bodyHalf(rig.p('crotch')[1] - 10) * 2.3
      return { x: c - w / 2, y: top, w, h: w / ar }
    }
    default:
      return byWidth(span * 1.25, c, rig.p('neckL')[1] - 6 * K)
  }
}

// ---------- Public ----------

/** The clean digital version of a piece, laid flat (shown in the closet). Null if it cannot be rebuilt. */
export function makeDigital(img: ImageData, subCategory: string, longSide = 1800): HTMLCanvasElement | null {
  const d = digitize(img, subCategory)
  if (!d) return null
  const pts = d.kind === 'top' ? topPoints(flatTop(d)) : d.kind === 'bottom' ? bottomPoints(flatBottom(d)) : skirtPoints(flatSkirt(d))
  const b = boundsOf(pts, 6)
  const res = longSide / Math.max(b.w, b.h)
  const out = render(pts, res, 6, (ctx, box) => {
    if (d.kind === 'top') paintTop(ctx, flatTop(d), d, box, res, true)
    else if (d.kind === 'bottom') paintBottom(ctx, flatBottom(d), d, box, res)
    else paintSkirt(ctx, flatSkirt(d), d, box, res)
  })
  finish(out.canvas, null, 0, 0, 0)
  return out.canvas
}

/**
 * Dresses a mannequin in one piece. `img` is the upright cut-out of the side being shown.
 * With `fromFront`, a back view is built from the front photo (no back photo exists): same shape and
 * colour, without the front print.
 */
export async function fitGarment(
  img: ImageData,
  subCategory: string,
  gender: MannequinGender,
  view: View,
  opts: { fromFront?: boolean } = {},
): Promise<FitResult> {
  const rig = getRig(gender)
  const W = MANNEQUIN_W * K
  const H = MANNEQUIN_H * K
  const shade = await getShade(gender, view).catch(() => null)
  const d = digitize(img, subCategory)
  let out: { canvas: HTMLCanvasElement; box: Box }
  if (d) {
    const pad = 4
    if (d.kind === 'top') {
      const s = wornTop(d, rig, view)
      out = render(topPoints(s), 1, pad, (ctx, box) => paintTop(ctx, s, d, box, 1, !opts.fromFront))
    } else if (d.kind === 'bottom') {
      const s = wornBottom(d, rig, view)
      out = render(bottomPoints(s), 1, pad, (ctx, box) => paintBottom(ctx, s, d, box, 1))
    } else {
      const s = wornSkirt(d, rig)
      out = render(skirtPoints(s), 1, pad, (ctx, box) => paintSkirt(ctx, s, d, box, 1))
    }
    finish(out.canvas, shade, out.box.x, out.box.y, 0.9)
  } else {
    // shoes, bags, belts…: the cleaned cut-out, placed where it is worn
    const b = placeBox(img, rig, garmentKind(subCategory))
    const box: Box = { x: Math.round(b.x), y: Math.round(b.y), w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)) }
    const srcC = makeCanvas(img.width, img.height)
    ctx2d(srcC).putImageData(img, 0, 0)
    const canvas = makeCanvas(box.w, box.h)
    ctx2d(canvas).drawImage(srcC, 0, 0, box.w, box.h)
    out = { canvas, box }
    finish(out.canvas, shade, box.x, box.y, 0.3)
  }
  return { canvas: out.canvas, rect: { x: out.box.x / W, y: out.box.y / H, w: out.box.w / W, h: out.box.h / H } }
}
