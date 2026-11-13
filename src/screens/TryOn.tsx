import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES } from '../config/categories'
import { layerOf } from '../config/fitRules'
import { db, getSetting, setSetting, type Category, type MannequinGender, type WardrobeItem } from '../db/db'
import { t } from '../i18n'
import { useFits, useThumbs } from '../lib/hooks'
import { addPiece, getWorn, setWorn } from '../lib/worn'
import { PlusIcon } from '../components/Icons'
import { DressedMannequin, Mirror, ShopWindow, type WornLayer } from '../components/Window'
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
            className={`min-h-10 rounded-full px-4 text-[0.9rem] tracking-[0.02em] transition-colors ${on ? 'brass-fill font-medium' : 'text-ink-2'}`}
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
  const [worn, setWornState] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)
  const [cat, setCat] = useState<Category | 'all'>('all')
  const items = useLiveQuery(() => db.items.orderBy('createdAt').reverse().toArray().catch(() => []), [])
  const thumbs = useThumbs(items)

  useEffect(() => {
    getSetting<MannequinGender>('tryonGender', 'female')
      .then((g) => {
        setGender(g)
        return getWorn(g)
      })
      .then(setWornState)
      .catch(() => undefined)
  }, [])

  const choose = (g: MannequinGender) => {
    setGender(g)
    setSetting('tryonGender', g).catch(() => undefined)
    getWorn(g).then(setWornState)
  }

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items])
  const wornItems = useMemo(
    () =>
      worn
        .map((id) => byId.get(id))
        .filter((i): i is WardrobeItem => !!i)
        .sort((a, b) => layerOf(a.subCategory) - layerOf(b.subCategory)),
    [worn, byId],
  )
  const { fits, busy } = useFits(wornItems, gender)

  const toggle = (item: WardrobeItem) => {
    const next = worn.includes(item.id) ? worn.filter((id) => id !== item.id) : addPiece(worn, item, items ?? [])
    setWornState(next)
    setWorn(gender, next)
  }
  const clear = () => {
    setWornState([])
    setWorn(gender, [])
  }

  const front: WornLayer[] = wornItems.flatMap((i) => {
    const f = fits[i.id]?.front
    return f ? [{ key: i.id, url: f.url, rect: f.rect }] : []
  })
  const back: WornLayer[] = wornItems.flatMap((i) => {
    const f = fits[i.id]
    if (f?.back) return [{ key: i.id, url: f.back.url, rect: f.back.rect }]
    if (f?.front) return [{ key: i.id, url: f.front.url, rect: f.front.rect, flip: true, faded: true }]
    return []
  })
  const noBack = back.some((l) => l.faded)

  const forMe = (items ?? []).filter((i) => showAll || i.gender === gender || i.gender === 'unisex')
  const cats = CATEGORIES.filter((c) => forMe.some((i) => i.category === c.id))
  const shown = forMe.filter((i) => cat === 'all' || i.category === cat)

  return (
    <>
      <ScreenHeader title={t('tryon.title')} aside={<GenderToggle value={gender} onChange={choose} />} />
      <Screen className="!px-4">
        <div className="grid grid-cols-[1fr_5.2rem] items-end gap-3">
          <ShopWindow key={gender} className="h-[clamp(340px,52dvh,580px)]">
            <DressedMannequin
              gender={gender}
              layers={front}
              animate
              className="absolute bottom-[2%] left-1/2 h-[93%] -translate-x-1/2"
            />
            {busy && wornItems.length > 0 && (
              <span className="absolute inset-x-0 top-[6%] mx-auto w-fit rounded-full bg-black/45 px-3 py-1.5 text-[0.8rem] text-ivory">
                {t('tryon.dressing')}
              </span>
            )}
          </ShopWindow>
          <div className="pb-2">
            <Mirror key={gender} gender={gender} label={t('tryon.mirror')} layers={back} note={noBack ? t('tryon.noBack') : undefined} />
          </div>
        </div>

        {(items?.length ?? 0) === 0 ? (
          <div className="mt-5 flex items-center gap-4 rounded-[1.4rem] border border-dashed border-brass/40 px-4 py-3.5">
            <p className="flex-1 text-[0.9rem] leading-snug text-ink-2">{t('tryon.trayEmpty')}</p>
            <button type="button" onClick={onAdd} aria-label={t('tryon.trayCta')} className="brass-fill grid size-11 shrink-0 place-items-center rounded-full">
              <PlusIcon width={20} height={20} strokeWidth={1.6} />
            </button>
          </div>
        ) : (
          <section className="mt-4" aria-label={t('tryon.tray')}>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {[{ id: 'all' as const, label: t('tryon.all') }, ...cats.map((c) => ({ id: c.id, label: t(c.label) }))].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  aria-pressed={cat === c.id}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-[0.88rem] ${cat === c.id ? 'bg-ink text-bg' : 'border border-line text-ink-2'}`}
                >
                  {c.label}
                </button>
              ))}
              {worn.length > 0 && (
                <button type="button" onClick={clear} className="ms-auto min-h-10 shrink-0 rounded-full px-3 text-[0.88rem] text-ink-2 underline decoration-brass/50 underline-offset-4">
                  {t('tryon.clear')}
                </button>
              )}
            </div>
            <ul className="mt-2.5 flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none]">
              {shown.map((i) => {
                const on = worn.includes(i.id)
                return (
                  <li key={i.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-pressed={on}
                      aria-label={`${i.name}${on ? `, ${t('tryon.wearing')}` : ''}`}
                      className={`relative grid h-[5.6rem] w-[4.6rem] place-items-center rounded-2xl border bg-surface p-1.5 transition ${
                        on ? 'border-brass shadow-[inset_0_0_0_1.5px_var(--c-brass)]' : 'border-line'
                      }`}
                    >
                      {thumbs.get(i.id) && <img src={thumbs.get(i.id)} alt="" className="max-h-full max-w-full object-contain" />}
                      {on && <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-bg bg-brass" aria-hidden />}
                    </button>
                  </li>
                )
              })}
              <li className="shrink-0">
                <button type="button" onClick={onAdd} aria-label={t('tryon.trayCta')} className="grid h-[5.6rem] w-[4.6rem] place-items-center rounded-2xl border border-dashed border-brass/50 text-brass">
                  <PlusIcon width={22} height={22} strokeWidth={1.5} />
                </button>
              </li>
            </ul>
            <label className="mt-1 flex min-h-11 items-center gap-3 text-[0.88rem] text-ink-2">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-5 accent-[var(--c-brass)]" />
              {t('tryon.showAll')}
            </label>
          </section>
        )}
      </Screen>
    </>
  )
}
