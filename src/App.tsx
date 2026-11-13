import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { UpdatePrompt } from './components/UpdatePrompt'
import { CheckIcon } from './components/Icons'
import { t } from './i18n'
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
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    startup().then(setStatus)
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
        {tab === 'wardrobe' && <WardrobeScreen onAdd={() => go('add')} />}
        {tab === 'tryon' && <TryOnScreen onAdd={() => go('add')} />}
        {tab === 'outfits' && <OutfitsScreen onCreate={() => go('tryon')} />}
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
        <div role="status" className="mb-safe fixed inset-x-0 bottom-[5.75rem] z-50 flex justify-center px-3">
          <div className="flex items-center gap-2 rounded-full border border-[#d6b47c]/30 bg-velvet-2 px-5 py-3 text-[0.95rem] text-ivory shadow-2xl">
            <CheckIcon width={18} height={18} className="text-[#d6b47c]" /> {toast}
          </div>
        </div>
      )}
      <TabBar tab={tab} onChange={go} />
    </div>
  )
}
