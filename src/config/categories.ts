import type { Category, Gender, Style } from '../db/db'
import type { TranslationKey } from '../i18n/en'

export interface SubCategory {
  id: string
  label: TranslationKey
}

export interface CategoryGroup {
  id: Category
  label: TranslationKey
  items: SubCategory[]
}

export const CATEGORIES: CategoryGroup[] = [
  {
    id: 'tops',
    label: 'cat.tops',
    items: [
      { id: 'tshirt', label: 'sub.tshirt' },
      { id: 'shirt-casual', label: 'sub.shirtCasual' },
      { id: 'shirt-formal', label: 'sub.shirtFormal' },
      { id: 'undershirt', label: 'sub.undershirt' },
      { id: 'polo', label: 'sub.polo' },
      { id: 'sweater', label: 'sub.sweater' },
      { id: 'hoodie', label: 'sub.hoodie' },
      { id: 'sweatshirt', label: 'sub.sweatshirt' },
      { id: 'blouse', label: 'sub.blouse' },
      { id: 'kurti', label: 'sub.kurti' },
      { id: 'crop-top', label: 'sub.cropTop' },
    ],
  },
  {
    id: 'outerwear',
    label: 'cat.outerwear',
    items: [
      { id: 'jacket', label: 'sub.jacket' },
      { id: 'blazer', label: 'sub.blazer' },
      { id: 'long-coat', label: 'sub.longCoat' },
      { id: 'cardigan', label: 'sub.cardigan' },
      { id: 'waistcoat', label: 'sub.waistcoat' },
    ],
  },
  {
    id: 'bottoms',
    label: 'cat.bottoms',
    items: [
      { id: 'jeans', label: 'sub.jeans' },
      { id: 'trousers-casual', label: 'sub.trousersCasual' },
      { id: 'trousers-formal', label: 'sub.trousersFormal' },
      { id: 'shorts', label: 'sub.shorts' },
      { id: 'skirt', label: 'sub.skirt' },
      { id: 'leggings', label: 'sub.leggings' },
    ],
  },
  {
    id: 'fullbody',
    label: 'cat.fullbody',
    items: [
      { id: 'dress', label: 'sub.dress' },
      { id: 'gown', label: 'sub.gown' },
      { id: 'jumpsuit', label: 'sub.jumpsuit' },
      { id: 'suit-set', label: 'sub.suitSet' },
      { id: 'kurta-set', label: 'sub.kurtaSet' },
    ],
  },
  {
    id: 'footwear',
    label: 'cat.footwear',
    items: [
      { id: 'sneakers', label: 'sub.sneakers' },
      { id: 'formal-shoes', label: 'sub.formalShoes' },
      { id: 'boots', label: 'sub.boots' },
      { id: 'sandals', label: 'sub.sandals' },
    ],
  },
  {
    id: 'accessories',
    label: 'cat.accessories',
    items: [
      { id: 'belt', label: 'sub.belt' },
      { id: 'cap', label: 'sub.cap' },
      { id: 'scarf', label: 'sub.scarf' },
      { id: 'tie', label: 'sub.tie' },
      { id: 'bag', label: 'sub.bag' },
    ],
  },
]

export const GENDERS: { id: Gender; label: TranslationKey }[] = [
  { id: 'female', label: 'gender.female' },
  { id: 'male', label: 'gender.male' },
  { id: 'unisex', label: 'gender.unisex' },
]

export const STYLES: { id: Style; label: TranslationKey }[] = [
  { id: 'casual', label: 'style.casual' },
  { id: 'formal', label: 'style.formal' },
  { id: 'sports', label: 'style.sports' },
  { id: 'party', label: 'style.party' },
]

export function findSub(subId: string): { group: CategoryGroup; sub: SubCategory } | null {
  for (const group of CATEGORIES) {
    const sub = group.items.find((s) => s.id === subId)
    if (sub) return { group, sub }
  }
  return null
}
