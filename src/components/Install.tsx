import { t } from '../i18n'
import { useInstall } from '../lib/install'
import { CheckIcon, ShareIcon } from './Icons'
import { Button } from './ui'

/** Install help that matches the phone being used. */
export function InstallSteps() {
  const install = useInstall()

  if (install.installed) {
    return (
      <p className="flex items-center gap-2.5">
        <CheckIcon width={20} height={20} className="text-ok" /> {t('settings.installed')}
      </p>
    )
  }

  if (install.ios) {
    if (!install.iosSafari) return <p className="leading-[1.6] text-ink-2">{t('settings.installIosNotSafari')}</p>
    return (
      <div className="leading-[1.55] text-ink-2">
        <p>{t('settings.installIosIntro')}</p>
        <ol className="mt-3.5 space-y-3">
          {(['settings.installIos1', 'settings.installIos2', 'settings.installIos3'] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-3.5">
              <span className="w-4 shrink-0 font-display text-[1.15rem] leading-[1.4] text-brass">{i + 1}</span>
              <span>
                {t(k)}
                {i === 0 && <ShareIcon className="ms-1.5 inline-block align-[-4px] text-brass" width={20} height={20} />}
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
        <p className="leading-[1.6] text-ink-2">{t('settings.installAndroid')}</p>
        <Button className="mt-4" onClick={install.prompt}>
          {t('settings.installButton')}
        </Button>
      </div>
    )
  }

  return <p className="leading-[1.6] text-ink-2">{t('settings.installOther')}</p>
}
