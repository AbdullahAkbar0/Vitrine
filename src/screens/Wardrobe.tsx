import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { t } from '../i18n'
import { HangerIcon, PlusIcon } from '../components/Icons'
import { InstallBanner } from '../components/Install'
import { ArtPlate, Button, EmptyState, Screen, ScreenHeader } from '../components/ui'

export function WardrobeScreen({ onAdd, onShowInstall }: { onAdd: () => void; onShowInstall: () => void }) {
  const count = useLiveQuery(() => db.items.count().catch(() => 0), [], 0)

  return (
    <>
      <ScreenHeader title={t('wardrobe.title')} subtitle={t('wardrobe.subtitle', { count })} />
      <Screen>
        <InstallBanner onShowHow={onShowInstall} />
        {count === 0 && (
          <EmptyState
            art={
              <ArtPlate>
                <HangerIcon width={76} height={76} strokeWidth={1.1} />
              </ArtPlate>
            }
            title={t('wardrobe.emptyTitle')}
            body={t('wardrobe.emptyBody')}
            action={
              <Button onClick={onAdd}>
                <PlusIcon width={20} height={20} /> {t('wardrobe.emptyCta')}
              </Button>
            }
          />
        )}
      </Screen>
    </>
  )
}
