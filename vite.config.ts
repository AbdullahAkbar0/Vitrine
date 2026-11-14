import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createReadStream, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// ---------- The AI cutting tool (background removal) ----------
// The model and its engine are copied into the app itself, so nothing is fetched from another server.
const BG_DATA = resolve('node_modules/@imgly/background-removal-data/dist')
const BG_VERSION = JSON.parse(readFileSync(resolve('node_modules/@imgly/background-removal-data/package.json'), 'utf-8')).version
const BG_DIR = `bg/${BG_VERSION}`
// Only what phones need: the "medium" quality model and the single-thread engines.
const BG_KEEP = ['/models/medium', '/onnxruntime-web/ort-wasm-simd.wasm', '/onnxruntime-web/ort-wasm.wasm']

type Resources = Record<string, { chunks: { hash: string }[] }>
function bgResources(): Resources {
  const all: Resources = JSON.parse(readFileSync(join(BG_DATA, 'resources.json'), 'utf-8'))
  return Object.fromEntries(Object.entries(all).filter(([k]) => BG_KEEP.includes(k)))
}

function cuttingTool(): Plugin {
  let outDir = 'dist'
  return {
    name: 'vitrine-cutting-tool',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      // During development, serve the files straight from node_modules.
      server.middlewares.use(`/${BG_DIR}/`, (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '')
        if (name === 'resources.json') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(bgResources()))
          return
        }
        const file = join(BG_DATA, name)
        if (!/^[0-9a-f]+$/.test(name) || !existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    writeBundle() {
      const target = join(outDir, BG_DIR)
      mkdirSync(target, { recursive: true })
      const res = bgResources()
      writeFileSync(join(target, 'resources.json'), JSON.stringify(res))
      for (const entry of Object.values(res)) {
        for (const chunk of entry.chunks) copyFileSync(join(BG_DATA, chunk.hash), join(target, chunk.hash))
      }
    },
  }
}

export default defineConfig({
  // Relative paths so the app works at any web address (e.g. GitHub Pages sub-folder).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BG_DIR__: JSON.stringify(BG_DIR),
  },
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    react(),
    tailwindcss(),
    cuttingTool(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'mannequins/*.png'],
      manifest: {
        id: './',
        name: 'Vitrine',
        short_name: 'Vitrine',
        description:
          'Your closet on your phone: photograph your clothes, try outfits on a mannequin, save your looks. Everything stays on your device.',
        lang: 'en',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#2B2794',
        theme_color: '#F4F3F9',
        categories: ['lifestyle', 'shopping', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json}'],
        // The cutting tool is large (about 110 MB), so it is NOT downloaded at install.
        // It is saved for offline use the first time someone adds a piece.
        globIgnores: ['bg/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/bg/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'vitrine-cutting-tool',
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
})
