// Builds the Vitrine logo, app icons and splash screens.
// Run with: node scripts/make-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const here = (p) => new URL(p, import.meta.url).pathname
const out = (name) => here(`../public/icons/${name}`)
mkdirSync(here('../public/icons'), { recursive: true })
mkdirSync(here('../src/assets'), { recursive: true })

/** The mark: a hanger with a peony swing tag. `s` scales it inside the tile (smaller for Android masks). */
function glyph(s = 1) {
  return `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">
    <g fill="none" stroke="#fff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round">
      <path d="M458 270 A56 56 0 1 1 540 318 Q512 334 512 366 V386"/>
      <path d="M512 386 L250 566 Q226 584 256 590 H768 Q798 584 774 566 Z"/>
    </g>
    <path d="M692 590 L712 648" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
    <g transform="rotate(-14 712 720)">
      <path d="M672 650 h80 a18 18 0 0 1 18 18 v128 a18 18 0 0 1 -18 18 h-80 a18 18 0 0 1 -18 -18 v-128 a18 18 0 0 1 18 -18 z" fill="#ff7fa0"/>
      <circle cx="712" cy="676" r="11" fill="#2b2794"/>
      <rect x="676" y="724" width="72" height="10" rx="5" fill="#fff" opacity="0.85"/>
      <rect x="676" y="748" width="48" height="10" rx="5" fill="#fff" opacity="0.6"/>
    </g>
  </g>`
}

function iconSvg({ s = 1, size = 1024 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4440d0"/>
      <stop offset="1" stop-color="#211d78"/>
    </linearGradient>
    <radialGradient id="glow" cx="28%" cy="18%" r="70%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  ${glyph(s)}
</svg>`
}

const render = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)

await render(iconSvg(), 512, out('icon-512.png'))
await render(iconSvg(), 192, out('icon-192.png'))
await render(iconSvg(), 180, out('apple-touch-icon.png'))
await render(iconSvg(), 64, out('favicon-64.png'))
await render(iconSvg({ s: 0.8 }), 512, out('maskable-512.png'))
// rounded version for inside the app
const rounded = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" rx="230" fill="#fff"/></svg>`,
)
await sharp(Buffer.from(iconSvg()))
  .resize(256, 256)
  .composite([{ input: await sharp(rounded).resize(256, 256).png().toBuffer(), blend: 'dest-in' }])
  .png()
  .toFile(here('../src/assets/mark.png'))

// iPhone splash screens: the mark on indigo
async function splash(w, h, name) {
  const size = Math.round(w * 0.36)
  const mark = await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${glyph(1)}</svg>`),
  )
    .resize(size, size)
    .png()
    .toBuffer()
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4440d0"/><stop offset="1" stop-color="#211d78"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`
  await sharp(Buffer.from(bg))
    .composite([{ input: mark, top: Math.round(h * 0.44 - size / 2), left: Math.round(w / 2 - size / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(out(name))
}
await splash(1170, 2532, 'splash-1170x2532.png')
await splash(1290, 2796, 'splash-1290x2796.png')
await splash(750, 1334, 'splash-750x1334.png')
console.log('Icons created.')
