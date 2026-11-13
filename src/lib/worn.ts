// What the mannequin is wearing, remembered per mannequin.
import { getSetting, setSetting, type MannequinGender, type WardrobeItem } from '../db/db'
import { layerOf } from '../config/fitRules'

const key = (g: MannequinGender) => `worn:${g}`

export const getWorn = (g: MannequinGender) => getSetting<string[]>(key(g), []).catch(() => [] as string[])
export const setWorn = (g: MannequinGender, ids: string[]) => setSetting(key(g), ids).catch(() => undefined)

/** Adds a piece; a piece on the same layer (e.g. another T-shirt) is taken off. */
export function addPiece(worn: string[], item: WardrobeItem, items: WardrobeItem[]): string[] {
  const layer = layerOf(item.subCategory)
  const byId = new Map(items.map((i) => [i.id, i]))
  return [...worn.filter((id) => byId.has(id) && layerOf(byId.get(id)!.subCategory) !== layer), item.id]
}

export async function wearItem(g: MannequinGender, item: WardrobeItem, items: WardrobeItem[]) {
  await setWorn(g, addPiece(await getWorn(g), item, items))
  await setSetting('tryonGender', g).catch(() => undefined)
}

export async function forgetItem(id: string) {
  for (const g of ['female', 'male'] as const) {
    const w = await getWorn(g)
    if (w.includes(id)) await setWorn(g, w.filter((x) => x !== id))
  }
}
