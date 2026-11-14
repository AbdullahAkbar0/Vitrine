import { t } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import { GearIcon, HangerIcon, LooksIcon, MannequinIcon, PlusIcon } from './Icons'

export type Tab = 'wardrobe' | 'tryon' | 'add' | 'outfits' | 'options'

const tabs: { id: Tab; label: TranslationKey; Icon: typeof HangerIcon }[] = [
  { id: 'wardrobe', label: 'tab.wardrobe', Icon: HangerIcon },
  { id: 'tryon', label: 'tab.tryon', Icon: MannequinIcon },
  { id: 'add', label: 'tab.add', Icon: PlusIcon },
  { id: 'outfits', label: 'tab.outfits', Icon: LooksIcon },
  { id: 'options', label: 'tab.settings', Icon: GearIcon },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label={t('tab.navLabel')}
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--c-dock)] backdrop-blur-xl"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 items-center px-2 pt-1.5 pb-1">
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
                  className="grid size-[3.4rem] -translate-y-2 place-items-center rounded-[1.15rem] bg-primary text-on-primary shadow-[0_10px_22px_-8px_var(--c-primary)] ring-4 ring-bg transition-transform active:scale-95"
                >
                  <Icon width={26} height={26} />
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
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[0.7rem] transition-colors ${
                  active ? 'font-semibold text-ink' : 'font-medium text-ink-3'
                }`}
              >
                <span
                  className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${
                    active ? 'bg-primary-soft text-primary' : ''
                  }`}
                >
                  <Icon width={22} height={22} strokeWidth={active ? 2 : 1.8} />
                </span>
                {t(label)}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
