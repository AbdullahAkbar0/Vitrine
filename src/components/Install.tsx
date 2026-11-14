import { t } from '../i18n'
import { useInstall } from '../lib/install'
import { CheckIcon, ShareIcon } from './Icons'
import { Button } from './ui'

/** Install help that matches the phone being used. */
export function InstallSteps() {
  const install = useInstall()

  if (install.installed) {
    return (
      <p className="flex items-center gap-2 font-medium text-ok">
        <CheckIcon width={18} height={18} /> {t('settings.installed')}
      </p>
    )
  }

  if (install.ios) {
    if (!install.iosSafari) return <p className="text-[0.92rem] leading-[1.55] text-ink-2">{t('settings.installIosNotSafari')}</p>
    return (
      <div className="text-[0.92rem] leading-[1.5] text-ink-2">
        <p>{t('settings.installIosIntro')}</p>
        <ol className="mt-3 space-y-2.5">
          {(['settings.installIos1', 'settings.installIos2', 'settings.installIos3'] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[0.75rem] font-bold text-on-primary">{i + 1}</span>
              <span>
                {t(k)}
                {i === 0 && <ShareIcon className="ms-1.5 inline-block align-[-4px] text-primary" width={18} height={18} />}
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
        <p className="text-[0.92rem] leading-[1.55] text-ink-2">{t('settings.installAndroid')}</p>
        <Button size="md" className="mt-3" onClick={install.prompt}>
          {t('settings.installButton')}
        </Button>
      </div>
    )
  }

  return <p className="text-[0.92rem] leading-[1.55] text-ink-2">{t('settings.installOther')}</p>
}
