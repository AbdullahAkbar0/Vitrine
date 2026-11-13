import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { t } from '../i18n'
import mark from '../assets/mark.png'
import { formatBytes, getStorageInfo, type StartupStatus, type StorageInfo } from '../lib/storage'
import { AlertIcon, CheckIcon } from '../components/Icons'
import { InstallSteps } from '../components/Install'
import { Group, Row, Screen, ScreenHeader } from '../components/ui'

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-2.5 ${ok ? 'text-ink' : 'text-warn'}`}>
      {ok ? (
        <CheckIcon width={20} height={20} className="mt-0.5 shrink-0 text-ok" />
      ) : (
        <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
      )}
      <span>{children}</span>
    </p>
  )
}

export function SettingsScreen({ status }: { status: StartupStatus | null }) {
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const counts = useLiveQuery(
    async () => ({ items: await db.items.count(), outfits: await db.outfits.count() }),
    [],
    { items: 0, outfits: 0 },
  )

  useEffect(() => {
    getStorageInfo().then(setStorage)
  }, [counts])

  const pct = storage ? Math.min(100, Math.max(1, Math.round(storage.ratio * 100))) : 0
  const warn = storage ? storage.ratio > 0.8 : false

  return (
    <>
      <ScreenHeader title={t('settings.title')} />
      <Screen>
        <Group title={t('settings.groupInstall')}>
          <Row>
            <InstallSteps />
          </Row>
        </Group>

        <Group title={t('settings.groupStorage')}>
          <Row className="space-y-2.5">
            {status &&
              (status.dbOk ? (
                <Status ok>{t('settings.dbOk')}</Status>
              ) : (
                <Status ok={false}>{t('settings.dbFail')}</Status>
              ))}
            {status && status.persisted !== null && (
              <Status ok={status.persisted}>{status.persisted ? t('settings.persisted') : t('settings.notPersisted')}</Status>
            )}
          </Row>
          <Row>
            {storage ? (
              <>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-surface-2"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={t('settings.groupStorage')}
                >
                  <div className={`h-full rounded-full ${warn ? 'bg-warn' : 'brass-fill'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2.5 text-[0.9rem] text-ink-2">
                  {t('settings.storageUsed', { used: formatBytes(storage.usage), quota: formatBytes(storage.quota) })}
                </p>
                {warn && <p className="mt-3 text-[0.9rem] text-warn">{t('settings.storageWarn')}</p>}
              </>
            ) : (
              <p className="text-[0.9rem] text-ink-2">{t('settings.storageUnknown')}</p>
            )}
            <p className="mt-1 text-[0.9rem] text-ink-3">{t('settings.counts', counts)}</p>
            {status?.firstOpenedAt && (
              <p className="mt-1 text-[0.9rem] text-ink-3">
                {t('settings.firstOpened', {
                  date: new Date(status.firstOpenedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </p>
            )}
          </Row>
        </Group>

        <Group title={t('settings.groupPrivacy')}>
          <Row>
            <p className="leading-[1.6] text-ink-2">{t('settings.privacyBody')}</p>
          </Row>
          <Row>
            <p className="leading-[1.6] text-ink-2">{t('settings.cameraBody')}</p>
          </Row>
        </Group>

        <Group title={t('settings.groupAbout')}>
          <Row className="flex items-center gap-4">
            <img src={mark} alt="" className="h-14 w-14" />
            <div>
              <p className="font-display text-[1.5rem] leading-none">{t('app.name')}</p>
              <p className="mt-1.5 text-[0.9rem] text-ink-3">{t('settings.version', { version: __APP_VERSION__ })}</p>
            </div>
          </Row>
          <Row>
            <p className="leading-[1.6] text-ink-2">{t('app.tagline')}</p>
            <p className="mt-3 leading-[1.6] text-ink-2">{t('settings.disclaimerBody')}</p>
            <p className="mt-3 text-[0.85rem] leading-[1.6] text-ink-3">{t('settings.credits')}</p>
          </Row>
        </Group>
      </Screen>
    </>
  )
}
