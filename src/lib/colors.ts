// Finds the main colour of a garment and gives it a plain name.
import type { TranslationKey } from '../i18n/en'

const NAMED: { key: TranslationKey; hex: string }[] = [
  { key: 'color.black', hex: '#141414' },
  { key: 'color.charcoal', hex: '#3a3d42' },
  { key: 'color.grey', hex: '#8d8d8d' },
  { key: 'color.white', hex: '#f4f4f2' },
  { key: 'color.cream', hex: '#efe5cf' },
  { key: 'color.beige', hex: '#d3bf9e' },
  { key: 'color.khaki', hex: '#a99b6e' },
  { key: 'color.tan', hex: '#bf9466' },
  { key: 'color.brown', hex: '#69442a' },
  { key: 'color.navy', hex: '#1f2a44' },
  { key: 'color.blue', hex: '#2f63b0' },
  { key: 'color.lightBlue', hex: '#9cc0e3' },
  { key: 'color.denim', hex: '#4a6488' },
  { key: 'color.teal', hex: '#1e7373' },
  { key: 'color.green', hex: '#2f7a3a' },
  { key: 'color.olive', hex: '#69703a' },
  { key: 'color.mint', hex: '#a7dcc4' },
  { key: 'color.yellow', hex: '#ecc94b' },
  { key: 'color.mustard', hex: '#c39b2a' },
  { key: 'color.orange', hex: '#e07a2b' },
  { key: 'color.red', hex: '#bf2f2f' },
  { key: 'color.burgundy', hex: '#6e1f33' },
  { key: 'color.pink', hex: '#efa6be' },
  { key: 'color.purple', hex: '#64398f' },
  { key: 'color.lavender', hex: '#b8a6d8' },
]

type Lab = [number, number, number]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToLab([r, g, b]: [number, number, number]): Lab {
  const lin = (v: number) => {
    v /= 255
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

const NAMED_LAB = NAMED.map((c) => ({ ...c, lab: rgbToLab(hexToRgb(c.hex)) }))

export function nameColor(hex: string): TranslationKey {
  const lab = rgbToLab(hexToRgb(hex))
  let best = NAMED_LAB[0]
  let bestD = Infinity
  for (const c of NAMED_LAB) {
    const d = (c.lab[0] - lab[0]) ** 2 + (c.lab[1] - lab[1]) ** 2 + (c.lab[2] - lab[2]) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best.key
}

/** Most common colour among the garment's solid pixels. */
export function dominantColor(photo: ImageData, mask: Uint8Array): string {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  const d = photo.data
  const step = Math.max(1, Math.floor(mask.length / 60000))
  for (let i = 0; i < mask.length; i += step) {
    if (mask[i] < 220) continue
    const r = d[i * 4]
    const g = d[i * 4 + 1]
    const b = d[i * 4 + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bin.n++
    bin.r += r
    bin.g += g
    bin.b += b
    bins.set(key, bin)
  }
  // merge each bin with its neighbours so shading on fabric does not split the colour
  let best: { n: number; r: number; g: number; b: number } | null = null
  let bestScore = -1
  for (const [key, bin] of bins) {
    let score = bin.n
    for (const dk of [1, 16, 256]) {
      score += (bins.get(key + dk)?.n ?? 0) * 0.5 + (bins.get(key - dk)?.n ?? 0) * 0.5
    }
    if (score > bestScore) {
      bestScore = score
      best = bin
    }
  }
  if (!best) return '#808080'
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${hex(best.r / best.n)}${hex(best.g / best.n)}${hex(best.b / best.n)}`
}
