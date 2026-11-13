import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { t } from '../i18n'
import { BookmarkIcon } from '../components/Icons'
import { ArtPlate, Button, EmptyState, Screen, ScreenHeader } from '../components/ui'

export function OutfitsScreen({ onCreate }: { onCreate: () => void }) {
  const count = useLiveQuery(() => db.outfits.count().catch(() => 0), [], 0)
  return (
    <>
      <ScreenHeader title={t('outfits.title')} />
      <Screen>
        {count === 0 && (
          <EmptyState
            art={
              <ArtPlate>
                <BookmarkIcon width={68} height={68} strokeWidth={1.1} />
              </ArtPlate>
            }
            title={t('outfits.emptyTitle')}
            body={t('outfits.emptyBody')}
            action={<Button onClick={onCreate}>{t('outfits.emptyCta')}</Button>}
          />
        )}
      </Screen>
    </>
  )
}
