// Fits a garment photo onto the mannequin: the real photo is reshaped (never redrawn) so the collar
// sits at the neck, shoulders on the shoulders, sleeves along the arms, legs along the legs,
// and the mannequin's body shading gives the fabric volume.
import rigData from '../../config/mannequinRig.json'
import { garmentKind } from '../../config/fitRules'
import type { MannequinGender } from '../../db/db'
import { ctx2d, makeCanvas } from '../image'
import { binFromAlpha, bottomMarks, skirtMarks, topMarks, type Kind } from './analyze'
import { thinPlateSpline, type Pt } from './tps'

export type View = 'front' | 'back'

/** Output resolution relative to the mannequin pictures (680 × 1603). */
const K = 1.5
export const MANNEQUIN_W = rigData.width
export const MANNEQUIN_H = rigData.height

export interface FitResult {
  canvas: HTMLCanvasElement
  /** Position on the mannequin picture, as fractions (0..1) of its width and height. */
  rect: { x: number; y: number; w: number; h: number }
}

// ---------- The mannequin body ----------

type RigJson = typeof rigData.female
interface Rig {
  c: number
  p: (key: keyof RigJson) => Pt
  y: (key: 'waistY' | 'hipsY' | 'footY') => number
  bodyHalf: (y: number) => number
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

// ---------- Body shading ----------

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

// ---------- Helpers ----------

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k]
const len = (a: Pt) => Math.hypot(a[0], a[1])
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const norm = (a: Pt): Pt => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}

/** Walks `dist` along a polyline; returns the point and the direction there. */
function walk(path: Pt[], dist: number): { p: Pt; dir: Pt; t: number } {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) total += len(sub(path[i + 1], path[i]))
  let left = dist
  for (let i = 0; i < path.length - 1; i++) {
    const seg = sub(path[i + 1], path[i])
    const l = len(seg)
    if (left <= l || i === path.length - 2) {
      const d = norm(seg)
      return { p: add(path[i], mul(d, Math.min(left, l * 1.6))), dir: d, t: Math.min(1, dist / total) }
    }
    left -= l
  }
  return { p: path[path.length - 1], dir: [0, 1], t: 1 }
}

interface Pair {
  t: Pt // on the mannequin (output pixels)
  s: Pt // on the garment photo (photo pixels)
}

/** One piece of the garment that bends on its own (the body, each sleeve, each leg). */
interface Part {
  pairs: Pair[]
  outline: Pt[] // where it may appear on the mannequin
  srcPoly?: Pt[] // which part of the photo belongs to it (omit = everything)
  srcOutside?: Pt[] // …or: everything on this side of the body outline
  side?: 'L' | 'R'
}

// ---------- Fitting rules per kind of garment ----------

const LONG_SLEEVES = new Set(['shirt-formal', 'sweater', 'hoodie', 'sweatshirt', 'jacket', 'blazer', 'long-coat', 'cardigan', 'gown'])

