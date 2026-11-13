import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { t } from '../i18n'
import { Mannequin, ShopWindow } from '../components/Window'
import { Button, Screen, ScreenHeader } from '../components/ui'

export function OutfitsScreen({ onCreate }: { onCreate: () => void }) {
  const count = useLiveQuery(() => db.outfits.count().catch(() => 0), [], 0)
  return (
    <>
      <ScreenHeader title={t('outfits.title')} />
      <Screen>
        {count === 0 && (
          <div className="pt-4 text-center">
            {/* three empty window niches, waiting for looks */}
            <div className="mx-auto grid max-w-xs grid-cols-3 items-end gap-3" aria-hidden>
              <ShopWindow className="h-40" animate={false}>
                <Mannequin gender="male" animate={false} className="absolute bottom-[3%] left-1/2 h-[90%] w-auto -translate-x-1/2 brightness-[0.45]" />
              </ShopWindow>
              <ShopWindow className="h-52">
                <Mannequin gender="female" className="absolute bottom-[3%] left-1/2 h-[90%] w-auto -translate-x-1/2" />
              </ShopWindow>
              <ShopWindow className="h-40" animate={false}>
                <Mannequin gender="female" view="back" animate={false} className="absolute bottom-[3%] left-1/2 h-[90%] w-auto -translate-x-1/2 brightness-[0.45]" />
              </ShopWindow>
            </div>
            <h2 className="mt-9 font-display text-[1.85rem] leading-tight font-normal">{t('outfits.emptyTitle')}</h2>
            <p className="mx-auto mt-3 max-w-[32ch] leading-[1.6] text-ink-2">{t('outfits.emptyBody')}</p>
            <Button className="mt-7" onClick={onCreate}>
              {t('outfits.emptyCta')}
            </Button>
          </div>
        )}
      </Screen>
    </>
  )
}
