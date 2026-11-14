import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES, GENDERS, STYLES, findSub } from '../config/categories'
import { db, type Category, type Gender, type MannequinGender, type Style, type WardrobeItem } from '../db/db'
import { t } from '../i18n'
import mark from '../assets/mark.png'
import { useThumbs } from '../lib/hooks'
import { wearItem } from '../lib/worn'
import { CategoryIcon } from '../components/CategoryIcons'
import { CameraIcon, CloseIcon, LockIcon, MannequinIcon, PlusIcon, SearchIcon, SparkleIcon } from '../components/Icons'
import { ClosetRail } from '../components/Illustrations'
import { Button, Chip, Screen, SectionTitle } from '../components/ui'
import { ItemDetail } from './ItemDetail'

function greeting() {
  const h = new Date().getHours()
  return t(h < 12 ? 'closet.morning' : h < 18 ? 'closet.afternoon' : 'closet.evening')
}

function Header() {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center justify-between px-5 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <img src={mark} alt="" className="size-9 rounded-[0.7rem]" />
          <span className="font-display text-[1.35rem] font-bold">{t('app.name')}</span>
        </div>
      </div>
    </header>
  )
}

function PieceCard({ item, url, onOpen }: { item: WardrobeItem; url?: string; onOpen: () => void }) {
  const info = findSub(item.subCategory)
  return (
    <li>
      <button type="button" onClick={onOpen} className="card block w-full overflow-hidden text-start transition-transform active:scale-[0.98]">
        <div className={`tint-${item.category} grid aspect-[4/5] place-items-center p-4`}>
          {url && (
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className="max-h-full max-w-full object-contain drop-shadow-[0_8px_10px_rgba(29,27,75,0.18)]"
            />
          )}
        </div>
        <div className="px-3.5 pt-2.5 pb-3">
          <p className="truncate text-[0.95rem] font-semibold">{item.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.8rem] text-ink-3">
            <span className="size-2.5 shrink-0 rounded-full ring-1 ring-line" style={{ background: item.dominantColor }} aria-hidden />
            <span className="truncate">
              {item.colorName} · {info ? t(info.sub.label) : ''}
            </span>
          </p>
        </div>
      </button>
    </li>
  )
}

