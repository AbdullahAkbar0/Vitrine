import { useEffect, useState } from 'react'
import { getSetting, setSetting } from '../db/db'
import { t } from '../i18n'
import { useInstall } from '../lib/install'
import { DownloadIcon, ShareIcon } from './Icons'
import { Button } from './ui'

/** Step-by-step install help that fits the phone the user is holding. */
export function InstallSteps() {
  const install = useInstall()

  if (install.installed) return <p className="text-[0.95rem] text-ink-2">{t('settings.installed')}</p>

  if (install.ios) {
    if (!install.iosSafari) return <p className="text-[0.95rem] text-ink-2">{t('settings.installIosNotSafari')}</p>
    return (
      <div className="text-[0.95rem] text-ink-2">
        <p>{t('settings.installIosIntro')}</p>
        <ol className="mt-3 space-y-3">
          {(['settings.installIos1', 'settings.installIos2', 'settings.installIos3'] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {i + 1}
              </span>
              <span className="pt-0.5">
                {t(k)}
                {i === 0 && <ShareIcon className="ms-1.5 inline-block align-[-4px] text-accent" width={20} height={20} />}
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (install.canPrompt) {
    return (
      <div>
        <p className="text-[0.95rem] text-ink-2">{t('settings.installAndroid')}</p>
        <Button className="mt-4" onClick={install.prompt}>
          <DownloadIcon width={20} height={20} /> {t('settings.installButton')}
        </Button>
      </div>
    )
  }

  return <p className="text-[0.95rem] text-ink-2">{t('settings.installOther')}</p>
}

/** Gentle banner on the first screen, until the app is installed or the user says "Not now". */
export function InstallBanner({ onShowHow }: { onShowHow: () => void }) {
  const install = useInstall()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    getSetting('installBannerDismissed', false)
      .then((d) => setDismissed(Boolean(d)))
      .catch(() => setDismissed(false))
  }, [])

  if (install.installed || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    setSetting('installBannerDismissed', true).catch(() => undefined)
  }

  return (
    <div className="animate-rise mb-5 flex items-start gap-4 rounded-3xl bg-ink p-4 text-bg">
      <img src="./icons/icon-192.png" alt="" className="size-12 shrink-0 rounded-2xl" />
      <div className="flex-1">
        <p className="font-semibold">{t('banner.installTitle')}</p>
        <p className="mt-0.5 text-sm opacity-80">{t('banner.installBody')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {install.canPrompt ? (
            <button
              type="button"
              onClick={install.prompt}
              className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
            >
              {t('banner.install')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onShowHow}
              className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
            >
              {t('banner.show')}
            </button>
          )}
          <button type="button" onClick={dismiss} className="min-h-11 rounded-full px-4 text-sm opacity-80">
            {t('banner.dismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
