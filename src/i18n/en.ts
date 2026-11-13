// All words shown in the app live here.
// To add a language: copy this file (e.g. ur.ts), translate the right-hand side,
// and register it in src/i18n/index.ts.
export const en = {
  'app.name': 'WardrobeMirror',
  'app.tagline': 'Your real clothes, on a mannequin, on your phone.',

  'tab.wardrobe': 'Wardrobe',
  'tab.tryon': 'Try-On',
  'tab.add': 'Add item',
  'tab.outfits': 'Saved',
  'tab.settings': 'Settings',
  'tab.navLabel': 'Main sections',

  'wardrobe.title': 'Wardrobe',
  'wardrobe.subtitle': '{count} items',
  'wardrobe.emptyTitle': 'Your wardrobe is empty',
  'wardrobe.emptyBody': 'Take a photo of a T-shirt, a pair of jeans or your favourite shoes. The app cuts out the background for you.',
  'wardrobe.emptyCta': 'Add your first clothing item',

  'add.title': 'Add item',
  'add.soonTitle': 'Photo wizard comes next',
  'add.soonBody': 'In the next stage this screen will let you pick a category, take or choose a photo, and remove its background automatically.',
  'add.tipsTitle': 'Photo tips for later',
  'add.tip1': 'Lay the garment flat on a plain floor or bed sheet.',
  'add.tip2': 'Use daylight and avoid shadows.',
  'add.tip3': 'Keep the whole garment in the picture.',
  'add.tip4': 'Hold the phone straight above it.',

  'tryon.title': 'Try-On',
  'tryon.emptyTitle': 'The mannequin is on its way',
  'tryon.emptyBody': 'Soon you will dress a faceless mannequin with your own clothes here, and see the back view in the mirror.',

  'outfits.title': 'Saved outfits',
  'outfits.emptyTitle': 'No saved outfits yet',
  'outfits.emptyBody': 'When you put together a look you like on the mannequin, save it and it will appear here.',
  'outfits.emptyCta': 'Create your first outfit',

  'settings.title': 'Settings',
  'settings.install': 'Install the app',
  'settings.installed': 'The app is installed on this device.',
  'settings.installAndroid': 'Add WardrobeMirror to your home screen so it opens like a normal app, even without internet.',
  'settings.installButton': 'Install app',
  'settings.installIosIntro': 'On iPhone, installing takes three taps in Safari:',
  'settings.installIos1': 'Tap the Share button (the square with an arrow pointing up).',
  'settings.installIos2': 'Scroll down and tap “Add to Home Screen”.',
  'settings.installIos3': 'Tap “Add” in the top corner.',
  'settings.installIosNotSafari': 'Open this page in Safari first. Other browsers on iPhone cannot install apps.',
  'settings.installOther': 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.',

  'settings.storage': 'Storage on this device',
  'settings.storageUsed': '{used} used of about {quota} available',
  'settings.storageUnknown': 'This browser does not report how much space is left.',
  'settings.storageWarn': 'Your phone storage for this app is almost full. Make a backup and delete items you no longer need.',
  'settings.persisted': 'Protected from automatic clean-up',
  'settings.notPersisted': 'Not protected yet. Installing the app usually fixes this. Make backups to be safe.',
  'settings.dbOk': 'On-phone database is working',
  'settings.dbFail': 'The on-phone database could not open. Private browsing mode can cause this.',
  'settings.counts': '{items} items · {outfits} outfits',
  'settings.firstOpened': 'First opened on {date}',

  'settings.privacy': 'Privacy',
  'settings.privacyBody': 'All your photos and data stay on this device. There is no account, no login, and nothing is uploaded to any server. We do not track you. If you delete the app or clear your browser data, your wardrobe is gone, so use Backup.',
  'settings.camera': 'Camera',
  'settings.cameraBody': 'We use your camera only to photograph your clothes. Photos stay on your device.',
  'settings.disclaimer': 'Good to know',
  'settings.disclaimerBody': 'WardrobeMirror shows a flat, approximate preview of how clothes might look together. It is not a true-to-body fitting and does not guarantee real-life fit or colour accuracy.',

  'settings.about': 'About',
  'settings.version': 'Version {version}',
  'settings.credits': 'Made with free, open-source tools',

  'update.ready': 'New version available',
  'update.tap': 'Tap to refresh',
  'update.later': 'Later',
  'offline.ready': 'Ready to work offline',

  'banner.installTitle': 'Install WardrobeMirror',
  'banner.installBody': 'Add it to your home screen to use it like an app, even offline.',
  'banner.show': 'Show me how',
  'banner.install': 'Install',
  'banner.dismiss': 'Not now',

  'common.close': 'Close',
  'common.yes': 'Yes',
  'common.no': 'No',
} as const

export type TranslationKey = keyof typeof en
export type Translations = Record<TranslationKey, string>
