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