function fitTop(img: ImageData, rig: Rig, subCategory: string): Part[] | null {
  const { bin, scale } = binFromAlpha(img)
  const m = topMarks(bin)
  if (!m) return null
  const S = (p: Pt): Pt => [p[0] / scale, p[1] / scale]
  const c = rig.c
  const mArmpitL = rig.p('armpitL')
  const mArmpitR = rig.p('armpitR')
  const mShoulderL = rig.p('shoulderL')
  const mShoulderR = rig.p('shoulderR')
  const mNeckL = rig.p('neckL')
  const torsoLen = rig.p('crotch')[1] - mShoulderL[1]

  const srcCx = (m.chestL + m.chestR) / 2 / scale
  const srcChestW = (m.chestR - m.chestL) / scale
  const chestHalf = rig.bodyHalf(mArmpitL[1] + torsoLen * 0.05)
  const s = (2 * chestHalf * 1.1) / Math.max(1, srcChestW)
  const srcArmY = m.armpitL[1] / scale
  const mArmY = mArmpitL[1] + 3 * K
  const yMap = (y: number) => mArmY + s * (y - srcArmY)
  const side = (p: Pt, which: 'L' | 'R'): Pt => {
    const ps = S(p)
    const y = yMap(ps[1])
    const half = Math.max(Math.abs(s * (ps[0] - srcCx)), rig.bodyHalf(y) * 1.04 + 2 * K)
    return [which === 'L' ? c - half : c + half, y]
  }

  const pairs: Pair[] = []
  const P = (t: Pt, s0: Pt) => pairs.push({ t, s: s0 })

  // neck
  const neckHalfBody = c - mNeckL[0]
  const srcNeckHalf = ((m.neckR[0] - m.neckL[0]) / 2 / scale) * s
  const tNeckHalf = Math.max(neckHalfBody * 1.22, srcNeckHalf * 0.9)
  const tNeckY = mNeckL[1] + 2 * K
  const tNeckL: Pt = [c - tNeckHalf, tNeckY]
  const tNeckR: Pt = [c + tNeckHalf, tNeckY]
  const dip = ((m.neckC[1] - (m.neckL[1] + m.neckR[1]) / 2) / scale) * s
  P(tNeckL, S(m.neckL))
  P(tNeckR, S(m.neckR))
  P([c, tNeckY + Math.max(2 * K, dip)], S(m.neckC))

  // shoulders: on the mannequin's shoulders, or dropped over the arm for loose fits
  const hasSleeves = !!(m.sleeveL && m.sleeveR)
  const shoulder = (sp: Pt, ms: Pt, which: 'L' | 'R'): Pt => {
    let half = Math.abs(s * (sp[0] / scale - srcCx))
    if (hasSleeves) half = Math.max(half, Math.abs(ms[0] - c) * 1.03)
    const mHalf = Math.abs(ms[0] - c)
    if (half > mHalf * 1.06) return [which === 'L' ? c - half : c + half, ms[1] + (half - mHalf) * 0.5]
    const t = Math.max(0, Math.min(1, (half - tNeckHalf) / Math.max(1, mHalf - tNeckHalf)))
    return [which === 'L' ? c - Math.max(half, tNeckHalf * 1.2) : c + Math.max(half, tNeckHalf * 1.2), tNeckY + (ms[1] - tNeckY) * t + 2 * K]
  }
  const tShL = shoulder(m.shoulderL, mShoulderL, 'L')
  const tShR = shoulder(m.shoulderR, mShoulderR, 'R')
  P(tShL, S(m.shoulderL))
  P(tShR, S(m.shoulderR))
  const torsoLenSrc = (m.hemL[1] - m.armpitL[1]) / scale

  // armpits and body
  const tApL: Pt = [c - Math.max(Math.abs(s * (m.armpitL[0] / scale - srcCx)), (c - mArmpitL[0]) * 1.04), mArmY]
  const tApR: Pt = [c + Math.max(Math.abs(s * (m.armpitR[0] / scale - srcCx)), (mArmpitR[0] - c) * 1.04), mArmY]
  P(tApL, S(m.armpitL))
  P(tApR, S(m.armpitR))
  P(mid(tShL, tApL), mid(S(m.shoulderL), S(m.armpitL)))
  P(mid(tShR, tApR), mid(S(m.shoulderR), S(m.armpitR)))
  const tSideL = m.sideL.map((q) => side(q, 'L'))
  const tSideR = m.sideR.map((q) => side(q, 'R'))
  m.sideL.forEach((q, i) => P(tSideL[i], S(q)))
  m.sideR.forEach((q, i) => P(tSideR[i], S(q)))
  const tHemL = side(m.hemL, 'L')
  const tHemR = side(m.hemR, 'R')
  P(tHemL, S(m.hemL))
  P(tHemR, S(m.hemR))
  // centre line keeps prints straight
  P([c, yMap(m.chestY / scale)], [srcCx, m.chestY / scale])
  const hemMidSrc: Pt = [(m.hemL[0] + m.hemR[0]) / 2 / scale, (m.hemL[1] / scale + m.chestY / scale) / 2 + (m.hemL[1] / scale - m.chestY / scale) * 0.4]
  P([c, yMap(hemMidSrc[1])], hemMidSrc)

  // the body of the garment
  const torsoOutline: Pt[] = [tNeckL, tShL, tApL, ...tSideL, tHemL, tHemR, ...[...tSideR].reverse(), tApR, tShR, tNeckR]
  const srcTorso: Pt[] = [
    S(m.neckL), S(m.shoulderL), S(m.armpitL), ...m.sideL.map(S), S(m.hemL), S(m.hemR),
    ...[...m.sideR].reverse().map(S), S(m.armpitR), S(m.shoulderR), S(m.neckR),
  ]
  const parts: Part[] = [{ pairs, outline: torsoOutline, srcPoly: srcTorso }]

  // each sleeve follows its arm
  for (const which of ['L', 'R'] as const) {
    const sl = which === 'L' ? m.sleeveL : m.sleeveR
    if (!sl) continue
    const tSh = which === 'L' ? tShL : tShR
    const tAp = which === 'L' ? tApL : tApR
    const sSh = S(which === 'L' ? m.shoulderL : m.shoulderR)
    const sAp = S(which === 'L' ? m.armpitL : m.armpitR)
    const sOuter = S(sl.outer)
    const sInner = S(sl.inner)
    const sRoot = mid(sSh, sAp)
    const sCuff = mid(sOuter, sInner)
    const tRoot = mid(tSh, tAp)
    const elbow = rig.p(which === 'L' ? 'elbowL' : 'elbowR')
    const wrist = rig.p(which === 'L' ? 'wristL' : 'wristR')
    const path: Pt[] = [tRoot, elbow, wrist]
    const toWrist = len(sub(elbow, tRoot)) + len(sub(wrist, elbow))
    path.push(add(wrist, mul(norm(sub(wrist, elbow)), 70 * K)))
    let L = s * len(sub(sCuff, sRoot))
    // long sleeves end at the wrist (the mannequin's arms are longer than most people's)
    const ratio = len(sub(sCuff, sRoot)) / Math.max(1, torsoLenSrc)
    const usuallyLong = LONG_SLEEVES.has(subCategory)
    if (ratio > 0.72 || (usuallyLong && ratio > 0.5) || L > toWrist * 0.8) L = toWrist * 0.97
    const w = walk(path, L)
    const armR = w.t < 0.5 ? rig.armR[0] + (rig.armR[1] - rig.armR[0]) * (w.t / 0.5) : rig.armR[1] + (rig.armR[2] - rig.armR[1]) * ((w.t - 0.5) / 0.5)
    const cuffHalf = Math.min((s * len(sub(sOuter, sInner))) / 2, armR * 2.2)
    const hw = Math.max(cuffHalf, armR * 1.18)
    const n: Pt = [-w.dir[1], w.dir[0]]
    const outward: Pt = (which === 'L' ? -n[0] : n[0]) >= 0 ? n : mul(n, -1)
    const tOuter = add(w.p, mul(outward, hw))
    const tInner = add(w.p, mul(outward, -hw))
    // middle of the sleeve: half way along the arm
    const wm = walk(path, L * 0.5)
    const armRm = rig.armR[0] + (rig.armR[1] - rig.armR[0]) * Math.min(1, wm.t / 0.5)
    const sHalfMid = (len(sub(sSh, sAp)) / 2 + len(sub(sOuter, sInner)) / 2) / 2
    const hwm = Math.max(Math.min(s * sHalfMid, armRm * 2.4), armRm * 1.2)
    const nm: Pt = [-wm.dir[1], wm.dir[0]]
    const outm: Pt = (which === 'L' ? -nm[0] : nm[0]) >= 0 ? nm : mul(nm, -1)
    const sp: Pair[] = [
      { t: tSh, s: sSh },
      { t: tAp, s: sAp },
      { t: tRoot, s: sRoot },
      { t: tOuter, s: sOuter },
      { t: tInner, s: sInner },
      { t: w.p, s: sCuff },
      { t: add(wm.p, mul(outm, hwm)), s: mid(sSh, sOuter) },
      { t: add(wm.p, mul(outm, -hwm)), s: mid(sAp, sInner) },
      { t: wm.p, s: mid(sRoot, sCuff) },
    ]
    parts.push({
      pairs: sp,
      outline: [tSh, add(wm.p, mul(outm, hwm)), tOuter, tInner, add(wm.p, mul(outm, -hwm)), tAp],
      srcOutside: srcTorso,
      side: which,
    })
  }
  return parts
}

