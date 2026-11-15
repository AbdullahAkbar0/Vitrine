// Turning a photo + mask into a clean garment cut-out.
// The photo's own pixels are kept exactly: only transparency changes. No colour changes, no stylising.
import { ctx2d, makeCanvas } from './image'

/** Removes faint haze and softens the edge by about 1 pixel so it does not look jagged. */
export function cleanMask(mask: Uint8Array, w: number, h: number): Uint8Array {
  const src = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i]
    src[i] = a < 12 ? 0 : a > 243 ? 255 : a
  }
  // 1px feather: 3x3 average, only where the edge is
  const out = new Uint8Array(src)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const c = src[i]
      const up = src[i - w]
      const dn = src[i + w]
      const lf = src[i - 1]
      const rt = src[i + 1]
      if (c === up && c === dn && c === lf && c === rt) continue
      out[i] = Math.round(
        (src[i - w - 1] + up + src[i - w + 1] + lf + c * 2 + rt + src[i + w - 1] + dn + src[i + w + 1]) / 10,
      )
    }
  }
  return out
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Tight box around the garment, with 2% padding. */
export function maskBounds(mask: Uint8Array, w: number, h: number): Box | null {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (mask[row + x] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02)
  const x = Math.max(0, minX - pad)
  const y = Math.max(0, minY - pad)
  return { x, y, w: Math.min(w, maxX + pad + 1) - x, h: Math.min(h, maxY + pad + 1) - y }
}

/** Photo pixels + mask as transparency, cropped to the garment. */
export function composeCutout(photo: ImageData, mask: Uint8Array): HTMLCanvasElement | null {
  const { width: w, height: h } = photo
  const box = maskBounds(mask, w, h)
  if (!box) return null
  const full = new ImageData(new Uint8ClampedArray(photo.data), w, h)
  for (let i = 0; i < mask.length; i++) full.data[i * 4 + 3] = mask[i]
  const c = makeCanvas(box.w, box.h)
  ctx2d(c).putImageData(full, -box.x, -box.y)
  return c
}

/** A share of the picture that is garment (0..1). Used to warn about poor results. */
export function coverage(mask: Uint8Array): number {
  let n = 0
  for (let i = 0; i < mask.length; i++) if (mask[i] > 128) n++
  return n / mask.length
}

/**
 * Second check after the AI cut-out: removes pieces of the photo's backdrop that were wrongly kept.
 * A kept region counts as backdrop when it is the backdrop's colour, flat (no fabric texture),
 * reasonably large, and hangs off the edge of the garment (touches the removed area). Backdrop seen
 * through a gap inside the garment (the neck opening of a coat on a hanger, the space between an arm
 * and the body) does not touch the removed area, so it must match the backdrop even more closely.
 * The garment's own white parts (a logo, a white shirt) are textured or do not match the backdrop,
 * so they stay.
 */
export function stripBackdrop(photo: ImageData, mask: Uint8Array): Uint8Array {
  const { width: w, height: h, data } = photo
  const n = w * h
  // backdrop colour: median of the removed pixels
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const step = Math.max(1, Math.floor(n / 40000))
  for (let i = 0; i < n; i += step) {
    if (mask[i] < 16) {
      rs.push(data[i * 4])
      gs.push(data[i * 4 + 1])
      bs.push(data[i * 4 + 2])
    }
  }
  if (rs.length < 200) return mask
  const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1]
  const br = med(rs)
  const bg = med(gs)
  const bb = med(bs)

  // pixels that look like the backdrop
  const like = new Uint8Array(n)
  let kept = 0
  for (let i = 0; i < n; i++) {
    if (mask[i] < 128) continue
    kept++
    const dr = data[i * 4] - br
    const dg = data[i * 4 + 1] - bg
    const db = data[i * 4 + 2] - bb
    if (dr * dr + dg * dg + db * db < 30 * 30) like[i] = 1
  }
  if (!kept) return mask

  // connected regions of backdrop-like pixels
  const label = new Int32Array(n)
  const out = new Uint8Array(mask)
  const stack: number[] = []
  let next = 1
  for (let s = 0; s < n; s++) {
    if (!like[s] || label[s]) continue
    const px: number[] = []
    let touches = false
    let sum = 0
    let sum2 = 0
    let dist = 0
    label[s] = next
    stack.push(s)
    while (stack.length) {
      const p = stack.pop()!
      px.push(p)
      const lum = data[p * 4] * 0.299 + data[p * 4 + 1] * 0.587 + data[p * 4 + 2] * 0.114
      sum += lum
      sum2 += lum * lum
      dist += Math.hypot(data[p * 4] - br, data[p * 4 + 1] - bg, data[p * 4 + 2] - bb)
      const x = p % w
      const y = (p - x) / w
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const q of nb) {
        if (q < 0) continue
        if (mask[q] < 128) touches = true
        else if (like[q] && !label[q]) {
          label[q] = next
          stack.push(q)
        }
      }
    }
    next++
    const area = px.length
    const mean = sum / area
    const spread = Math.sqrt(Math.max(0, sum2 / area - mean * mean))
    const edge = touches && spread < 9 && area > kept * 0.006
    const gap = !touches && spread < 6 && dist / area < 16 && area > kept * 0.003
    if ((edge || gap) && area < kept * 0.5) {
      for (const p of px) out[p] = 0
    }
  }
  return out
}

/**
 * Removes a hanger hook (or a loop / tag string) sticking up from the middle of the garment's top edge.
 * Only a thin part, near the centre, above the garment's real top edge is removed.
 */
export function dropHook(mask: Uint8Array, w: number, h: number): Uint8Array {
  const b = maskBounds(mask, w, h)
  if (!b) return mask
  const bw = b.w
  const cx = b.x + bw / 2
  const thin = Math.max(2, bw * 0.03)
  // scan down from the top until the rows are clearly garment
  let firstSolid = -1
  for (let y = b.y; y < b.y + b.h * 0.2; y++) {
    let count = 0
    let far = false
    for (let x = b.x; x < b.x + bw; x++) {
      if (mask[y * w + x] >= 128) {
        count++
        if (Math.abs(x - cx) > bw * 0.14) far = true
      }
    }
    if (count > thin || far) {
      firstSolid = y
      break
    }
  }
  if (firstSolid <= b.y) return mask
  const out = new Uint8Array(mask)
  for (let y = b.y; y < firstSolid; y++) for (let x = b.x; x < b.x + bw; x++) out[y * w + x] = 0
  return out
}
