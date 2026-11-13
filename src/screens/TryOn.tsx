import { useEffect, useState } from 'react'
import { getSetting, setSetting, type MannequinGender } from '../db/db'
import { t } from '../i18n'
import { PlusIcon } from '../components/Icons'
import { Mannequin, Mirror, ShopWindow } from '../components/Window'
import { Screen, ScreenHeader } from '../components/ui'

function GenderToggle({ value, onChange }: { value: MannequinGender; onChange: (g: MannequinGender) => void }) {
  const opts: { id: MannequinGender; label: string }[] = [
    { id: 'female', label: t('tryon.female') },
    { id: 'male', label: t('tryon.male') },
  ]
  return (
    <div role="radiogroup" aria-label={t('tryon.mannequin')} className="flex rounded-full border border-line bg-surface p-1">
      {opts.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`min-h-10 rounded-full px-4 text-[0.9rem] tracking-[0.02em] transition-colors ${
              on ? 'brass-fill font-medium' : 'text-ink-2'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function TryOnScreen({ onAdd }: { onAdd: () => void }) {
  const [gender, setGender] = useState<MannequinGender>('female')

  useEffect(() => {
    getSetting<MannequinGender>('tryonGender', 'female')
      .then(setGender)
      .catch(() => undefined)
  }, [])

  const choose = (g: MannequinGender) => {
    setGender(g)
    setSetting('tryonGender', g).catch(() => undefined)
  }

  return (
    <>
      <ScreenHeader title={t('tryon.title')} aside={<GenderToggle value={gender} onChange={choose} />} />
      <Screen className="!px-4">
        <div className="grid grid-cols-[1fr_5.2rem] items-end gap-3">
          <ShopWindow key={gender} className="h-[clamp(360px,56dvh,600px)]">
            <Mannequin gender={gender} className="absolute bottom-[2%] left-1/2 h-[93%] w-auto -translate-x-1/2" />
          </ShopWindow>
          <div className="pb-2">
            <Mirror key={gender} gender={gender} label={t('tryon.mirror')} />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-[1.4rem] border border-dashed border-brass/40 px-4 py-3.5">
          <div className="flex shrink-0 gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-11 w-8 rounded-lg border border-line bg-surface-2/70" />
            ))}
          </div>
          <p className="flex-1 text-[0.9rem] leading-snug text-ink-2">{t('tryon.trayEmpty')}</p>
          <button
            type="button"
            onClick={onAdd}
            aria-label={t('tryon.trayCta')}
            className="brass-fill grid size-11 shrink-0 place-items-center rounded-full"
          >
            <PlusIcon width={20} height={20} strokeWidth={1.6} />
          </button>
        </div>
      </Screen>
    </>
  )
}
