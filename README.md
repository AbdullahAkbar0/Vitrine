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

## Swap in better mannequin pictures

Put new transparent PNG files with the **same file names** (`female-front.png`, `female-back.png`, `male-front.png`, `male-back.png`) into `public/mannequins/`, keeping the same 820×1933 shape; the app picks them up automatically.

The current mannequins are rendered by `scripts/mannequin/render.html` (run `python3 scripts/mannequin/render.py`). App icons come from `node scripts/make-icons.mjs`.

## Build progress

- [x] Stage 1 – Setup, installable app, tabs, empty screens, on-phone database
- [x] Stage 1b – Vitrine redesign: name, logo, rendered mannequins, boutique-window look
- [x] Stage 2 – Add a piece: camera/gallery, on-phone background removal, fix-edges brush, save
- [x] Stage 2b – Fitting: pieces are reshaped onto the mannequin (collar, shoulders, sleeves, legs) with body shading; auto-turn of sideways/upside-down photos; print close-ups; piece pages; working Try-on with layering and mirror
- [x] Redesign – indigo + pastel closet design, Bricolage Grotesque / Figtree, new hanger logo; Closet dashboard with categories, search and filters; Save look + Looks gallery
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
python3 scripts/mannequin/render.py   # re-render mannequins (needs Chrome + Playwright)
node scripts/make-icons.mjs           # regenerate logo, icons and splash screens
```

Tech: React + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa.
How fitting works: `src/lib/fit/` measures the garment outline (`analyze.ts`), then bends the real photo onto the mannequin landmarks in `src/config/mannequinRig.json` (`fit.ts`, thin-plate spline per body part) and applies body shading from `public/mannequins/shade-*.png`. Layer order is in `src/config/fitRules.ts`. If you replace the mannequin pictures, re-run `python3 scripts/mannequin/rig.py`.

All visible text lives in `src/i18n/en.ts`. Database schema and migrations live in `src/db/db.ts`.
Pushing to `main` publishes the app to GitHub Pages automatically (`.github/workflows/deploy.yml`).
