import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { t } from '../i18n'
import mark from '../assets/mark.png'
import { PlusIcon } from '../components/Icons'
import { Mannequin, ShopWindow } from '../components/Window'
import { Button, Screen } from '../components/ui'

export function WardrobeScreen({ onAdd }: { onAdd: () => void }) {
  const count = useLiveQuery(() => db.items.count().catch(() => 0), [], 0)

  return (
    <>
      <header className="pt-safe sticky top-0 z-20 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between px-6 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <img src={mark} alt="" className="h-9 w-9" />
            <span className="font-display text-[1.75rem] leading-none tracking-[0.01em]">{t('app.name')}</span>
          </div>
          <span className="text-sm text-ink-3">
            {count === 1 ? t('wardrobe.countOne') : t('wardrobe.count', { count })}
          </span>
        </div>
      </header>

      <Screen>
        {count === 0 && (
          <div className="pt-2">
            <ShopWindow className="mx-auto h-[clamp(300px,47dvh,470px)] w-full max-w-sm">
              <Mannequin
                gender="male"
                className="absolute bottom-[4%] left-[9%] h-[74%] w-auto brightness-[0.55]"
              />
              <Mannequin gender="female" className="absolute right-[13%] bottom-[2.5%] h-[88%] w-auto" />
            </ShopWindow>

            <div className="mt-8 text-center">
              <h2 className="mx-auto max-w-[17ch] font-display text-[1.95rem] leading-[1.12] font-normal tracking-[-0.01em] text-balance">
                {t('wardrobe.emptyTitle')}
              </h2>
              <p className="mx-auto mt-4 max-w-[34ch] text-[1rem] leading-[1.6] text-ink-2">{t('wardrobe.emptyBody')}</p>
              <Button className="mt-7" onClick={onAdd}>
                <PlusIcon width={20} height={20} strokeWidth={1.6} />
                {t('wardrobe.emptyCta')}
              </Button>
            </div>
          </div>
        )}
      </Screen>
    </>
  )
}
