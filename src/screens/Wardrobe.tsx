import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WardrobeItem } from '../db/db'
import { t } from '../i18n'
import mark from '../assets/mark.png'
import { PlusIcon } from '../components/Icons'
import { Mannequin, ShopWindow } from '../components/Window'
import { Button, Screen } from '../components/ui'

/** Small cut-out pictures for the grid (300px), loaded only for pieces on screen. */
function useThumbs(items: WardrobeItem[] | undefined) {
  const rows = useLiveQuery(
    () => (items?.length ? db.images.where('[itemId+kind]').anyOf(items.map((i) => [i.id, 'thumb'])).toArray() : []),
    [items],
  )
  const urls = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows ?? []) m.set(r.itemId, URL.createObjectURL(r.blob))
    return m
  }, [rows])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

function Piece({ item, url }: { item: WardrobeItem; url?: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <li>
      <figure>
        <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[1.25rem] border border-line bg-surface p-3">
          {url && (
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`max-h-full max-w-full object-contain drop-shadow-[0_10px_14px_rgba(27,13,23,0.18)] transition-opacity duration-300 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
        </div>
        <figcaption className="mt-2 flex items-center gap-2 px-1">
          <span
            className="size-3 shrink-0 rounded-full border border-line"
            style={{ background: item.dominantColor }}
            aria-hidden
          />
          <span className="truncate text-[0.9rem] text-ink">{item.name}</span>
        </figcaption>
      </figure>
    </li>
  )
}

export function WardrobeScreen({ onAdd }: { onAdd: () => void }) {
  const items = useLiveQuery(() => db.items.orderBy('createdAt').reverse().toArray().catch(() => []), [])
  const count = items?.length ?? 0
  const thumbs = useThumbs(items)

  return (
    <>
      <header className="pt-safe sticky top-0 z-20 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between px-6 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <img src={mark} alt="" className="h-9 w-9" />
            <span className="font-display text-[1.75rem] leading-none tracking-[0.01em]">{t('app.name')}</span>
          </div>
          <span className="text-sm text-ink-3">
            {count === 1 ? t('wardrobe.countOne') : t('wardrobe.count', { count })}
          </span>
        </div>
      </header>

      <Screen>
        {items && count === 0 && (
          <div className="pt-2">
            <ShopWindow className="mx-auto h-[clamp(300px,47dvh,470px)] w-full max-w-sm">
              <Mannequin
                gender="male"
                className="absolute bottom-[4%] left-[9%] h-[74%] w-auto brightness-[0.55]"
              />
              <Mannequin gender="female" className="absolute right-[13%] bottom-[2.5%] h-[88%] w-auto" />
            </ShopWindow>

            <div className="mt-8 text-center">
              <h2 className="mx-auto max-w-[17ch] font-display text-[1.95rem] leading-[1.12] font-normal tracking-[-0.01em] text-balance">
                {t('wardrobe.emptyTitle')}
              </h2>
              <p className="mx-auto mt-4 max-w-[34ch] text-[1rem] leading-[1.6] text-ink-2">{t('wardrobe.emptyBody')}</p>
              <Button className="mt-7" onClick={onAdd}>
                <PlusIcon width={20} height={20} strokeWidth={1.6} />
                {t('wardrobe.emptyCta')}
              </Button>
            </div>
          </div>
        )}

        {items && count > 0 && (
          <ul className="grid grid-cols-2 gap-x-3.5 gap-y-5 pt-2 sm:grid-cols-3">
            {items.map((item) => (
              <Piece key={item.id} item={item} url={thumbs.get(item.id)} />
            ))}
          </ul>
        )}
      </Screen>
    </>
  )
}
