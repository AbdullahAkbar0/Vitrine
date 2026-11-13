/// <reference lib="webworker" />
// Runs the AI background removal off the main screen thread, so the app never freezes.
import { segmentForeground, type Config } from '@imgly/background-removal'

type Request = { id: number; rgba: Uint8ClampedArray<ArrayBuffer>; width: number; height: number; publicPath: string }

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (e: MessageEvent<Request>) => {
  const { id, rgba, width, height, publicPath } = e.data
  const config: Config = {
    publicPath,
    model: 'medium',
    proxyToWorker: false, // we are already in a worker
    output: { format: 'image/x-alpha8' },
    progress: (key: string, current: number, total: number) => {
      scope.postMessage({ id, type: 'progress', key, current, total })
    },
  }
  try {
    const input = new Blob([rgba], { type: `image/x-rgba8;width=${width};height=${height}` })
    const result = await segmentForeground(input, config)
    const mask = new Uint8Array(await result.arrayBuffer())
    scope.postMessage({ id, type: 'done', mask }, [mask.buffer])
  } catch (err) {
    scope.postMessage({ id, type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
