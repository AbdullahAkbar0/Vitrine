import { t } from '../i18n'
import { ShopWindow } from '../components/Window'
import { Screen, ScreenHeader } from '../components/ui'

/** A T-shirt drawn in a single brass line, waiting in the window. */
function GarmentOutline() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-x-0 top-[22%] mx-auto w-[62%] rise-in" aria-hidden>
      <defs>
        <linearGradient id="brassLine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3e0b5" />
          <stop offset="1" stopColor="#b8935a" />
        </linearGradient>
      </defs>
      <path
        d="M70 30 C 78 42 122 42 130 30 L 168 48 C 172 50 174 54 172 58 L 160 84 C 158 88 154 89 150 87 L 140 82 L 140 168 C 140 172 137 175 133 175 L 67 175 C 63 175 60 172 60 168 L 60 82 L 50 87 C 46 89 42 88 40 84 L 28 58 C 26 54 28 50 32 48 Z"
        fill="none"
        stroke="url(#brassLine)"
        strokeWidth="1.4"
        strokeDasharray="4 5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AddItemScreen() {
  const tips = ['add.tip1', 'add.tip2', 'add.tip3', 'add.tip4'] as const
  return (
    <>
      <ScreenHeader title={t('add.title')} />
      <Screen>
        <ShopWindow className="mx-auto h-64 w-52">
          <GarmentOutline />
        </ShopWindow>
        <div className="mt-7 text-center">
          <h2 className="mx-auto max-w-[18ch] font-display text-[1.6rem] leading-tight font-normal text-balance">
            {t('add.soonTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-[34ch] leading-[1.6] text-ink-2">{t('add.soonBody')}</p>
        </div>

        <section className="mt-10 border-t border-line pt-7">
          <h3 className="font-display text-[1.25rem] font-normal">{t('add.realTitle')}</h3>
          <p className="mt-2 leading-[1.6] text-ink-2">{t('add.realBody')}</p>
        </section>

        <section className="mt-8 border-t border-line pt-7">
          <h3 className="font-display text-[1.25rem] font-normal">{t('add.tipsTitle')}</h3>
          <ul className="mt-3 space-y-3 leading-[1.55] text-ink-2">
            {tips.map((k) => (
              <li key={k} className="flex gap-3.5">
                <span className="mt-[0.6rem] h-px w-4 shrink-0 bg-brass" aria-hidden />
                {t(k)}
              </li>
            ))}
          </ul>
        </section>
      </Screen>
    </>
  )
}
