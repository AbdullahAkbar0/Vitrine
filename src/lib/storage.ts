import { db, getSetting, setSetting } from '../db/db'

export interface StartupStatus {
  dbOk: boolean
  persisted: boolean | null
  firstOpenedAt: number | null
}

/**
 * Runs once when the app opens:
 * - checks that the on-phone database works,
 * - asks the browser not to delete our data when space is low,
 * - remembers the first time the app was opened (a simple way to test storage survives).
 */
export async function startup(): Promise<StartupStatus> {
  let dbOk = false
  let firstOpenedAt: number | null = null
  try {
    await db.open()
    firstOpenedAt = await getSetting<number | null>('firstOpenedAt', null)
    if (!firstOpenedAt) {
      firstOpenedAt = Date.now()
      await setSetting('firstOpenedAt', firstOpenedAt)
    }
    dbOk = true
  } catch (err) {
    console.error('Database failed to open', err)
  }

  let persisted: boolean | null = null
  try {
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted()
      if (!persisted && navigator.storage.persist) persisted = await navigator.storage.persist()
    }
  } catch {
    persisted = null
  }

  return { dbOk, persisted, firstOpenedAt }
}

export interface StorageInfo {
  usage: number
  quota: number
  ratio: number
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    if (!quota) return null
    return { usage, quota, ratio: usage / quota }
  } catch {
    return null
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}
