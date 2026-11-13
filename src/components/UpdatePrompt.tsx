import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { t } from '../i18n'
import { CheckIcon } from './Icons'

/**
 * Shows "New version available — tap to refresh" when an update has downloaded.
 * Updates only replace the app code; the wardrobe in the database is never touched.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for a new version every hour while the app is open.
      if (reg) setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000)
    },
    onRegisterError() {
      /* Service workers are unavailable in some previews; the app still works online. */
    },
  })

  const [showOffline, setShowOffline] = useState(false)
  useEffect(() => {
    if (!offlineReady) return
    setShowOffline(true)
    const id = setTimeout(() => {
      setShowOffline(false)
      setOfflineReady(false)
    }, 3500)
    return () => clearTimeout(id)
  }, [offlineReady, setOfflineReady])

  if (needRefresh) {
    return (
      <div role="status" className="pt-safe fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
        <div className="animate-rise flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink p-2 ps-4 text-bg shadow-xl">
          <span className="flex-1 text-sm font-medium">{t('update.ready')}</span>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="min-h-11 rounded-xl px-3 text-sm opacity-75"
          >
            {t('update.later')}
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent"
          >
            {t('update.tap')}
          </button>
        </div>
      </div>
    )
  }

  if (showOffline) {
    return (
      <div role="status" className="pt-safe fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
        <div className="animate-rise flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-bg shadow-xl">
          <CheckIcon width={18} height={18} /> {t('offline.ready')}
        </div>
      </div>
    )
  }
  return null
}
