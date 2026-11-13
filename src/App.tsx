import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { UpdatePrompt } from './components/UpdatePrompt'
import { startup, type StartupStatus } from './lib/storage'
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

  useEffect(() => {
    startup().then(setStatus)
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((next: Tab) => {
    setTab(next)
    if (window.location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`)
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="min-h-dvh">
      <UpdatePrompt />
      <div key={tab}>
        {tab === 'wardrobe' && <WardrobeScreen onAdd={() => go('add')} />}
        {tab === 'tryon' && <TryOnScreen onAdd={() => go('add')} />}
        {tab === 'add' && <AddItemScreen />}
        {tab === 'outfits' && <OutfitsScreen onCreate={() => go('tryon')} />}
        {tab === 'options' && <SettingsScreen status={status} />}
      </div>
      <TabBar tab={tab} onChange={go} />
    </div>
  )
}
