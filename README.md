# Vitrine

Photograph your own clothes, cut out the background, and style them on a glossy black boutique mannequin.
Everything stays on your phone: no account, no login, no uploads.

## Install it on your phone

**Android (Chrome):** open the app link, then tap **Install** on the banner (or menu ⋮ → *Install app*).

**iPhone (Safari only):** open the app link in Safari → tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.

After the first open, the app works without internet.

## Keep your wardrobe safe

Your clothes are stored only inside the browser on your phone. If you delete the app or clear browser data,
they are gone. Use **Settings → Backup** regularly (backup arrives in Stage 6).

## The mannequins

The mannequin pictures in `public/mannequins/` (972×2160, front and back, plus `shade-*` body-shading maps)
are rendered from the MakeHuman base model (CC0 assets): `scripts/mannequin/mesh.py` builds the bodies,
`render3d.py` + `render3d.html` render them, and `rig.py` measures them into `src/config/mannequinRig.json`.
Setup steps are at the top of `render3d.py`. To use your own pictures, keep the same file names, size and
pose, then re-run `rig.py`.

## Build progress

- [x] Stage 1 – Setup, installable app, tabs, empty screens, on-phone database
- [x] Stage 1b – Vitrine redesign: name, logo, rendered mannequins, boutique-window look
- [x] Stage 2 – Add a piece: camera/gallery, on-phone background removal, fix-edges brush, save
- [x] Stage 2b – Fitting: pieces are reshaped onto the mannequin (collar, shoulders, sleeves, legs) with body shading; auto-turn of sideways/upside-down photos; print close-ups; piece pages; working Try-on with layering and mirror
- [x] Redesign – indigo + pastel closet design, Bricolage Grotesque / Figtree, new hanger logo; Closet dashboard with categories, search and filters; Save look + Looks gallery
- [x] Real-photo try-on – the cut-out of your own photo is placed on the mannequin (paper-doll style): scaled to the shoulders for tops and coats, to the waist for trousers and skirts. Nothing is redrawn, stylised or turned into a cartoon
- [ ] Stage 3 – Editing piece details, adjust fit by hand
- [ ] Stage 4 – Mannequins and Try-On canvas
- [ ] Stage 5 – Mirror back view, shading, remembered fit
- [ ] Stage 6 – Saved outfits, export, backup/restore, storage meter
- [ ] Stage 7 – Polish, onboarding, error handling, offline test

## For developers

```bash
npm install
npm run dev      # local development
npm run build    # production build in dist/
python3 scripts/mannequin/render3d.py # re-render mannequins (see the setup notes in that file)
node scripts/make-icons.mjs           # regenerate logo, icons and splash screens
```

Tech: React + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa.
How it works: the background is removed on the device (`src/workers/bg.worker.ts`, IMG.LY model, no uploads), then `src/lib/cutout.ts` removes backdrop the model wrongly kept (flat areas of the backdrop's colour at the edge or seen through gaps) and hanger hooks. `src/lib/fit/analyze.ts` turns sideways/upside-down photos the right way up and finds the shoulders or waistband; `src/lib/fit/fit.ts` scales and places the real photo on the mannequin, lets the mannequin's neck show in front of the inside of collars, and adds gentle body shading from `public/mannequins/shade-*.png`. Layer order is in `src/config/fitRules.ts`.

All visible text lives in `src/i18n/en.ts`. Database schema and migrations live in `src/db/db.ts`.
Pushing to `main` publishes the app to GitHub Pages automatically (`.github/workflows/deploy.yml`).