function fitBottom(img: ImageData, rig: Rig, fullLength: boolean): Part[] | null {
  const { bin, scale } = binFromAlpha(img)
  const m = bottomMarks(bin)
  if (!m) return null
  const S = (p: Pt): Pt => [p[0] / scale, p[1] / scale]
  const c = rig.c
  const mCrotch = rig.p('crotch')
  const hipHalf = rig.bodyHalf(mCrotch[1] - 8 * K)
  const srcHipW = (m.hipR[0] - m.hipL[0]) / scale
  const s = (2 * hipHalf * 1.08) / Math.max(1, srcHipW)
  const srcCx = m.crotch[0] / scale
  const srcCy = m.crotch[1] / scale
  const tCrotchY = mCrotch[1] + 5 * K
  const footY = rig.y('footY')
  // full-length trousers reach the ankle even though the mannequin's legs are long
  const srcHem = Math.max(m.legL.outer[1], m.legR.outer[1]) / scale
  const ankleY = rig.p('ankleL')[1] + 10 * K
  const naturalHem = tCrotchY + s * (srcHem - srcCy)
  const legStretch = fullLength && naturalHem < ankleY ? (ankleY - tCrotchY) / Math.max(1, naturalHem - tCrotchY) : 1
  const yMap = (y: number) =>
    Math.min(footY - 6 * K, y <= srcCy ? tCrotchY + s * (y - srcCy) : tCrotchY + s * legStretch * (y - srcCy))
  const sideT = (p: Pt, which: 'L' | 'R'): Pt => {
    const ps = S(p)
    const y = yMap(ps[1])
    const half = Math.max(Math.abs(s * (ps[0] - srcCx)), rig.bodyHalf(Math.min(y, tCrotchY - 2)) * 1.03 + 2 * K)
    return [which === 'L' ? c - half : c + half, y]
  }
  const pairs: Pair[] = []
  const P = (t: Pt, s0: Pt) => pairs.push({ t, s: s0 })
  const tWL = sideT(m.waistL, 'L')
  const tWR = sideT(m.waistR, 'R')
  const tML = sideT(m.midL, 'L')
  const tMR = sideT(m.midR, 'R')
  const tHL = sideT(m.hipL, 'L')
  const tHR = sideT(m.hipR, 'R')
  P(tWL, S(m.waistL))
  P(tWR, S(m.waistR))
  P(tML, S(m.midL))
  P(tMR, S(m.midR))
  P(tHL, S(m.hipL))
  P(tHR, S(m.hipR))
  P([c, tCrotchY], S(m.crotch))
  P([c, yMap((m.waistL[1] / scale + srcCy) / 2)], [srcCx, (m.waistL[1] / scale + srcCy) / 2])

  const legPts = (which: 'L' | 'R') => {
    const lg = which === 'L' ? m.legL : m.legR
    const place = (outerP: Pt, innerP: Pt) => {
      const y = yMap(S(outerP)[1])
      const { axis, half } = rig.leg(y)
      const ax = which === 'L' ? axis : 2 * c - axis
      const hw = Math.max((s * Math.abs(outerP[0] - innerP[0])) / scale / 2, half * 1.1 + 2 * K)
      const outer: Pt = [which === 'L' ? ax - hw : ax + hw, y]
      let inner: Pt = [which === 'L' ? ax + hw : ax - hw, y]
      inner = [which === 'L' ? Math.min(inner[0], c - 2 * K) : Math.max(inner[0], c + 2 * K), y]
      return { outer, inner, centre: [ax, y] as Pt }
    }
    const knee = place(lg.kneeOuter, lg.kneeInner)
    const hem = place(lg.outer, lg.inner)
    P(knee.outer, S(lg.kneeOuter))
    P(knee.inner, S(lg.kneeInner))
    P(hem.outer, S(lg.outer))
    P(hem.inner, S(lg.inner))
    P(knee.centre, mid(S(lg.kneeOuter), S(lg.kneeInner)))
    return { knee, hem }
  }
  const L = legPts('L')
  const R = legPts('R')
  const outline: Pt[] = [
    tWL, tML, tHL, L.knee.outer, L.hem.outer, L.hem.inner, L.knee.inner, [c, tCrotchY],
    R.knee.inner, R.hem.inner, R.hem.outer, R.knee.outer, tHR, tMR, tWR,
  ]
  return [{ pairs, outline }]
}

