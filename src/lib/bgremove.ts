// Talks to the background-removal worker. One image at a time.
import { getSetting, setSetting } from '../db/db'

export type BgProgress =
  | { phase: 'download'; fraction: number } // first-time download of the cutting tool
  | { phase: 'compute' }

let worker: Worker | null = null
let nextId = 1
let queue: Promise<unknown> = Promise.resolve()

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('../workers/bg.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

const publicPath = () => new URL(`${__BG_DIR__}/`, document.baseURI).href

export async function isToolReady(): Promise<boolean> {
  return getSetting('bgToolReady', false).catch(() => false)
}

/** Returns an alpha mask (one byte per pixel, 0 = background, 255 = garment). */
export function removeBackground(
  image: ImageData,
  onProgress?: (p: BgProgress) => void,
): Promise<Uint8Array> {
  const run = () =>
    new Promise<Uint8Array>((resolve, reject) => {
      const w = getWorker()
      const id = nextId++
      const downloads = new Map<string, number>()
      const onMessage = (e: MessageEvent) => {
        const msg = e.data
        if (msg.id !== id) return
        if (msg.type === 'progress') {
          if (String(msg.key).startsWith('fetch:')) {
            downloads.set(msg.key, msg.total ? msg.current / msg.total : 0)
            // The model is by far the biggest download, so its share drives the bar.
            const model = [...downloads.entries()].find(([k]) => k.includes('/models/'))
            onProgress?.({ phase: 'download', fraction: model ? model[1] : 0 })
          } else if (String(msg.key).startsWith('compute')) {
            onProgress?.({ phase: 'compute' })
          }
          return
        }
        w.removeEventListener('message', onMessage)
        w.removeEventListener('error', onError)
        if (msg.type === 'done') {
          setSetting('bgToolReady', true).catch(() => undefined)
          resolve(msg.mask as Uint8Array)
        } else reject(new Error(msg.message))
      }
      const onError = (e: ErrorEvent) => {
        w.removeEventListener('message', onMessage)
        w.removeEventListener('error', onError)
        worker?.terminate()
        worker = null
        reject(new Error(e.message || 'The cutting tool stopped unexpectedly.'))
      }
      w.addEventListener('message', onMessage)
      w.addEventListener('error', onError)
      const rgba = new Uint8ClampedArray(image.data) // copy, the original stays usable here
      w.postMessage({ id, rgba, width: image.width, height: image.height, publicPath: publicPath() }, [rgba.buffer])
    })
  const p = queue.then(run, run)
  queue = p.catch(() => undefined)
  return p
}
