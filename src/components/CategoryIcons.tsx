import type { Category } from '../db/db'

const paths: Record<Category, string> = {
  tops: 'M15 9 C17 12 31 12 33 9 L42 13 L39 21 L35 19.5 L35 40 L13 40 L13 19.5 L9 21 L6 13 Z',
  outerwear:
    'M17 8 L24 15 L31 8 L41 13 L41 41 L29 41 L29 21 M24 15 L24 41 M17 8 L7 13 L7 41 L19 41 L19 21 M24 15 L19 21 M24 15 L29 21',
  bottoms: 'M14 8 L34 8 L36 41 L27 41 L24 18 L21 41 L12 41 Z M14 13 L34 13',
  fullbody: 'M19 6 L19 12 C17 14 17 17 19 19 L11 41 L37 41 L29 19 C31 17 31 14 29 12 L29 6 M19 12 C22 13.5 26 13.5 29 12',
  footwear: 'M8 32 L8 15 L17 15 C18 21 22 23 28 25 L37 28 C40 29 41 31 41 34 L41 36 L8 36 Z M8 32 L41 32',
  accessories:
    'M13 18 L35 18 L38 40 L10 40 Z M18 18 C18 10 30 10 30 18',
}

export function CategoryIcon({ id, className = '' }: { id: Category; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round">
      <path d={paths[id]} />
    </svg>
  )
}
