import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { t } from '../i18n'
import mark from '../assets/mark.png'
import { formatBytes, getStorageInfo, type StartupStatus, type StorageInfo } from '../lib/storage'
import { AlertIcon, CameraIcon, CheckIcon, DatabaseIcon, InfoIcon, LockIcon, PhoneIcon, SparkleIcon } from '../components/Icons'
import { InstallSteps } from '../components/Install'
import { Group, IconTile, Row, Screen, ScreenHeader } from '../components/ui'

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-2 text-[0.9rem] font-medium ${ok ? 'text-ok' : 'text-warn'}`}>
      {ok ? <CheckIcon width={17} height={17} className="mt-0.5 shrink-0" /> : <AlertIcon width={17} height={17} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}

function TitledRow({ icon, tint, title, children }: { icon: ReactNode; tint?: string; title: string; children: ReactNode }) {
  return (
    <Row className="flex gap-3.5">
      <IconTile tint={tint}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </Row>
  )
}

export function SettingsScreen({ status }: { status: StartupStatus | null }) {
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const counts = useLiveQuery(async () => ({ items: await db.items.count(), outfits: await db.outfits.count() }), [], { items: 0, outfits: 0 })

  useEffect(() => {
    getStorageInfo().then(setStorage)
  }, [counts])

  const pct = storage ? Math.min(100, Math.max(1, Math.round(storage.ratio * 100))) : 0
  const warn = storage ? storage.ratio > 0.8 : false

  return (
    <>
      <ScreenHeader title={t('settings.title')} />
      <Screen>
        {/* identity card */}
        <section className="card mt-1 flex items-center gap-4 p-4">
          <img src={mark} alt="" className="size-16 rounded-[1.1rem]" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.4rem] leading-tight font-bold">{t('app.name')}</p>
            <p className="text-[0.85rem] text-ink-3">{t('settings.version', { version: __APP_VERSION__ })}</p>
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[0.75rem] font-semibold text-primary">
              <LockIcon width={13} height={13} /> {t('settings.badge')}
            </span>
          </div>
        </section>

        <Group title={t('settings.groupInstall')}>
          <TitledRow icon={<PhoneIcon width={20} height={20} />} title={t('settings.installTitle')}>
            <InstallSteps />
          </TitledRow>
        </Group>

        <Group title={t('settings.groupStorage')}>
          <TitledRow icon={<DatabaseIcon width={20} height={20} />} tint="tint-bottoms" title={t('settings.storageTitle')}>
            {storage ? (
              <>
                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={t('settings.groupStorage')}
                >
                  <div className={`h-full rounded-full ${warn ? 'bg-warn' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-[0.85rem] text-ink-2">
                  {t('settings.storageUsed', { used: formatBytes(storage.usage), quota: formatBytes(storage.quota) })}
                </p>
                {warn && <p className="mt-2 text-[0.85rem] font-medium text-warn">{t('settings.storageWarn')}</p>}
              </>
            ) : (
              <p className="text-[0.88rem] text-ink-2">{t('settings.storageUnknown')}</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-2 px-3 py-2">
                <p className="font-display text-[1.25rem] leading-none font-bold">{counts.items}</p>
                <p className="mt-0.5 text-[0.75rem] text-ink-3">{t('closet.statPieces')}</p>
              </div>
              <div className="rounded-xl bg-surface-2 px-3 py-2">
                <p className="font-display text-[1.25rem] leading-none font-bold">{counts.outfits}</p>
                <p className="mt-0.5 text-[0.75rem] text-ink-3">{t('closet.statLooks')}</p>
              </div>
            </div>
          </TitledRow>
          <Row className="space-y-2">
            {status && (status.dbOk ? <Status ok>{t('settings.dbOk')}</Status> : <Status ok={false}>{t('settings.dbFail')}</Status>)}
            {status && status.persisted !== null && (
              <Status ok={status.persisted}>{status.persisted ? t('settings.persisted') : t('settings.notPersisted')}</Status>
            )}
            {status?.firstOpenedAt && (
              <p className="text-[0.8rem] text-ink-3">
                {t('settings.firstOpened', {
                  date: new Date(status.firstOpenedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </p>
            )}
          </Row>
        </Group>

        <Group title={t('settings.groupPrivacy')}>
          <TitledRow icon={<LockIcon width={20} height={20} />} tint="tint-outerwear" title={t('settings.privacyTitle')}>
            <p className="text-[0.9rem] leading-[1.55] text-ink-2">{t('settings.privacyBody')}</p>
          </TitledRow>
          <TitledRow icon={<CameraIcon width={20} height={20} />} tint="tint-fullbody" title={t('settings.cameraTitle')}>
            <p className="text-[0.9rem] leading-[1.55] text-ink-2">{t('settings.cameraBody')}</p>
          </TitledRow>
        </Group>

        <Group title={t('settings.groupAbout')}>
          <TitledRow icon={<InfoIcon width={20} height={20} />} tint="tint-tops" title={t('settings.goodToKnow')}>
            <p className="text-[0.9rem] leading-[1.55] text-ink-2">{t('settings.disclaimerBody')}</p>
          </TitledRow>
          <TitledRow icon={<SparkleIcon width={20} height={20} />} tint="tint-footwear" title={t('settings.creditsTitle')}>
            <p className="text-[0.85rem] leading-[1.55] text-ink-2">{t('settings.credits')}</p>
          </TitledRow>
        </Group>
      </Screen>
    </>
  )
}
