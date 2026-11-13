// Creates all app icons from scripts/icon.svg.
// Run with: node scripts/make-icons.mjs
import sharp from 'sharp';
import { readFileSync, copyFileSync } from 'node:fs';

const svg = readFileSync(new URL('./icon.svg', import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

const sizes = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];

for (const [name, size] of sizes) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(name));
}
copyFileSync(new URL('./icon.svg', import.meta.url), out('icon.svg'));

// Simple splash images for iPhone (shown for a moment while the app opens).
const splash = async (w, h, name) => {
  const iconSize = Math.round(Math.min(w, h) * 0.36);
  const icon = await sharp(svg, { density: 300 }).resize(iconSize, iconSize).png().toBuffer();
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="#F7F4F1"/>
      <text x="50%" y="${Math.round(h / 2 + iconSize / 2 + 90)}" text-anchor="middle"
        font-family="Georgia, serif" font-size="${Math.round(w / 14)}" fill="#1C1A19">WardrobeMirror</text>
    </svg>`,
  );
  await sharp(label)
    .composite([{ input: icon, top: Math.round(h / 2 - iconSize / 2), left: Math.round(w / 2 - iconSize / 2) }])
    .png()
    .toFile(out(name));
};
await splash(1170, 2532, 'splash-1170x2532.png');
await splash(1290, 2796, 'splash-1290x2796.png');
await splash(750, 1334, 'splash-750x1334.png');
console.log('Icons created.');
