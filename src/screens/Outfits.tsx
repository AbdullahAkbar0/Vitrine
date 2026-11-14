import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting, type Outfit } from '../db/db'
import { t } from '../i18n'
import type { TranslationKey } from '../i18n/en'
import { OCCASIONS } from '../lib/looks'
import { setWorn } from '../lib/worn'
import { MannequinIcon, TrashIcon } from '../components/Icons'
import { OutfitStack } from '../components/Illustrations'
import { Button, Chip, Screen, ScreenHeader, Sheet } from '../components/ui'

function useUrls(looks: Outfit[] | undefined) {
  const urls = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of looks ?? []) if (l.thumbnailBlob) m.set(l.id, URL.createObjectURL(l.thumbnailBlob))
    return m
  }, [looks])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

export function OutfitsScreen({ onCreate, onWear }: { onCreate: () => void; onWear: () => void }) {
  const looks = useLiveQuery(() => db.outfits.orderBy('createdAt').reverse().toArray().catch(() => [] as Outfit[]), [])
  const urls = useUrls(looks)
  const [tag, setTag] = useState<string | null>(null)
  const [open, setOpen] = useState<Outfit | null>(null)
  const [confirm, setConfirm] = useState(false)
  const count = looks?.length ?? 0
  const used = OCCASIONS.filter((o) => looks?.some((l) => l.tags.includes(o)))
  const shown = (looks ?? []).filter((l) => !tag || l.tags.includes(tag))

  const wear = async (l: Outfit) => {
    await setSetting('tryonGender', l.gender)
    await setWorn(
      l.gender,
      l.layers.map((x) => x.itemId),
    )
    setOpen(null)
    onWear()
  }
  const remove = async (l: Outfit) => {
    await db.outfits.delete(l.id)
    setConfirm(false)
    setOpen(null)
  }

  return (
    <>
      <ScreenHeader title={t('outfits.title')} sub={count ? t('looks.count', { n: count }) : undefined} />
      <Screen>
        {looks && count === 0 && (
          <div className="pop-in">
            <section className="card overflow-hidden">
              <div className="bg-accent-soft px-5 pt-6 pb-3">
                <OutfitStack className="mx-auto w-full max-w-[20rem]" />
              </div>
              <div className="px-5 pt-5 pb-6">
                <h2 className="font-display text-[1.6rem] leading-tight font-bold">{t('outfits.emptyTitle')}</h2>
                <p className="mt-2 leading-[1.55] text-ink-2">{t('outfits.emptyBody')}</p>
                <Button className="mt-5 w-full" onClick={onCreate}>
                  <MannequinIcon width={20} height={20} /> {t('outfits.emptyCta')}
                </Button>
              </div>
            </section>
            <p className="mt-6 mb-2 text-[0.8rem] font-semibold text-ink-3">{t('looks.tagIdeas')}</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o, i) => (
                <span
                  key={o}
                  className={`${['tint-tops', 'tint-fullbody', 'tint-bottoms', 'tint-outerwear', 'tint-footwear', 'tint-accessories'][i]} rounded-full px-3.5 py-1.5 text-[0.85rem] font-semibold`}
                >
                  {t(`occ.${o}` as TranslationKey)}
                </span>
              ))}
            </div>
          </div>
        )}

        {looks && count > 0 && (
          <>
            {used.length > 0 && (
              <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
                <Chip on={!tag} onClick={() => setTag(null)}>
                  {t('tryon.all')}
                </Chip>
                {used.map((o) => (
                  <Chip key={o} on={tag === o} onClick={() => setTag(tag === o ? null : o)}>
                    {t(`occ.${o}` as TranslationKey)}
                  </Chip>
                ))}
              </div>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setOpen(l)} className="card block w-full overflow-hidden text-start transition-transform active:scale-[0.98]">
                    <div className="studio relative grid aspect-[3/4] place-items-center">
                      <div className="studio-floor absolute inset-x-[15%] bottom-[2%] h-[8%]" />
                      {urls.get(l.id) && <img src={urls.get(l.id)} alt="" className="relative h-[94%] w-auto object-contain" />}
                    </div>
                    <div className="px-3.5 pt-2.5 pb-3">
                      <p className="truncate font-semibold">{l.name}</p>
                      <p className="mt-0.5 truncate text-[0.8rem] text-ink-3">
                        {t('looks.pieces', { n: l.layers.length })}
                        {l.tags.length > 0 && ` · ${l.tags.map((x) => t(`occ.${x}` as TranslationKey)).join(', ')}`}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Screen>

      {open && (
        <Sheet label={open.name} onClose={() => (setOpen(null), setConfirm(false))}>
          {!confirm ? (
            <>
              <div className="studio relative mx-auto grid h-[min(46dvh,400px)] place-items-center overflow-hidden rounded-[1.4rem]">
                <div className="studio-floor absolute inset-x-[15%] bottom-[2%] h-[8%]" />
                {urls.get(open.id) && <img src={urls.get(open.id)} alt="" className="relative h-[94%] w-auto" />}
              </div>
              <h2 className="font-display mt-4 text-[1.5rem] font-bold">{open.name}</h2>
              <p className="text-[0.9rem] text-ink-3">
                {t('looks.pieces', { n: open.layers.length })} · {new Date(open.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </p>
              {open.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {open.tags.map((x) => (
                    <span key={x} className="rounded-full bg-primary-soft px-3 py-1 text-[0.8rem] font-semibold text-primary">
                      {t(`occ.${x}` as TranslationKey)}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-5 flex gap-3">
                <Button variant="danger" className="w-14 !px-0" ariaLabel={t('looks.delete')} onClick={() => setConfirm(true)}>
                  <TrashIcon width={20} height={20} />
                </Button>
                <Button className="flex-1" onClick={() => wear(open)}>
                  <MannequinIcon width={20} height={20} /> {t('looks.wear')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-[1.4rem] font-bold">{t('looks.deleteTitle', { name: open.name })}</h2>
              <p className="mt-2 text-ink-2">{t('looks.deleteBody')}</p>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
                  {t('detail.deleteNo')}
                </Button>
                <Button variant="danger" className="flex-1" onClick={() => remove(open)}>
                  {t('detail.deleteYes')}
                </Button>
              </div>
            </>
          )}
        </Sheet>
      )}
    </>
  )
}
