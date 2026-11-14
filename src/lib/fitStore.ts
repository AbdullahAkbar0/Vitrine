// Digital and fitted pictures of a piece: made when it is saved, and remade on demand
// (older pieces, the other mannequin, or after the mannequins change).
import { db, newId, type ItemImage, type MannequinGender, type WardrobeItem } from '../db/db'
import { fitGarment, makeDigital, type View } from './fit/fit'
import { blobToImageData, encode, fitToCanvas } from './image'

/** Bump when the mannequins or the fitting change, so fitted pictures are made again. */
export const RIG_VERSION = 4

export const gendersFor = (item: Pick<WardrobeItem, 'gender'>): MannequinGender[] =>
  item.gender === 'unisex' ? ['female', 'male'] : [item.gender]

export async function makeFitImage(
  itemId: string,
  cutout: ImageData,
  sub: string,
  gender: MannequinGender,
  view: View,
  fromFront = false,
): Promise<ItemImage> {
  const r = await fitGarment(cutout, sub, gender, view, { fromFront })
  const blob = await encode(r.canvas, { transparent: true, quality: 0.92 })
  return { id: newId(), itemId, kind: 'fit', variant: `${gender}:${view}`, blob, rect: r.rect, rig: RIG_VERSION }
}

/** The flat digital piece and its small thumbnail. Null for shoes and accessories (their cut-out is used). */
export async function makeDigitalImages(itemId: string, cutout: ImageData, sub: string, side: 'front' | 'back'): Promise<ItemImage[]> {
  const c = makeDigital(cutout, sub)
  if (!c) return []
  const out: ItemImage[] = [{ id: newId(), itemId, kind: `${side}-digital`, blob: await encode(c, { transparent: true, quality: 0.92 }), rig: RIG_VERSION }]
  if (side === 'front') out.push({ id: newId(), itemId, kind: 'thumb', blob: await encode(fitToCanvas(c, 320), { transparent: true, quality: 0.88 }), rig: RIG_VERSION })
  return out
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
      // no back photo: the back is built from the front piece, without its print
      const fromFront = view === 'back' && !item.hasBack
      const cut = await db.images.where('[itemId+kind]').equals([item.id, fromFront ? 'front-cutout' : `${view}-cutout`]).first()
      if (!cut) return null
      const img = await makeFitImage(item.id, await blobToImageData(cut.blob), item.subCategory, gender, view, fromFront)
      await db.images.add(img).catch(() => undefined) // if storage is full we still show it
      return img
    })().finally(() => pending.delete(key))
    pending.set(key, p)
  }
  return p
}

/** Pieces saved by older versions get their digital version (and a clean thumbnail) in the background. */
export async function upgradeItems(): Promise<void> {
  const items = await db.items.toArray()
  for (const item of items) {
    try {
      const imgs = await db.images.where('itemId').equals(item.id).toArray()
      for (const side of ['front', 'back'] as const) {
        const cut = imgs.find((i) => i.kind === `${side}-cutout`)
        const have = imgs.find((i) => i.kind === `${side}-digital` && (i.rig ?? 1) === RIG_VERSION)
        if (!cut || have) continue
        const made = await makeDigitalImages(item.id, await blobToImageData(cut.blob), item.subCategory, side)
        if (!made.length) continue
        const old = imgs.filter((i) => i.kind === `${side}-digital` || (side === 'front' && i.kind === 'thumb'))
        await db.transaction('rw', db.images, async () => {
          await db.images.bulkDelete(old.map((i) => i.id))
          await db.images.bulkAdd(made)
        })
      }
    } catch (e) {
      console.warn('Could not upgrade a piece', e)
    }
    await new Promise((r) => setTimeout(r, 60))
  }
}
