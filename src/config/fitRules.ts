// How each kind of piece is fitted and in which order pieces are layered on the mannequin.
// Edit these numbers to change the default layering.
import type { Kind } from '../lib/fit/analyze'

const KIND: Record<string, Kind> = {
  jeans: 'bottom',
  'trousers-casual': 'bottom',
  'trousers-formal': 'bottom',
  shorts: 'bottom',
  leggings: 'bottom',
  skirt: 'skirt',
  sneakers: 'shoes',
  'formal-shoes': 'shoes',
  boots: 'shoes',
  sandals: 'shoes',
  belt: 'belt',
  cap: 'cap',
  scarf: 'scarf',
  tie: 'tie',
  bag: 'bag',
}

/** Everything else (shirts, jackets, dresses, ethnic wear…) is fitted as a top. */
export const garmentKind = (sub: string): Kind => KIND[sub] ?? 'top'

/** Bottom to top. Pieces with the same number replace each other when tapped. */
export const LAYER: Record<string, number> = {
  sneakers: 5,
  'formal-shoes': 5,
  boots: 5,
  sandals: 5,
  leggings: 10,
  jeans: 12,
  'trousers-casual': 12,
  'trousers-formal': 12,
  shorts: 12,
  skirt: 12,
  undershirt: 20,
  tshirt: 30,
  polo: 30,
  blouse: 30,
  'crop-top': 30,
  kurti: 30,
  dress: 32,
  gown: 32,
  jumpsuit: 32,
  'kurta-set': 32,
  'suit-set': 32,
  'shirt-casual': 40,
  'shirt-formal': 40,
  sweater: 50,
  hoodie: 50,
  sweatshirt: 50,
  waistcoat: 55,
  cardigan: 60,
  jacket: 60,
  blazer: 60,
  'long-coat': 62,
  belt: 66,
  tie: 68,
  scarf: 70,
  cap: 72,
  bag: 74,
}

export const layerOf = (sub: string) => LAYER[sub] ?? 30