function fitSkirt(img: ImageData, rig: Rig): Part[] | null {
  const { bin, scale } = binFromAlpha(img)
  const m = skirtMarks(bin)
  if (!m) return null
  const S = (p: Pt): Pt => [p[0] / scale, p[1] / scale]
  const c = rig.c
  const waistY = rig.y('waistY')
  const srcW = (m.waistR[0] - m.waistL[0]) / scale
  const s = (2 * rig.bodyHalf(waistY) * 1.05) / Math.max(1, srcW)
  const srcCx = (m.waistL[0] + m.waistR[0]) / 2 / scale
  const yMap = (y: number) => waistY + s * (y - m.waistL[1] / scale)
  const sideT = (p: Pt, which: 'L' | 'R'): Pt => {
    const ps = S(p)
    const y = yMap(ps[1])
    const half = Math.max(Math.abs(s * (ps[0] - srcCx)), rig.bodyHalf(y) * 1.05 + 2 * K)
    return [which === 'L' ? c - half : c + half, y]
  }
  const pairs: Pair[] = []
  const pts: [Pt, 'L' | 'R'][] = [
    [m.waistL, 'L'], [m.waistR, 'R'], [m.midL, 'L'], [m.midR, 'R'], [m.hemL, 'L'], [m.hemR, 'R'],
  ]
  const t = pts.map(([p, w]) => sideT(p, w))
  pts.forEach(([p], i) => pairs.push({ t: t[i], s: S(p) }))
  pairs.push({ t: [c, yMap(m.midL[1] / scale)], s: [srcCx, m.midL[1] / scale] })
  return [{ pairs, outline: [t[0], t[2], t[4], t[5], t[3], t[1]] }]
}

