// Photo helpers: load (with correct orientation), resize, encode.

export class NotAnImageError extends Error {}

/** Loads a photo file. Browsers apply the phone's rotation (EXIF) automatically for <img>. */
export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  if (file.type && !file.type.startsWith('image/')) throw new NotAnImageError()
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new NotAnImageError()
    return img
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e instanceof NotAnImageError ? e : new NotAnImageError()
  }
}

export function releaseImage(img: HTMLImageElement) {
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src)
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is not available')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

/** Draws a source into a new canvas so its longest side is at most maxSide (never enlarges). */
export function fitToCanvas(src: CanvasImageSource & { width: number; height: number }, maxSide: number, srcW?: number, srcH?: number) {
  const w0 = srcW ?? src.width
  const h0 = srcH ?? src.height
  const scale = Math.min(1, maxSide / Math.max(w0, h0))
  const c = makeCanvas(w0 * scale, h0 * scale)
  // Step down in halves for big reductions, which keeps fabric texture crisp.
  let source: CanvasImageSource = src
  let sw = w0
  let sh = h0
  while (sw / 2 > c.width * 1.1) {
    const half = makeCanvas(sw / 2, sh / 2)
    ctx2d(half).drawImage(source, 0, 0, sw, sh, 0, 0, half.width, half.height)
    source = half
    sw = half.width
    sh = half.height
  }
  ctx2d(c).drawImage(source, 0, 0, sw, sh, 0, 0, c.width, c.height)
  return c
}

let webpSupport: boolean | null = null
async function canEncodeWebp(): Promise<boolean> {
  if (webpSupport !== null) return webpSupport
  const b = await toBlobRaw(makeCanvas(2, 2), 'image/webp', 0.8)
  webpSupport = b?.type === 'image/webp'
  return webpSupport
}

function toBlobRaw(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((res) => c.toBlob(res, type, quality))
}

/** Saves a photo: WebP when the phone supports it, otherwise JPEG (no transparency) or PNG (transparency). */
export async function encode(c: HTMLCanvasElement, opts: { transparent: boolean; quality?: number }): Promise<Blob> {
  const q = opts.quality ?? 0.85
  if (await canEncodeWebp()) {
    const b = await toBlobRaw(c, 'image/webp', q)
    if (b) return b
  }
  const b = await toBlobRaw(c, opts.transparent ? 'image/png' : 'image/jpeg', q)
  if (!b) throw new Error('Could not save the image')
  return b
}
