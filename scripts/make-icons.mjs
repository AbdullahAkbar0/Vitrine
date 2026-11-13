// Builds the Vitrine logo, app icons and splash screens.
// Needs scripts/mannequin/out/bust.png (run: python3 scripts/mannequin/render.py bust)
// Run with: node scripts/make-icons.mjs
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'

const here = (p) => new URL(p, import.meta.url).pathname
const out = (name) => here(`../public/icons/${name}`)
mkdirSync(here('../public/icons'), { recursive: true })
mkdirSync(here('../src/assets'), { recursive: true })

const bust = readFileSync(here('./mannequin/out/bust.png')).toString('base64')
const BUST_RATIO = 1013 / 800

/**
 * The mark: a brass shop-window arch with a lacquered egghead bust inside.
 * s = scale of the arch inside the 1024 canvas (smaller for Android's masked icons).
 */
function markSvg({ s = 1, background = true, size = 1024 } = {}) {
  const cx = 512
  const archW = 470 * s
  const x0 = cx - archW / 2
  const x1 = cx + archW / 2
  const r = archW / 2
  const top = 512 - 400 * s
  const spring = top + r
  const bottom = 1024 + 40
  const arch = `M ${x0} ${bottom} V ${spring} A ${r} ${r} 0 0 1 ${x1} ${spring} V ${bottom}`
  const bw = archW * 1.24
  const bh = bw * BUST_RATIO
  const bx = cx - bw / 2
  const by = top + 34 * s
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="velvet" cx="50%" cy="34%" r="78%">
      <stop offset="0" stop-color="#4B2441"/>
      <stop offset="0.55" stop-color="#2A1424"/>
      <stop offset="1" stop-color="#150912"/>
    </radialGradient>
    <radialGradient id="spot" cx="50%" cy="30%" r="42%">
      <stop offset="0" stop-color="#E9CFA0" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#E9CFA0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F6E3B8"/>
      <stop offset="0.45" stop-color="#D2B07A"/>
      <stop offset="1" stop-color="#8E6A35"/>
    </linearGradient>
    <linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.5" stop-color="#fff"/>
      <stop offset="0.94" stop-color="#000"/>
    </linearGradient>
    <mask id="fade" maskUnits="userSpaceOnUse" x="${bx}" y="${by}" width="${bw}" height="${bh}">
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#fadeG)"/>
    </mask>
    <clipPath id="inside"><path d="${arch} Z"/></clipPath>
  </defs>
  ${background ? '<rect width="1024" height="1024" fill="url(#velvet)"/>' : ''}
  <g clip-path="url(#inside)">
    ${background ? '<rect width="1024" height="1024" fill="#1A0B16" opacity="0.55"/>' : '<rect width="1024" height="1024" fill="url(#velvet)"/>'}
    <ellipse cx="512" cy="${top + 250 * s}" rx="${300 * s}" ry="${360 * s}" fill="url(#spot)"/>
     <image mask="url(#fade)" x="${bx}" y="${by}" width="${bw}" height="${bh}" href="data:image/png;base64,${bust}"/>
  </g>
  <path d="${arch}" fill="none" stroke="url(#brass)" stroke-width="${12 * s}"/>
</svg>`
}

const render = (svg, size, file) =>
  sharp(Buffer.from(svg), { density: 72 * (size / 1024) * 2 }).resize(size, size).png().toFile(file)

await render(markSvg(), 512, out('icon-512.png'))
await render(markSvg(), 192, out('icon-192.png'))
await render(markSvg(), 180, out('apple-touch-icon.png'))
await render(markSvg(), 64, out('favicon-64.png'))
await render(markSvg({ s: 0.78 }), 512, out('maskable-512.png'))
// transparent mark for inside the app
await render(markSvg({ background: false }), 256, here('../src/assets/mark.png'))

// iPhone splash screens
async function splash(w, h, name) {
  const iconSize = Math.round(w * 0.86)
  const icon = await sharp(Buffer.from(markSvg({ background: false })), { density: 144 })
    .resize(iconSize, iconSize)
    .png()
    .toBuffer()
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><radialGradient id="g" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="#3A1C33"/><stop offset="1" stop-color="#150912"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="${Math.round(h * 0.42 + iconSize / 2 + w * 0.13)}" text-anchor="middle"
      font-family="Didot, 'Bodoni 72', 'Bodoni Moda', Georgia, serif" font-size="${Math.round(w * 0.1)}"
      letter-spacing="${Math.round(w * 0.004)}" fill="#F4ECE1">Vitrine</text>
  </svg>`
  await sharp(Buffer.from(bg))
    .composite([{ input: icon, top: Math.round(h * 0.42 - iconSize / 2), left: Math.round(w / 2 - iconSize / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(out(name))
}
await splash(1170, 2532, 'splash-1170x2532.png')
await splash(1290, 2796, 'splash-1290x2796.png')
await splash(750, 1334, 'splash-750x1334.png')
console.log('Icons created.')
