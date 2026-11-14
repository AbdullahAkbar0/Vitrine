import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { findSub, GENDERS, STYLES } from '../config/categories'
import { db, getSetting, type MannequinGender, type WardrobeItem } from '../db/db'
import { t } from '../i18n'
import { useFits } from '../lib/hooks'
import { forgetItem } from '../lib/worn'
import { CategoryIcon } from '../components/CategoryIcons'
import { ChevronLeftIcon, MannequinIcon, TrashIcon } from '../components/Icons'
import { MannequinStage } from '../components/Window'
import { Button, Segmented, Sheet } from '../components/ui'

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

function Picture({ blob, alt, className = '' }: { blob?: Blob; alt: string; className?: string }) {
  const url = useBlobUrl(blob)
  if (!url) return null
  return <img src={url} alt={alt} className={`mx-auto max-h-full max-w-full object-contain ${className}`} />
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

  const facts: [string, string][] = [
    [t('detail.category'), info ? `${t(info.group.label)} · ${t(info.sub.label)}` : item.subCategory],
    [t('detail.madeFor'), t(GENDERS.find((g) => g.id === item.gender)!.label)],
    [t('detail.style'), t(STYLES.find((s) => s.id === item.style)!.label)],
    [t('detail.added'), new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })],
  ]

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={item.name}>
      <header className="pt-safe sticky top-0 z-10 bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 pt-2 pb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('detail.back')}
            className="grid size-11 place-items-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1.5px_var(--c-line)]"
          >
            <ChevronLeftIcon width={20} height={20} />
          </button>
          <p className="truncate text-[0.95rem] font-semibold">{item.name}</p>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label={t('detail.delete')}
            className="grid size-11 place-items-center rounded-full bg-surface text-warn shadow-[inset_0_0_0_1.5px_var(--c-line)]"
          >
            <TrashIcon width={19} height={19} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pb-40">
        {/* picture */}
        <div className="relative">
          {tab === 'fitted' && (
            <MannequinStage gender={gender} view={side} layers={fit ? [{ key: 'f', url: fit.url, rect: fit.rect }] : []} className="h-[min(58dvh,520px)] shadow-[var(--shadow-card)]">
              {busy && !fit && (
                <span className="absolute inset-x-0 bottom-5 mx-auto w-fit rounded-full bg-ink/80 px-4 py-2 text-[0.85rem] font-medium text-bg">
                  {t('detail.preparing')}
                </span>
              )}
            </MannequinStage>
          )}
          {tab === 'cutout' && (
            <div className={`tint-${item.category} grid h-[min(58dvh,520px)] place-items-center rounded-[1.75rem] p-6`}>
              <Picture blob={get(`${side}-cutout`)?.blob} alt={t('detail.cutout')} className="drop-shadow-[0_14px_18px_rgba(29,27,75,0.22)]" />
            </div>
          )}
          {tab === 'photo' && (
            <div className="grid h-[min(58dvh,520px)] place-items-center overflow-hidden rounded-[1.75rem] bg-surface-2">
              <Picture blob={get(`${side}-original`)?.blob} alt={t('detail.photo')} />
            </div>
          )}
          {item.hasBack ? (
            <div className="absolute inset-x-0 bottom-3 mx-auto w-40">
              <Segmented
                value={side}
                onChange={setSide}
                className="!bg-surface/90 shadow-sm backdrop-blur"
                options={[
                  { id: 'front', label: t('detail.front') },
                  { id: 'back', label: t('detail.backSide') },
                ]}
              />
            </div>
          ) : null}
        </div>

        <Segmented
          value={tab}
          onChange={setTab}
          className="mt-3"
          options={[
            { id: 'fitted', label: t('detail.fitted') },
            { id: 'cutout', label: t('detail.cutout') },
            { id: 'photo', label: t('detail.photo') },
          ]}
        />
        {item.gender === 'unisex' && tab === 'fitted' && (
          <Segmented
            value={gender}
            onChange={setGender}
            className="mx-auto mt-2 max-w-56"
            options={[
              { id: 'female', label: t('tryon.female') },
              { id: 'male', label: t('tryon.male') },
            ]}
          />
        )}

        {/* name and facts */}
        <div className="mt-6 flex items-start gap-3">
          <span className={`tint-${item.category} grid size-12 shrink-0 place-items-center rounded-2xl`}>
            <CategoryIcon id={item.category} className="size-8" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[1.7rem] leading-tight font-bold">{item.name}</h1>
            <p className="mt-1 flex items-center gap-2 text-[0.92rem] text-ink-2">
              <span className="size-4 rounded-full ring-1 ring-line" style={{ background: item.dominantColor }} aria-hidden />
              {item.colorName}
            </p>
          </div>
        </div>

        <Button className="mt-5 w-full" onClick={() => onTryOn(gender)}>
          <MannequinIcon width={20} height={20} /> {t('detail.tryOn')}
        </Button>

        <dl className="card mt-5 divide-y divide-line">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3.5">
              <dt className="text-[0.92rem] text-ink-3">{k}</dt>
              <dd className="text-right text-[0.92rem] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        {details.length > 0 && (
          <section className="mt-7">
            <h2 className="font-display mb-3 text-[1.2rem] font-bold">{t('detail.closeups')}</h2>
            <ul className="grid grid-cols-2 gap-3">
              {details.map((d) => (
                <li key={d.id} className="card overflow-hidden">
                  <div className="aspect-square bg-surface-2">
                    <Picture blob={d.blob} alt={d.label || t('detail.closeups')} className="h-full w-full !object-cover" />
                  </div>
                  {d.label && <p className="px-3 py-2 text-[0.85rem] font-medium text-ink-2">{d.label}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {confirm && (
        <Sheet label={t('detail.delete')} onClose={() => setConfirm(false)}>
          <h2 className="font-display text-[1.4rem] font-bold">{t('detail.deleteTitle', { name: item.name })}</h2>
          <p className="mt-2 text-ink-2">{t('detail.deleteBody')}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
              {t('detail.deleteNo')}
            </Button>
            <Button variant="danger" className="flex-1" onClick={remove}>
              {t('detail.deleteYes')}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
