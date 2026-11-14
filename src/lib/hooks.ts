import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ItemImage, type MannequinGender, type WardrobeItem } from '../db/db'
import { getFit } from './fitStore'

/** Small cut-out pictures for lists (300px). */
export function useThumbs(items: WardrobeItem[] | undefined) {
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

export interface FitView {
  url: string
  rect: NonNullable<ItemImage['rect']>
}

/** Fitted pictures (front and back) for the given pieces on one mannequin, made on demand. */
export function useFits(items: WardrobeItem[], gender: MannequinGender) {
  const [fits, setFits] = useState<Record<string, { front?: FitView; back?: FitView }>>({})
  const [busy, setBusy] = useState(false)
  const urlCache = useRef(new Map<string, string>())
  const ids = items.map((i) => i.id).join(',')

  useEffect(() => {
    let cancelled = false
    const toView = (img: ItemImage | null): FitView | undefined => {
      if (!img || !img.rect) return undefined
      let url = urlCache.current.get(img.id)
      if (!url) {
        url = URL.createObjectURL(img.blob)
        urlCache.current.set(img.id, url)
      }
      return { url, rect: img.rect }
    }
    setBusy(true)
    ;(async () => {
      const next: Record<string, { front?: FitView; back?: FitView }> = {}
      for (const item of items) {
        const front = toView(await getFit(item, gender, 'front').catch(() => null))
        const back = toView(await getFit(item, gender, 'back').catch(() => null))
        next[item.id] = { front, back }
        if (!cancelled) setFits((f) => ({ ...f, [item.id]: next[item.id] }))
      }
    })().finally(() => !cancelled && setBusy(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, gender])

  useEffect(() => {
    const cache = urlCache.current
    return () => cache.forEach((u) => URL.revokeObjectURL(u))
  }, [])
  return { fits, busy }
}
