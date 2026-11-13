// Fitted pictures: made when a piece is saved, and on demand for older pieces or the other mannequin.
import { db, newId, type ItemImage, type MannequinGender, type WardrobeItem } from '../db/db'
import { fitGarment, type View } from './fit/fit'
import { blobToImageData, encode } from './image'

export interface FitPicture {
  url: string
  rect: { x: number; y: number; w: number; h: number }
}

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
  const blob = await encode(r.canvas, { transparent: true, quality: 0.9 })
  return { id: newId(), itemId, kind: 'fit', variant: `${gender}:${view}`, blob, rect: r.rect }
}

const pending = new Map<string, Promise<ItemImage | null>>()

/** Gets (or makes and saves) the fitted picture of a piece for one mannequin side. */
export async function getFit(item: WardrobeItem, gender: MannequinGender, view: View): Promise<ItemImage | null> {
  const variant = `${gender}:${view}`
  const found = await db.images
    .where('[itemId+kind]')
    .equals([item.id, 'fit'])
    .filter((i) => i.variant === variant)
    .first()
  if (found) return found
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
