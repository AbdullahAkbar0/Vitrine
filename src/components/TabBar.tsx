import { t } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import { BookmarkIcon, GearIcon, HangerIcon, MannequinIcon, PlusIcon } from './Icons'

export type Tab = 'wardrobe' | 'tryon' | 'add' | 'outfits' | 'options'

const side: { id: Tab; label: TranslationKey; Icon: typeof HangerIcon }[] = [
  { id: 'wardrobe', label: 'tab.wardrobe', Icon: HangerIcon },
  { id: 'tryon', label: 'tab.tryon', Icon: MannequinIcon },
  { id: 'add', label: 'tab.add', Icon: PlusIcon },
  { id: 'outfits', label: 'tab.outfits', Icon: BookmarkIcon },
  { id: 'options', label: 'tab.settings', Icon: GearIcon },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label={t('tab.navLabel')}
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 items-end px-1">
        {side.map(({ id, label, Icon }) => {
          const active = tab === id
          if (id === 'add') {
            return (
              <li key={id} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onChange(id)}
                  aria-label={t(label)}
                  aria-current={active ? 'page' : undefined}
                  className={`-mt-6 mb-1.5 grid size-15 place-items-center rounded-full shadow-lg ring-4 ring-bg transition active:scale-95 ${
                    active ? 'bg-ink text-bg' : 'bg-accent text-on-accent'
                  }`}
                >
                  <Icon width={28} height={28} />
                </button>
              </li>
            )
          }
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.7rem] font-medium transition ${
                  active ? 'text-accent' : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                <Icon width={23} height={23} strokeWidth={active ? 2 : 1.7} />
                <span>{t(label)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
