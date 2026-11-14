import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { UpdatePrompt } from './components/UpdatePrompt'
import { CheckIcon } from './components/Icons'
import { t } from './i18n'
import { startup, type StartupStatus } from './lib/storage'
import { upgradeItems } from './lib/fitStore'
import { AddItemScreen } from './screens/AddItem'
import { OutfitsScreen } from './screens/Outfits'
import { SettingsScreen } from './screens/Settings'
import { TryOnScreen } from './screens/TryOn'
import { WardrobeScreen } from './screens/Wardrobe'

const TABS: Tab[] = ['wardrobe', 'tryon', 'add', 'outfits', 'options']
const tabFromHash = (): Tab => {
  const h = window.location.hash.replace('#', '') as Tab
  return TABS.includes(h) ? h : 'wardrobe'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [status, setStatus] = useState<StartupStatus | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    startup().then((st) => {
      setStatus(st)
      setTimeout(() => upgradeItems().catch(() => undefined), 1500)
    })
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  const go = useCallback((next: Tab) => {
    setTab(next)
    if (window.location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`)
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="min-h-dvh">
      <UpdatePrompt />
      <div key={tab}>
        {tab === 'wardrobe' && <WardrobeScreen onAdd={() => go('add')} onTryOn={() => go('tryon')} />}
        {tab === 'tryon' && <TryOnScreen onAdd={() => go('add')} notify={setToast} />}
        {tab === 'outfits' && <OutfitsScreen onCreate={() => go('tryon')} onWear={() => go('tryon')} />}
        {tab === 'options' && <SettingsScreen status={status} />}
      </div>
      {/* The Add wizard stays alive in the background, so a half-finished piece is never lost when switching tabs. */}
      <div hidden={tab !== 'add'}>
        <AddItemScreen
          onSaved={() => {
            setToast(t('add.saved'))
            go('wardrobe')
          }}
          onExit={() => go('wardrobe')}
        />
      </div>
      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-3">
          <div className="flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-[0.95rem] font-medium text-bg shadow-2xl">
            <CheckIcon width={18} height={18} className="text-accent" /> {toast}
          </div>
        </div>
      )}
      <TabBar tab={tab} onChange={go} />
    </div>
  )
}
