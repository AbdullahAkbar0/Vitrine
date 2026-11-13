// All words shown in the app live here.
// To add a language: copy this file (e.g. ur.ts), translate the right-hand side,
// and register it in src/i18n/index.ts.
export const en = {
  'app.name': 'Vitrine',
  'app.tagline': 'Your own clothes, styled in a boutique window on your phone.',

  'tab.wardrobe': 'Wardrobe',
  'tab.tryon': 'Try on',
  'tab.add': 'Add a piece',
  'tab.outfits': 'Looks',
  'tab.settings': 'Settings',
  'tab.navLabel': 'Main sections',

  'wardrobe.count': '{count} pieces',
  'wardrobe.countOne': '1 piece',
  'wardrobe.emptyTitle': 'Dress the window with your own clothes',
  'wardrobe.emptyBody': 'Photograph a piece you own. Vitrine lifts it off the background and keeps every colour, stitch and logo exactly as in your photo.',
  'wardrobe.emptyCta': 'Add your first piece',

  'add.title': 'Add a piece',
  'add.soonTitle': 'The photo studio opens in the next update',
  'add.soonBody': 'Here you will choose what the piece is, take or pick a photo, and watch the background disappear.',
  'add.realTitle': 'Your piece stays exactly as it is',
  'add.realBody': 'Vitrine only removes the background and tidies the edges. Colours, texture, prints and logos stay true to your photo. Nothing is redrawn or turned into a cartoon.',
  'add.tipsTitle': 'For the cleanest cut-out',
  'add.tip1': 'Lay the piece flat on a plain floor or bed sheet, or hang it on a door.',
  'add.tip2': 'Shoot in daylight, without hard shadows.',
  'add.tip3': 'Keep the whole piece inside the picture.',
  'add.tip4': 'Hold the phone straight above it.',

  'tryon.title': 'Try on',
  'tryon.female': 'Female',
  'tryon.male': 'Male',
  'tryon.mannequin': 'Mannequin',
  'tryon.mirror': 'Back view',
  'tryon.trayEmpty': 'Your pieces will hang here.',
  'tryon.trayCta': 'Add a piece',

  'outfits.title': 'Looks',
  'outfits.emptyTitle': 'No looks saved yet',
  'outfits.emptyBody': 'Style the mannequin with your pieces, then save the look to keep it here.',
  'outfits.emptyCta': 'Style the mannequin',

  'settings.title': 'Settings',
  'settings.groupInstall': 'On your home screen',
  'settings.installed': 'Vitrine is installed on this phone.',
  'settings.installAndroid': 'Install Vitrine so it opens from your home screen like any other app, even without internet.',
  'settings.installButton': 'Install Vitrine',
  'settings.installIosIntro': 'In Safari, it takes three taps:',
  'settings.installIos1': 'Tap Share, the square with an arrow pointing up.',
  'settings.installIos2': 'Scroll down and tap “Add to Home Screen”.',
  'settings.installIos3': 'Tap “Add”.',
  'settings.installIosNotSafari': 'Open this page in Safari to install it. Other browsers on iPhone cannot install apps.',
  'settings.installOther': 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.',

  'settings.groupStorage': 'Storage',
  'settings.storageUsed': '{used} used of about {quota}',
  'settings.storageUnknown': 'This browser does not say how much space is left.',
  'settings.storageWarn': 'Space for Vitrine is almost full. Make a backup and remove pieces you no longer need.',
  'settings.persisted': 'Protected from automatic clean-up',
  'settings.notPersisted': 'Not protected from clean-up yet. Installing Vitrine usually fixes this.',
  'settings.dbOk': 'Your wardrobe is saved on this phone',
  'settings.dbFail': 'Your wardrobe could not be opened. Private browsing can cause this.',
  'settings.counts': '{items} pieces, {outfits} looks',
  'settings.firstOpened': 'First opened {date}',

  'settings.groupPrivacy': 'Privacy',
  'settings.privacyBody': 'Your photos and data stay on this phone. There is no account, no login, and nothing is uploaded. No tracking. If you delete the app or clear browser data, your wardrobe is gone, so keep a backup.',
  'settings.cameraBody': 'The camera is used only to photograph your clothes. Photos stay on your phone.',

  'settings.groupAbout': 'About',
  'settings.version': 'Version {version}',
  'settings.disclaimerBody': 'Vitrine shows a flat, approximate preview of how pieces look together. It is not a body-accurate fitting and cannot promise real-life fit or exact colour.',
  'settings.credits': 'Built with open-source tools: React, Vite, Tailwind CSS (MIT); Dexie.js (Apache-2.0); vite-plugin-pwa and Workbox (MIT); Bodoni Moda and Jost typefaces (SIL Open Font License).',

  'update.ready': 'A new version of Vitrine is ready',
  'update.tap': 'Refresh',
  'update.later': 'Later',
  'offline.ready': 'Vitrine now works offline',

  'common.close': 'Close',
} as const

export type TranslationKey = keyof typeof en
export type Translations = Record<TranslationKey, string>
