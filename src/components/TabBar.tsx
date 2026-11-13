import { t } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import { BookmarkIcon, GearIcon, HangerIcon, MannequinIcon, PlusIcon } from './Icons'

export type Tab = 'wardrobe' | 'tryon' | 'add' | 'outfits' | 'options'

const tabs: { id: Tab; label: TranslationKey; Icon: typeof HangerIcon }[] = [
  { id: 'wardrobe', label: 'tab.wardrobe', Icon: HangerIcon },
  { id: 'tryon', label: 'tab.tryon', Icon: MannequinIcon },
  { id: 'add', label: 'tab.add', Icon: PlusIcon },
  { id: 'outfits', label: 'tab.outfits', Icon: BookmarkIcon },
  { id: 'options', label: 'tab.settings', Icon: GearIcon },
]

/** Floating dock at the bottom of the screen. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav aria-label={t('tab.navLabel')} className="mb-safe fixed inset-x-0 bottom-0 z-30 px-3">
      <ul className="mx-auto grid h-[4.5rem] max-w-md grid-cols-5 items-center rounded-full border border-line bg-[var(--c-dock)] px-1.5 shadow-[0_20px_45px_-20px_rgba(27,13,23,0.55)] backdrop-blur-2xl">
        {tabs.map(({ id, label, Icon }) => {
          const active = tab === id
          if (id === 'add') {
            return (
              <li key={id} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onChange(id)}
                  aria-label={t(label)}
                  aria-current={active ? 'page' : undefined}
                  className="brass-fill grid size-[3.6rem] place-items-center rounded-full transition-transform duration-150 active:scale-95"
                >
                  <Icon width={26} height={26} strokeWidth={1.6} />
                </button>
              </li>
            )
          }
          return (
            <li key={id} className="flex justify-center">
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-full text-[0.68rem] tracking-[0.03em] transition-colors ${
                  active ? 'text-ink' : 'text-ink-3'
                }`}
              >
                <Icon width={24} height={24} strokeWidth={active ? 1.6 : 1.3} />
                <span className={active ? 'font-medium' : ''}>{t(label)}</span>
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 size-1 rounded-full bg-brass transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