// ---------- Simple placement (shoes, accessories, and a safe fallback) ----------

function placeBox(img: ImageData, rig: Rig, kind: Kind): { x: number; y: number; w: number; h: number } {
  const c = rig.c
  const ar = img.width / img.height
  const shL = rig.p('shoulderL')
  const shoulderSpan = rig.p('shoulderR')[0] - shL[0]
  const byWidth = (w: number, cx: number, top: number) => ({ x: cx - w / 2, y: top, w, h: w / ar })
  switch (kind) {
    case 'shoes': {
      const aL = rig.p('ankleL')
      const aR = rig.p('ankleR')
      const w = (aR[0] - aL[0]) * 1.9
      const h = w / ar
      return { x: c - w / 2, y: rig.y('footY') + 14 * K - h, w, h }
    }
    case 'cap': {
      const top = rig.p('headTop')
      const w = rig.headHalf * 2 * 1.45
      return byWidth(w, c, top[1] - w / ar * 0.18)
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
      const w = h * ar
      return { x: c - w / 2, y: n[1] + 4 * K, w, h }
    }
    case 'scarf': {
      const n = rig.p('neckL')
      return byWidth(shoulderSpan * 0.62, c, n[1] - 8 * K)
    }
    case 'bag': {
      const wr = rig.p('wristR')
      const w = shoulderSpan * 0.5
      return byWidth(w, wr[0] + w * 0.15, wr[1] - w / ar * 0.25)
    }
    case 'bottom': {
      const top = rig.y('hipsY') - 40 * K
      const h = rig.y('footY') - top
      const w = Math.min(h * ar, rig.bodyHalf(rig.p('crotch')[1] - 10) * 2.3)
      return { x: c - w / 2, y: top, w, h: w / ar }
    }
    default: {
      const w = shoulderSpan * 1.25
      return byWidth(w, c, rig.p('neckL')[1] - 6 * K)
    }
  }
}

