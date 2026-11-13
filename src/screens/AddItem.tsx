import { t } from '../i18n'
import { CameraIcon } from '../components/Icons'
import { ArtPlate, Card, EmptyState, Screen, ScreenHeader } from '../components/ui'

export function AddItemScreen() {
  const tips = ['add.tip1', 'add.tip2', 'add.tip3', 'add.tip4'] as const
  return (
    <>
      <ScreenHeader title={t('add.title')} />
      <Screen>
        <EmptyState
          art={
            <ArtPlate>
              <CameraIcon width={72} height={72} strokeWidth={1.1} />
            </ArtPlate>
          }
          title={t('add.soonTitle')}
          body={t('add.soonBody')}
        />
        <Card className="mt-8">
          <h2 className="font-display text-lg font-medium">{t('add.tipsTitle')}</h2>
          <ul className="mt-3 space-y-2.5 text-[0.95rem] text-ink-2">
            {tips.map((k) => (
              <li key={k} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {t(k)}
              </li>
            ))}
          </ul>
        </Card>
      </Screen>
    </>
  )
}
