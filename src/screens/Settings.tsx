import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { t } from '../i18n'
import { formatBytes, getStorageInfo, type StartupStatus, type StorageInfo } from '../lib/storage'
import { AlertIcon, CameraIcon, CheckIcon, DatabaseIcon, DownloadIcon, InfoIcon, ShieldIcon } from '../components/Icons'
import { InstallSteps } from '../components/Install'
import { Card, Screen, ScreenHeader } from '../components/ui'

function Section({ icon, title, children, id }: { icon: ReactNode; title: string; children: ReactNode; id?: string }) {
  return (
    <Card className="scroll-mt-28">
      <div id={id} className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
        <h2 className="font-display text-lg font-medium">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

function StatusLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-2 text-[0.95rem] ${ok ? 'text-ok' : 'text-warn'}`}>
      {ok ? (
        <CheckIcon width={20} height={20} className="mt-0.5 shrink-0" />
      ) : (
        <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
      )}
      <span>{children}</span>
    </p>
  )
}

export function SettingsScreen({ status, focusInstall }: { status: StartupStatus | null; focusInstall: boolean }) {
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const counts = useLiveQuery(
    async () => ({ items: await db.items.count(), outfits: await db.outfits.count() }),
    [],
    { items: 0, outfits: 0 },
  )

  useEffect(() => {
    getStorageInfo().then(setStorage)
  }, [counts])

  useEffect(() => {
    if (focusInstall) document.getElementById('install')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusInstall])

  const pct = storage ? Math.min(100, Math.max(1, Math.round(storage.ratio * 100))) : 0
  const warn = storage ? storage.ratio > 0.8 : false

  return (
    <>
      <ScreenHeader title={t('settings.title')} />
      <Screen>
        <div className="space-y-4">
          <Section id="install" icon={<DownloadIcon width={19} height={19} />} title={t('settings.install')}>
            <InstallSteps />
          </Section>

          <Section icon={<DatabaseIcon width={19} height={19} />} title={t('settings.storage')}>
            <div className="space-y-2.5">
              {status &&
                (status.dbOk ? (
                  <StatusLine ok>{t('settings.dbOk')}</StatusLine>
                ) : (
                  <StatusLine ok={false}>{t('settings.dbFail')}</StatusLine>
                ))}
              {status && status.persisted !== null && (
                <StatusLine ok={status.persisted}>
                  {status.persisted ? t('settings.persisted') : t('settings.notPersisted')}
                </StatusLine>
              )}
            </div>

            {storage ? (
              <div className="mt-4">
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-surface-2"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={t('settings.storage')}
                >
                  <div className={`h-full rounded-full ${warn ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm text-ink-3">
                  {t('settings.storageUsed', { used: formatBytes(storage.usage), quota: formatBytes(storage.quota) })}
                </p>
                {warn && <p className="mt-3 rounded-2xl bg-warn-soft p-3 text-sm text-warn">{t('settings.storageWarn')}</p>}
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-3">{t('settings.storageUnknown')}</p>
            )}

            <p className="mt-3 text-sm text-ink-3">{t('settings.counts', counts)}</p>
            {status?.firstOpenedAt && (
              <p className="mt-1 text-sm text-ink-3">
                {t('settings.firstOpened', {
                  date: new Date(status.firstOpenedAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </p>
            )}
          </Section>

          <Section icon={<ShieldIcon width={19} height={19} />} title={t('settings.privacy')}>
            <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('settings.privacyBody')}</p>
          </Section>

          <Section icon={<CameraIcon width={19} height={19} />} title={t('settings.camera')}>
            <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('settings.cameraBody')}</p>
          </Section>

          <Section icon={<InfoIcon width={19} height={19} />} title={t('settings.disclaimer')}>
            <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('settings.disclaimerBody')}</p>
          </Section>

          <Section icon={<img src="./icons/icon-192.png" alt="" className="size-9 rounded-full" />} title={t('settings.about')}>
            <p className="text-[0.95rem] text-ink-2">
              <strong className="font-semibold text-ink">{t('app.name')}</strong> ·{' '}
              {t('settings.version', { version: __APP_VERSION__ })}
            </p>
            <p className="mt-1 text-[0.95rem] text-ink-2">{t('app.tagline')}</p>
            <p className="mt-4 text-sm font-medium text-ink">{t('settings.credits')}</p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-ink-3">
              <li>React (MIT) · Vite (MIT) · Tailwind CSS (MIT)</li>
              <li>Dexie.js (Apache-2.0) · vite-plugin-pwa &amp; Workbox (MIT)</li>
              <li>Inter &amp; Fraunces fonts (SIL Open Font License)</li>
            </ul>
          </Section>
        </div>
      </Screen>
    </>
  )
}