function EmptyCloset({ onAdd }: { onAdd: () => void }) {
  const steps = [
    { Icon: CameraIcon, title: t('closet.step1'), body: t('closet.step1Body') },
    { Icon: SparkleIcon, title: t('closet.step2'), body: t('closet.step2Body') },
    { Icon: MannequinIcon, title: t('closet.step3'), body: t('closet.step3Body') },
  ]
  return (
    <div className="pop-in">
      <section className="card overflow-hidden">
        <div className="bg-primary-soft px-5 pt-6 pb-2">
          <ClosetRail className="mx-auto w-full max-w-[22rem]" />
        </div>
        <div className="px-5 pt-5 pb-6">
          <h2 className="font-display text-[1.6rem] leading-tight font-bold">{t('closet.emptyTitle')}</h2>
          <p className="mt-2 leading-[1.55] text-ink-2">{t('closet.emptyBody')}</p>
          <Button className="mt-5 w-full" onClick={onAdd}>
            <PlusIcon width={20} height={20} /> {t('closet.emptyCta')}
          </Button>
        </div>
      </section>

      <SectionTitle>{t('closet.how')}</SectionTitle>
      <ol className="space-y-2.5">
        {steps.map(({ Icon, title, body }, i) => (
          <li key={title} className="card flex items-start gap-3.5 p-4">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Icon width={22} height={22} />
              <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-accent text-[0.7rem] font-bold text-white">
                {i + 1}
              </span>
            </span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-0.5 text-[0.9rem] leading-[1.5] text-ink-2">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 flex items-center justify-center gap-2 text-[0.85rem] text-ink-3">
        <LockIcon width={16} height={16} /> {t('closet.private')}
      </p>
    </div>
  )
}

export function WardrobeScreen({ onAdd, onTryOn }: { onAdd: () => void; onTryOn: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const [cat, setCat] = useState<Category | null>(null)
  const [who, setWho] = useState<Gender | null>(null)
  const [style, setStyle] = useState<Style | null>(null)
  const [q, setQ] = useState('')
  const items = useLiveQuery(() => db.items.orderBy('createdAt').reverse().toArray().catch(() => []), [])
  const looks = useLiveQuery(() => db.outfits.count().catch(() => 0), [], 0)
  const thumbs = useThumbs(items)
  const count = items?.length ?? 0

  const colours = useMemo(() => {
    const seen = new Map<string, string>()
    for (const i of items ?? []) if (!seen.has(i.colorName)) seen.set(i.colorName, i.dominantColor)
    return [...seen.values()]
  }, [items])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items ?? []).filter((i) => {
      if (cat && i.category !== cat) return false
      if (who && i.gender !== who) return false
      if (style && i.style !== style) return false
      if (!needle) return true
      const info = findSub(i.subCategory)
      const hay = [i.name, i.colorName, ...i.tags, info ? t(info.sub.label) : '', info ? t(info.group.label) : ''].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [items, cat, who, style, q])

  const filtered = !!(cat || who || style || q.trim())
  const openItem = items?.find((i) => i.id === open)

  return (
    <>
      <Header />
      <Screen>
        {items && count === 0 && (
          <>
            <p className="mt-1 text-[0.95rem] font-medium text-ink-3">{greeting()}</p>
            <h1 className="font-display mb-5 text-[2rem] leading-tight font-bold">{t('closet.title')}</h1>
            <EmptyCloset onAdd={onAdd} />
          </>
        )}

        {items && count > 0 && (
          <>
            <p className="mt-1 text-[0.95rem] font-medium text-ink-3">{greeting()}</p>
            <h1 className="font-display text-[2rem] leading-tight font-bold">{t('closet.title')}</h1>

            {/* at a glance */}
            <section className="card mt-4 grid grid-cols-3 divide-x divide-line py-3.5">
              <div className="px-4">
                <p className="font-display text-[1.6rem] leading-none font-bold">{count}</p>
                <p className="mt-1 text-[0.8rem] text-ink-3">{t('closet.statPieces')}</p>
              </div>
              <div className="px-4">
                <p className="font-display text-[1.6rem] leading-none font-bold">{looks}</p>
                <p className="mt-1 text-[0.8rem] text-ink-3">{t('closet.statLooks')}</p>
              </div>
              <div className="px-4">
                <div className="flex h-[1.6rem] items-center -space-x-1.5">
                  {colours.slice(0, 6).map((c) => (
                    <span key={c} className="size-5 rounded-full ring-2 ring-surface" style={{ background: c }} />
                  ))}
                </div>
                <p className="mt-1 text-[0.8rem] text-ink-3">
                  {colours.length} {t('closet.statColours').toLowerCase()}
                </p>
              </div>
            </section>

            {/* categories */}
            <SectionTitle>{t('closet.categories')}</SectionTitle>
            <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
              {CATEGORIES.map((c) => {
                const n = (items ?? []).filter((i) => i.category === c.id).length
                const on = cat === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCat(on ? null : c.id)}
                    className={`tint-${c.id} flex h-[7.2rem] w-[6.6rem] shrink-0 flex-col justify-between rounded-[1.25rem] p-3 text-start transition ${
                      on ? 'shadow-[inset_0_0_0_2.5px_var(--t-ink)]' : ''
                    } ${n === 0 ? 'opacity-55' : ''}`}
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-white/70 text-[var(--t-ink)] dark:bg-white/10">
                      <CategoryIcon id={c.id} className="size-7" />
                    </span>
                    <span>
                      <span className="block text-[0.9rem] leading-tight font-semibold">{t(c.label)}</span>
                      <span className="text-[0.78rem] opacity-70">{n}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {/* search + filters */}
            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-surface px-3.5 shadow-[inset_0_0_0_1.5px_var(--c-line)] focus-within:shadow-[inset_0_0_0_2px_var(--c-primary)]">
              <SearchIcon width={20} height={20} className="shrink-0 text-ink-3" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('closet.search')}
                aria-label={t('closet.searchLabel')}
                className="min-h-12 w-full bg-transparent text-[1rem] text-ink placeholder:text-ink-3 focus:outline-none"
              />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label={t('closet.clearSearch')} className="grid size-9 place-items-center rounded-full text-ink-3">
                  <CloseIcon width={18} height={18} />
                </button>
              )}
            </div>
            <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
              {GENDERS.map((g) => (
                <Chip key={g.id} on={who === g.id} onClick={() => setWho(who === g.id ? null : g.id)}>
                  {t(g.label)}
                </Chip>
              ))}
              <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />
              {STYLES.map((s) => (
                <Chip key={s.id} on={style === s.id} onClick={() => setStyle(style === s.id ? null : s.id)}>
                  {t(s.label)}
                </Chip>
              ))}
            </div>

            <SectionTitle
              action={
                filtered ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCat(null)
                      setWho(null)
                      setStyle(null)
                      setQ('')
                    }}
                    className="min-h-10 text-[0.9rem] font-semibold text-primary"
                  >
                    {t('closet.clearFilters')}
                  </button>
                ) : undefined
              }
            >
              {cat ? t(CATEGORIES.find((c) => c.id === cat)!.label) : t('closet.allPieces')}
              <span className="ms-2 text-[0.9rem] font-medium text-ink-3">{shown.length}</span>
            </SectionTitle>

            {shown.length === 0 ? (
              <p className="card px-5 py-8 text-center text-ink-2">{t('closet.noMatch')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {shown.map((item) => (
                  <PieceCard key={item.id} item={item} url={thumbs.get(item.id)} onOpen={() => setOpen(item.id)} />
                ))}
              </ul>
            )}
          </>
        )}

        {openItem && items && (
          <ItemDetail
            item={openItem}
            onClose={() => setOpen(null)}
            onTryOn={async (g: MannequinGender) => {
              await wearItem(g, openItem, items)
              setOpen(null)
              onTryOn()
            }}
          />
        )}
      </Screen>
    </>
  )
}