// ---------- Rendering ----------

function sampler(img: ImageData) {
  const { width: w, height: h, data } = img
  // premultiplied bilinear sampling, so edges never get dark fringes
  return (x: number, y: number, out: number[]) => {
    if (x < -0.5 || y < -0.5 || x > w - 0.5 || y > h - 0.5) {
      out[3] = 0
      return
    }
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)))
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)))
    const x1 = Math.min(w - 1, x0 + 1)
    const y1 = Math.min(h - 1, y0 + 1)
    const fx = Math.max(0, Math.min(1, x - x0))
    const fy = Math.max(0, Math.min(1, y - y0))
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    const acc = (xx: number, yy: number, wt: number) => {
      const i = (yy * w + xx) * 4
      const al = data[i + 3] * wt
      r += data[i] * al
      g += data[i + 1] * al
      b += data[i + 2] * al
      a += al
    }
    acc(x0, y0, (1 - fx) * (1 - fy))
    acc(x1, y0, fx * (1 - fy))
    acc(x0, y1, (1 - fx) * fy)
    acc(x1, y1, fx * fy)
    if (a <= 0) {
      out[3] = 0
      return
    }
    out[0] = r / a
    out[1] = g / a
    out[2] = b / a
    out[3] = a
  }
}

function applyShade(out: ImageData, ox: number, oy: number, shade: ImageData, strength: number) {
  const sw = shade.width
  const sh = shade.height
  for (let y = 0; y < out.height; y++) {
    const sy = Math.min(sh - 1, Math.max(0, Math.round((y + oy) / K)))
    for (let x = 0; x < out.width; x++) {
      const i = (y * out.width + x) * 4
      if (!out.data[i + 3]) continue
      const sx = Math.min(sw - 1, Math.max(0, Math.round((x + ox) / K)))
      const j = (sy * sw + sx) * 4
      const v = shade.data[j] / 255
      const covered = shade.data[j + 3] / 255
      let f = 0.48 + 0.62 * v
      f = Math.max(0.62, Math.min(1.07, f))
      f = covered * f + (1 - covered) * 0.93
      const k = 1 + (f - 1) * strength
      out.data[i] = Math.min(255, out.data[i] * k)
      out.data[i + 1] = Math.min(255, out.data[i + 1] * k)
      out.data[i + 2] = Math.min(255, out.data[i + 2] * k)
    }
  }
}

function boundsOf(pts: Pt[], pad: number) {
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
  const W = MANNEQUIN_W * K
  const H = MANNEQUIN_H * K
  x0 = Math.max(0, Math.floor(x0 - pad))
  y0 = Math.max(0, Math.floor(y0 - pad))
  x1 = Math.min(W, Math.ceil(x1 + pad))
  y1 = Math.min(H, Math.ceil(y1 + pad))
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }
}

