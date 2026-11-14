import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES } from '../config/categories'
import { layerOf } from '../config/fitRules'
import { db, getSetting, setSetting, type Category, type MannequinGender, type WardrobeItem } from '../db/db'
import { t } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import { useFits, useThumbs } from '../lib/hooks'
import { OCCASIONS, saveLook } from '../lib/looks'
import { addPiece, getWorn, setWorn } from '../lib/worn'
import { CheckIcon, PlusIcon } from '../components/Icons'
import { MannequinStage, Mirror, type WornLayer } from '../components/Window'
import { Button, Chip, Screen, ScreenHeader, Segmented, Sheet } from '../components/ui'

export function TryOnScreen({ onAdd, notify }: { onAdd: () => void; notify: (msg: string) => void }) {
  const [gender, setGender] = useState<MannequinGender>('female')
  const [worn, setWornState] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [saving, setSaving] = useState<{ name: string; tags: string[] } | null>(null)
  const [busySave, setBusySave] = useState(false)
  const items = useLiveQuery(() => db.items.orderBy('createdAt').reverse().toArray().catch(() => []), [])
  const lookCount = useLiveQuery(() => db.outfits.count().catch(() => 0), [], 0)
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

  const doSave = async () => {
    if (!saving) return
    setBusySave(true)
    try {
      await saveLook({
        name: saving.name.trim() || t('looks.defaultName', { n: lookCount + 1 }),
        tags: saving.tags,
        gender,
        items: wornItems,
        layers: front,
      })
      setSaving(null)
      notify(t('looks.saved'))
    } finally {
      setBusySave(false)
    }
  }

  return (
    <>
      <ScreenHeader
        title={t('tryon.title')}
        aside={
          <Segmented
            value={gender}
            onChange={choose}
            label={t('tryon.mannequin')}
            className="w-48"
            options={[
              { id: 'female', label: t('tryon.female') },
              { id: 'male', label: t('tryon.male') },
            ]}
          />
        }
      />
      <Screen className="!px-4">
        <div className="grid grid-cols-[1fr_4.8rem] items-end gap-2.5">
          <MannequinStage key={gender} gender={gender} layers={front} className="h-[clamp(330px,50dvh,560px)] shadow-[var(--shadow-card)]">
            {busy && wornItems.length > 0 && (
              <span className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-ink/80 px-3 py-1.5 text-[0.78rem] font-medium text-bg">
                {t('tryon.dressing')}
              </span>
            )}
            {wornItems.length > 0 && !busy && (
              <span className="absolute top-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-[0.75rem] font-semibold text-ink shadow-sm">
                {t('tryon.count', { n: wornItems.length })}
              </span>
            )}
          </MannequinStage>
          <Mirror key={gender} gender={gender} label={t('tryon.mirror')} layers={back} note={noBack ? t('tryon.noBack') : undefined} />
        </div>

        {(items?.length ?? 0) === 0 ? (
          <div className="card mt-4 flex items-center gap-4 p-4">
            <p className="flex-1 text-[0.92rem] leading-snug text-ink-2">{t('tryon.trayEmpty')}</p>
            <Button size="md" onClick={onAdd}>
              <PlusIcon width={18} height={18} /> {t('tryon.trayCta')}
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-3.5 flex items-center gap-2.5">
              {worn.length > 0 ? (
                <>
                  <Button size="md" variant="secondary" className="flex-1" onClick={clear}>
                    {t('tryon.clear')}
                  </Button>
                  <Button size="md" className="flex-1" onClick={() => setSaving({ name: '', tags: [] })}>
                    {t('looks.save')}
                  </Button>
                </>
              ) : (
                <p className="flex-1 py-2 text-center text-[0.9rem] text-ink-3">{t('tryon.hint')}</p>
              )}
            </div>

            <section className="card mt-3 p-3" aria-label={t('tryon.tray')}>
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
                {[{ id: 'all' as const, label: t('tryon.all') }, ...cats.map((c) => ({ id: c.id, label: t(c.label) }))].map((c) => (
                  <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)} className="!min-h-9 !px-3.5 !text-[0.85rem]">
                    {c.label}
                  </Chip>
                ))}
              </div>
              <ul className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto pt-1.5 pb-1">
                {shown.map((i) => {
                  const on = worn.includes(i.id)
                  return (
                    <li key={i.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        aria-pressed={on}
                        aria-label={`${i.name}${on ? `, ${t('tryon.wearing')}` : ''}`}
                        className={`tint-${i.category} relative grid h-[5.8rem] w-[4.7rem] place-items-center rounded-2xl p-2 transition ${
                          on ? 'shadow-[inset_0_0_0_2.5px_var(--c-primary)]' : ''
                        }`}
                      >
                        {thumbs.get(i.id) && <img src={thumbs.get(i.id)} alt="" className="max-h-full max-w-full object-contain" />}
                        {on && (
                          <span className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-primary text-on-primary ring-2 ring-surface" aria-hidden>
                            <CheckIcon width={13} height={13} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-label={t('tryon.trayCta')}
                    className="grid h-[5.8rem] w-[4.7rem] place-items-center rounded-2xl border-2 border-dashed border-primary/30 text-primary"
                  >
                    <PlusIcon width={22} height={22} />
                  </button>
                </li>
              </ul>
              <label className="mt-1 flex min-h-11 items-center gap-3 text-[0.85rem] text-ink-2">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-5 accent-[var(--c-primary)]" />
                {t('tryon.showAll')}
              </label>
            </section>
          </>
        )}
      </Screen>

      {saving && (
        <Sheet label={t('looks.save')} onClose={() => setSaving(null)}>
          <h2 className="font-display text-[1.5rem] font-bold">{t('looks.saveTitle')}</h2>
          <label className="mt-4 block">
            <span className="text-[0.8rem] font-semibold text-ink-3">{t('looks.name')}</span>
            <input
              value={saving.name}
              maxLength={50}
              placeholder={t('looks.defaultName', { n: lookCount + 1 })}
              onChange={(e) => setSaving({ ...saving, name: e.target.value })}
              className="mt-2 min-h-13 w-full rounded-2xl bg-surface-2 px-4 text-[1rem] font-medium text-ink placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-primary)] focus:outline-none"
            />
          </label>
          <p className="mt-5 text-[0.8rem] font-semibold text-ink-3">{t('looks.occasion')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => {
              const on = saving.tags.includes(o)
              return (
                <Chip key={o} on={on} onClick={() => setSaving({ ...saving, tags: on ? saving.tags.filter((x) => x !== o) : [...saving.tags, o] })}>
                  {t(`occ.${o}` as TranslationKey)}
                </Chip>
              )
            })}
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSaving(null)}>
              {t('looks.cancel')}
            </Button>
            <Button className="flex-1" onClick={doSave} disabled={busySave}>
              {busySave ? t('add.saving') : t('looks.saveCta')}
            </Button>
          </div>
        </Sheet>
      )}
    </>
  )
}
