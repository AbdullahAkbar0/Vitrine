// Saving outfits ("looks") with a picture of the dressed mannequin.
import { db, newId, type MannequinGender, type Outfit, type WardrobeItem } from '../db/db'
import { layerOf } from '../config/fitRules'
import type { WornLayer } from '../components/Window'
import { mannequinSrc } from '../components/Window'
import { ctx2d, encode, makeCanvas } from './image'

export const OCCASIONS = ['office', 'party', 'casual', 'wedding', 'date', 'travel'] as const
export type Occasion = (typeof OCCASIONS)[number]

async function load(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

/** Draws the mannequin and its pieces into one picture (transparent background). */
export async function snapshot(gender: MannequinGender, layers: WornLayer[], width = 420): Promise<Blob> {
  const base = await load(mannequinSrc(gender, 'front'))
  const h = Math.round((width * base.naturalHeight) / base.naturalWidth)
  const c = makeCanvas(width, h)
  const x = ctx2d(c)
  x.drawImage(base, 0, 0, width, h)
  for (const l of layers) {
    const img = await load(l.url)
    x.save()
    x.shadowColor = 'rgba(0,0,0,0.3)'
    x.shadowBlur = 3
    x.shadowOffsetY = 1.5
    x.drawImage(img, l.rect.x * width, l.rect.y * h, l.rect.w * width, l.rect.h * h)
    x.restore()
  }
  return encode(c, { transparent: true, quality: 0.86 })
}

export async function saveLook(opts: {
  name: string
  tags: string[]
  gender: MannequinGender
  items: WardrobeItem[]
  layers: WornLayer[]
}): Promise<Outfit> {
  const now = Date.now()
  const look: Outfit = {
    id: newId(),
    name: opts.name,
    tags: opts.tags,
    note: '',
    gender: opts.gender,
    body: 'average',
    hairStyle: 'none',
    layers: opts.items.map((i) => ({ itemId: i.id, x: 0, y: 0, scale: 1, rotation: 0, flipped: false, zIndex: layerOf(i.subCategory) })),
    thumbnailBlob: await snapshot(opts.gender, opts.layers),
    isSample: 0,
    createdAt: now,
    updatedAt: now,
  }
  await db.outfits.add(look)
  return look
}
