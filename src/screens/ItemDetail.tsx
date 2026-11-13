import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { findSub, GENDERS, STYLES } from '../config/categories'
import { db, getSetting, type MannequinGender, type WardrobeItem } from '../db/db'
import { t } from '../i18n'
import { useFits } from '../lib/hooks'
import { forgetItem } from '../lib/worn'
import { DressedMannequin } from '../components/Window'
import { Button } from '../components/ui'

type Tab = 'fitted' | 'cutout' | 'photo'
type Side = 'front' | 'back'

function useBlobUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}

function Picture({ blob, alt }: { blob?: Blob; alt: string }) {
  const url = useBlobUrl(blob)
  if (!url) return null
  return <img src={url} alt={alt} className="mx-auto max-h-[56dvh] w-auto max-w-full object-contain" />
}

export function ItemDetail({ item, onClose, onTryOn }: { item: WardrobeItem; onClose: () => void; onTryOn: (g: MannequinGender) => void }) {
  const [tab, setTab] = useState<Tab>('fitted')
  const [side, setSide] = useState<Side>('front')
  const [gender, setGender] = useState<MannequinGender>(item.gender === 'male' ? 'male' : 'female')
  const [confirm, setConfirm] = useState(false)
  const images = useLiveQuery(() => db.images.where('itemId').equals(item.id).toArray(), [item.id])
  const { fits, busy } = useFits([item], gender)

  useEffect(() => {
    if (item.gender === 'unisex') getSetting<MannequinGender>('tryonGender', 'female').then(setGender).catch(() => undefined)
  }, [item.gender])

  const get = (kind: string) => images?.find((i) => i.kind === kind)
  const details = (images ?? []).filter((i) => i.kind === 'detail').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const info = findSub(item.subCategory)
  const fit = fits[item.id]?.[side]

  const remove = async () => {
    await db.transaction('rw', db.items, db.images, async () => {
      await db.images.where('itemId').equals(item.id).delete()
      await db.items.delete(item.id)
    })
    await forgetItem(item.id)
    onClose()
  }

  const seg = (opts: { id: string; label: string }[], value: string, set: (v: string) => void, brass = false) => (
    <div role="tablist" className="flex rounded-full border border-line bg-surface p-1">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => set(o.id)}
          className={`min-h-11 flex-1 rounded-full text-[0.92rem] ${
            value === o.id ? (brass ? 'brass-fill font-medium' : 'bg-surface-2 font-medium text-ink') : 'text-ink-3'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={item.name}>
      <header className="pt-safe sticky top-0 z-10 bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 pt-3 pb-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-full px-2 text-[0.95rem] text-ink-2">
            ‹ {t('detail.back')}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-6 pb-40">
        <h1 className="font-display text-[2rem] leading-tight font-normal">{item.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-[0.95rem] text-ink-2">
          <span className="size-3.5 rounded-full border border-line" style={{ background: item.dominantColor }} aria-hidden />
          {item.colorName} · {info ? t(info.sub.label) : item.subCategory}
        </p>

        <div className="mt-6 space-y-2.5">
          {seg(
            [
              { id: 'fitted', label: t('detail.fitted') },
              { id: 'cutout', label: t('detail.cutout') },
              { id: 'photo', label: t('detail.photo') },
            ],
            tab,
            (v) => setTab(v as Tab),
            true,
          )}
          {item.hasBack
            ? seg(
                [
                  { id: 'front', label: t('detail.front') },
                  { id: 'back', label: t('detail.backSide') },
                ],
                side,
                (v) => setSide(v as Side),
              )
            : null}
        </div>

        <div className="mt-4">
          {tab === 'fitted' && (
            <div className="window-arch mx-auto h-[min(60dvh,540px)] max-w-sm bg-[linear-gradient(160deg,#f3e0b5,#c9a56c_30%,#7c5b2c_60%,#d9b984)] p-[2px]">
              <div className="window-arch velvet relative h-full w-full overflow-hidden">
                <div className="velvet-folds absolute inset-0" />
                <div className="spotlight absolute inset-0" />
                <DressedMannequin
                  gender={gender}
                  view={side}
                  layers={fit ? [{ key: 'f', url: fit.url, rect: fit.rect }] : []}
                  className="absolute bottom-[2%] left-1/2 h-[94%] -translate-x-1/2"
                />
                {busy && !fit && (
                  <span className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-black/50 px-4 py-2 text-[0.85rem] text-ivory">
                    {t('detail.preparing')}
                  </span>
                )}
              </div>
            </div>
          )}
          {tab === 'cutout' && (
            <div className="rounded-[1.4rem] border border-line bg-white p-4">
              <Picture blob={get(`${side}-cutout`)?.blob} alt={t('detail.cutout')} />
            </div>
          )}
          {tab === 'photo' && (
            <div className="overflow-hidden rounded-[1.4rem] border border-line bg-surface">
              <Picture blob={get(`${side}-original`)?.blob} alt={t('detail.photo')} />
            </div>
          )}
          {item.gender === 'unisex' && tab === 'fitted' && (
            <div className="mx-auto mt-3 max-w-60">
              {seg(
                [
                  { id: 'female', label: t('tryon.female') },
                  { id: 'male', label: t('tryon.male') },
                ],
                gender,
                (v) => setGender(v as MannequinGender),
              )}
            </div>
          )}
        </div>

        <Button className="mt-6 w-full" onClick={() => onTryOn(gender)}>
          {t('detail.tryOn')}
        </Button>

        {details.length > 0 && (
          <section className="mt-9">
            <h2 className="font-display text-[1.3rem] font-normal">{t('detail.closeups')}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {details.map((d) => (
                <li key={d.id}>
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <Picture blob={d.blob} alt={d.label || t('detail.closeups')} />
                  </div>
                  {d.label && <p className="mt-1.5 text-[0.88rem] text-ink-2">{d.label}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <dl className="mt-9 divide-y divide-line rounded-[1.4rem] border border-line bg-surface">
          {[
            [t('detail.category'), info ? `${t(info.group.label)} · ${t(info.sub.label)}` : item.subCategory],
            [t('detail.madeFor'), t(GENDERS.find((g) => g.id === item.gender)!.label)],
            [t('detail.style'), t(STYLES.find((s) => s.id === item.style)!.label)],
            [t('detail.colour'), item.colorName],
            [t('detail.added'), new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-5 py-3.5">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <button type="button" onClick={() => setConfirm(true)} className="mt-8 min-h-12 w-full rounded-full border border-warn/40 text-[0.95rem] text-warn">
          {t('detail.delete')}
        </button>
      </main>

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 p-4" onClick={() => setConfirm(false)}>
          <div role="alertdialog" aria-modal="true" className="mb-safe mx-auto w-full max-w-md rounded-[1.6rem] border border-line bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-[1.4rem]">{t('detail.deleteTitle', { name: item.name })}</p>
            <p className="mt-2 text-ink-2">{t('detail.deleteBody')}</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirm(false)}>
                {t('detail.deleteNo')}
              </Button>
              <button type="button" onClick={remove} className="min-h-13 flex-1 rounded-full bg-warn text-[1rem] font-medium text-white">
                {t('detail.deleteYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