function pointInPoly(x: number, y: number, poly: Pt[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) inside = !inside
  }
  return inside
}

/** A lookup of which photo pixels belong to the body of the garment (slightly widened). */
function regionMask(img: ImageData, poly: Pt[]): Uint8Array {
  const c = makeCanvas(img.width, img.height)
  const x = ctx2d(c)
  x.beginPath()
  poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)))
  x.closePath()
  x.fillStyle = '#000'
  x.fill()
  x.lineWidth = Math.max(4, img.width * 0.012)
  x.lineJoin = 'round'
  x.strokeStyle = '#000'
  x.stroke()
  const d = x.getImageData(0, 0, img.width, img.height).data
  const out = new Uint8Array(img.width * img.height)
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 0 ? 1 : 0
  return out
}

function renderParts(img: ImageData, parts: Part[]): { out: ImageData; box: { x: number; y: number; w: number; h: number } } {
  const all = parts.flatMap((p) => p.outline)
  const span = Math.max(...all.map((p) => p[0])) - Math.min(...all.map((p) => p[0]))
  const pad = Math.max(10, span * 0.07)
  const box = boundsOf(all, pad)
  const out = new ImageData(box.w, box.h)
  const sample = sampler(img)
  const px = [0, 0, 0, 0]
  const torsoPoly = parts.find((p) => p.srcPoly)?.srcPoly
  const torsoMask = torsoPoly && parts.length > 1 ? regionMask(img, torsoPoly) : null
  const srcCx = torsoPoly ? torsoPoly.reduce((a, p) => a + p[0], 0) / torsoPoly.length : img.width / 2

  // body first, then sleeves on top (arms hang in front of the body's sides)
  for (const part of parts) {
    const map = thinPlateSpline(
      part.pairs.map((p) => p.t),
      part.pairs.map((p) => p.s),
    )
    const clip = makeCanvas(box.w, box.h)
    const cc = ctx2d(clip)
    cc.translate(-box.x, -box.y)
    cc.beginPath()
    part.outline.forEach(([x, y], i) => (i ? cc.lineTo(x, y) : cc.moveTo(x, y)))
    cc.closePath()
    cc.fillStyle = '#000'
    cc.strokeStyle = '#000'
    cc.lineJoin = 'round'
    cc.lineWidth = pad * (part.side ? 1.2 : 1.6)
    cc.fill()
    cc.stroke()
    const clipA = cc.getImageData(0, 0, box.w, box.h).data

    const G = 4
    const gw = Math.ceil(box.w / G) + 1
    const gh = Math.ceil(box.h / G) + 1
    const gx = new Float32Array(gw * gh)
    const gy = new Float32Array(gw * gh)
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        if (!clipA[(Math.min(box.h - 1, j * G) * box.w + Math.min(box.w - 1, i * G)) * 4 + 3] && !clipA[(Math.min(box.h - 1, Math.max(0, j * G - G)) * box.w + Math.min(box.w - 1, Math.max(0, i * G - G))) * 4 + 3]) {
          gx[j * gw + i] = NaN
          continue
        }
        const [sx, sy] = map(box.x + i * G, box.y + j * G)
        gx[j * gw + i] = sx
        gy[j * gw + i] = sy
      }
    }
    for (let y = 0; y < box.h; y++) {
      const j = Math.min(gh - 2, Math.floor(y / G))
      const fy = y / G - j
      for (let x = 0; x < box.w; x++) {
        const o = (y * box.w + x) * 4
        if (!clipA[o + 3]) continue
        const i = Math.min(gw - 2, Math.floor(x / G))
        const fx = x / G - i
        const a = j * gw + i
        let sx = (gx[a] * (1 - fx) + gx[a + 1] * fx) * (1 - fy) + (gx[a + gw] * (1 - fx) + gx[a + gw + 1] * fx) * fy
        let sy = (gy[a] * (1 - fx) + gy[a + 1] * fx) * (1 - fy) + (gy[a + gw] * (1 - fx) + gy[a + gw + 1] * fx) * fy
        if (Number.isNaN(sx)) {
          const r = map(box.x + x, box.y + y)
          sx = r[0]
          sy = r[1]
        }
        if (torsoMask && part.side) {
          // a sleeve only takes photo pixels outside the garment's body, on its own side
          const ix = Math.round(sx)
          const iy = Math.round(sy)
          if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) continue
          if (torsoMask[iy * img.width + ix]) continue
          if (part.side === 'L' ? sx > srcCx : sx < srcCx) continue
        } else if (torsoMask && !part.side) {
          const ix = Math.round(sx)
          const iy = Math.round(sy)
          if (ix >= 0 && iy >= 0 && ix < img.width && iy < img.height && !torsoMask[iy * img.width + ix]) continue
        }
        sample(sx, sy, px)
        if (px[3] <= 0) continue
        const alpha = Math.min(255, px[3]) * (clipA[o + 3] / 255)
        // paint over what is already there (sleeves over the body)
        const ea = out.data[o + 3] / 255
        const na = alpha / 255
        const ra = na + ea * (1 - na)
        if (ra <= 0) continue
        out.data[o] = (px[0] * na + out.data[o] * ea * (1 - na)) / ra
        out.data[o + 1] = (px[1] * na + out.data[o + 1] * ea * (1 - na)) / ra
        out.data[o + 2] = (px[2] * na + out.data[o + 2] * ea * (1 - na)) / ra
        out.data[o + 3] = ra * 255
      }
    }
  }
  void pointInPoly
  return { out, box }
}

