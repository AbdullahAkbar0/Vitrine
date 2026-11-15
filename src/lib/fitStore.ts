// Fitted pictures of a piece: made when it is saved, and remade on demand
// (older pieces, the other mannequin, or after the mannequins change).
import { db, newId, type ItemImage, type MannequinGender, type WardrobeItem } from '../db/db'
import { fitGarment, type View } from './fit/fit'
import { blobToImageData, encode, fitToCanvas, imageDataToCanvas } from './image'

/** Bump when the mannequins or the placement change, so fitted pictures are made again. */
export const RIG_VERSION = 6

export const gendersFor = (item: Pick<WardrobeItem, 'gender'>): MannequinGender[] =>
  item.gender === 'unisex' ? ['female', 'male'] : [item.gender]

export async function makeFitImage(
  itemId: string,
  cutout: ImageData,
  sub: string,
  gender: MannequinGender,
  view: View,
): Promise<ItemImage> {
  const r = await fitGarment(cutout, sub, gender, view)
  const blob = await encode(r.canvas, { transparent: true, quality: 0.92 })
  return { id: newId(), itemId, kind: 'fit', variant: `${gender}:${view}`, blob, rect: r.rect, rig: RIG_VERSION }
}

const pending = new Map<string, Promise<ItemImage | null>>()

/** Gets (or makes and saves) the fitted picture of a piece for one mannequin side. */
export async function getFit(item: WardrobeItem, gender: MannequinGender, view: View): Promise<ItemImage | null> {
  const variant = `${gender}:${view}`
  const all = await db.images
    .where('[itemId+kind]')
    .equals([item.id, 'fit'])
    .filter((i) => i.variant === variant)
    .toArray()
  const found = all.find((i) => (i.rig ?? 1) === RIG_VERSION)
  if (found) return found
  if (all.length) await db.images.bulkDelete(all.map((i) => i.id)).catch(() => undefined)
  const key = `${item.id}|${variant}`
  let p = pending.get(key)
  if (!p) {
    p = (async () => {
      const cut = await db.images.where('[itemId+kind]').equals([item.id, `${view}-cutout`]).first()
      if (!cut) return null
      const img = await makeFitImage(item.id, await blobToImageData(cut.blob), item.subCategory, gender, view)
      await db.images.add(img).catch(() => undefined) // if storage is full we still show it
      return img
    })().finally(() => pending.delete(key))
    pending.set(key, p)
  }
  return p
}

/** Pieces saved by older versions: drop their redrawn "digital" pictures and give them a real-photo thumbnail. */
export async function upgradeItems(): Promise<void> {
  const items = await db.items.toArray()
  for (const item of items) {
    try {
      const imgs = await db.images.where('itemId').equals(item.id).toArray()
      const digital = imgs.filter((i) => (i.kind as string).endsWith('-digital'))
      const thumb = imgs.find((i) => i.kind === 'thumb')
      const needThumb = !thumb || (thumb.rig ?? 0) !== 0
      if (!digital.length && !needThumb) continue
      const cut = imgs.find((i) => i.kind === 'front-cutout')
      const add: ItemImage[] = []
      if (needThumb && cut) {
        const c = fitToCanvas(await blobToImageData(cut.blob).then(imageDataToCanvas), 320)
        add.push({ id: newId(), itemId: item.id, kind: 'thumb', blob: await encode(c, { transparent: true, quality: 0.85 }) })
      }
      await db.transaction('rw', db.images, async () => {
        await db.images.bulkDelete([...digital.map((i) => i.id), ...(needThumb && thumb && cut ? [thumb.id] : [])])
        if (add.length) await db.images.bulkAdd(add)
      })
    } catch (e) {
      console.warn('Could not upgrade a piece', e)
    }
  }
}
