import Dexie, { type EntityTable } from 'dexie'

// ---------- Types ----------

export type Gender = 'male' | 'female' | 'unisex'
export type MannequinGender = 'male' | 'female'
/** Body shapes for the mannequin. Fit positions are remembered per gender + body shape. */
export type BodyShape = 'average' | 'slim' | 'athletic' | 'plus' | 'tall' | 'short'
export type Style = 'casual' | 'formal' | 'sports' | 'party'
export type Category = 'tops' | 'outerwear' | 'bottoms' | 'fullbody' | 'footwear' | 'accessories'

/** Where a garment sits on the mannequin (all values relative to the mannequin). */
export interface FitData {
  x: number
  y: number
  scale: number
  rotation: number
  flipped: boolean
  zIndexHint: number
}

/** Key for remembered fits, e.g. "female:average". */
export const fitKey = (gender: MannequinGender, body: BodyShape) => `${gender}:${body}`

export interface WardrobeItem {
  id: string
  name: string
  category: Category
  subCategory: string
  gender: Gender
  style: Style
  dominantColor: string // hex, e.g. "#1e3a8a"
  colorName: string // e.g. "Navy" (so colour is never shown by colour alone)
  tags: string[]
  notes: string
  createdAt: number
  updatedAt: number
  hasBack: 0 | 1
  /** 1 for the bundled example clothes, so they are easy to tell apart and clear. */
  isSample: 0 | 1
  /** Remembered fit per mannequin, keyed with fitKey(). */
  fitData: Record<string, FitData>
}

export type ImageKind =
  | 'front-cutout'
  | 'back-cutout'
  | 'front-original'
  | 'back-original'
  | 'thumb'
  /** The clean digital version of the piece, laid flat. */
  | 'front-digital'
  | 'back-digital'
  | 'detail'
  /** The piece fitted onto a mannequin. `variant` says which, e.g. "female:front". */
  | 'fit'

/**
 * Images are kept in their own table so the wardrobe list stays fast:
 * loading 200 items never loads 200 full-size photos.
 */
export interface ItemImage {
  id: string
  itemId: string
  kind: ImageKind
  blob: Blob
  label?: string
  order?: number
  /** For fitted pictures: which mannequin and side, e.g. "female:front". */
  variant?: string
  /** For fitted pictures: where it sits on the mannequin picture (fractions 0..1). */
  rect?: { x: number; y: number; w: number; h: number }
  /** Which mannequin bodies this fitted picture was made for (refit when the mannequins change). */
  rig?: number
}

export interface OutfitLayer {
  itemId: string
  x: number
  y: number
  scale: number
  rotation: number
  flipped: boolean
  zIndex: number
}

export interface Outfit {
  id: string
  name: string
  tags: string[]
  note: string
  gender: MannequinGender
  body: BodyShape
  hairStyle: string
  layers: OutfitLayer[]
  thumbnailBlob?: Blob
  isSample: 0 | 1
  createdAt: number
  updatedAt: number
}

export interface Setting {
  key: string
  value: unknown
}

// ---------- Database ----------

export const db = new Dexie('vitrine') as Dexie & {
  items: EntityTable<WardrobeItem, 'id'>
  images: EntityTable<ItemImage, 'id'>
  outfits: EntityTable<Outfit, 'id'>
  settings: EntityTable<Setting, 'key'>
}

// When the data format changes in a later version, add db.version(2).stores({...}).upgrade(...)
// below this line. Never delete version 1: that is how old data is carried forward safely.
db.version(1).stores({
  items: 'id, category, subCategory, gender, style, createdAt, isSample, *tags',
  images: 'id, itemId, [itemId+kind]',
  outfits: 'id, gender, createdAt, isSample, *tags',
  settings: 'key',
})

// ---------- Small helpers ----------

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