function renderPlaced(img: ImageData, box: { x: number; y: number; w: number; h: number }) {
  const src = makeCanvas(img.width, img.height)
  ctx2d(src).putImageData(img, 0, 0)
  const b = { x: Math.round(box.x), y: Math.round(box.y), w: Math.max(1, Math.round(box.w)), h: Math.max(1, Math.round(box.h)) }
  const c = makeCanvas(b.w, b.h)
  ctx2d(c).drawImage(src, 0, 0, b.w, b.h)
  return { out: ctx2d(c).getImageData(0, 0, b.w, b.h), box: b }
}

/**
 * Fits one side (front or back) of a garment onto a mannequin.
 * `img` is the upright cut-out (transparent background).
 */
export async function fitGarment(
  img: ImageData,
  subCategory: string,
  gender: MannequinGender,
  view: View,
): Promise<FitResult> {
  const rig = getRig(gender)
  const kind = garmentKind(subCategory)
  let result: { out: ImageData; box: { x: number; y: number; w: number; h: number } } | null = null
  let strength = 0.85

  const fullLength = ['jeans', 'trousers-casual', 'trousers-formal', 'leggings'].includes(subCategory)
  const warped =
    kind === 'top'
      ? fitTop(img, rig, subCategory)
      : kind === 'bottom'
        ? (fitBottom(img, rig, fullLength) ?? fitSkirt(img, rig))
        : kind === 'skirt'
          ? fitSkirt(img, rig)
          : null
  if (warped) result = renderParts(img, warped)
  else {
    result = renderPlaced(img, placeBox(img, rig, kind))
    strength = kind === 'shoes' || kind === 'bag' || kind === 'belt' ? 0.35 : 0.6
  }

  const shade = await getShade(gender, view).catch(() => null)
  if (shade) applyShade(result.out, result.box.x, result.box.y, shade, strength)

  const canvas = makeCanvas(result.box.w, result.box.h)
  ctx2d(canvas).putImageData(result.out, 0, 0)
  const W = MANNEQUIN_W * K
  const H = MANNEQUIN_H * K
  return {
    canvas,
    rect: { x: result.box.x / W, y: result.box.y / H, w: result.box.w / W, h: result.box.h / H },
  }
}
