import { t } from '../i18n'
import { EmptyState, Screen, ScreenHeader } from '../components/ui'

/** A small preview of the premium black "egghead" mannequin style coming in Stage 4. */
function EggheadArt() {
  return (
    <svg width="150" height="190" viewBox="0 0 150 190" aria-hidden="true">
      <defs>
        <radialGradient id="eh-head" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#56514d" />
          <stop offset="0.45" stopColor="#1c1a19" />
          <stop offset="1" stopColor="#050505" />
        </radialGradient>
        <linearGradient id="eh-body" x1="0" x2="1">
          <stop offset="0" stopColor="#060606" />
          <stop offset="0.35" stopColor="#34302d" />
          <stop offset="0.6" stopColor="#151413" />
          <stop offset="1" stopColor="#040404" />
        </linearGradient>
        <linearGradient id="eh-mirror" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--c-accent)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--c-accent)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <ellipse cx="75" cy="95" rx="66" ry="90" fill="var(--c-surface-2)" stroke="url(#eh-mirror)" strokeWidth="3" />
      <path d="M75 104c-18 0-34 5-45 14-9 7-13 19-14 36v36h118v-36c-1-17-5-29-14-36-11-9-27-14-45-14Z" fill="url(#eh-body)" />
      <path d="M65 80h20l2 26c-5 4-19 4-24 0Z" fill="#141312" />
      <ellipse cx="75" cy="58" rx="23" ry="30" fill="url(#eh-head)" />
      <ellipse cx="67" cy="45" rx="6" ry="11" fill="#fff" opacity="0.2" transform="rotate(-18 67 45)" />
    </svg>
  )
}

export function TryOnScreen() {
  return (
    <>
      <ScreenHeader title={t('tryon.title')} />
      <Screen>
        <EmptyState art={<EggheadArt />} title={t('tryon.emptyTitle')} body={t('tryon.emptyBody')} />
      </Screen>
    </>
  )
}
