import { en, type TranslationKey, type Translations } from './en'

type Language = { name: string; dir: 'ltr' | 'rtl'; strings: Translations }

// Add new languages here, e.g. ur: { name: 'اردو', dir: 'rtl', strings: ur }
export const languages: Record<string, Language> = {
  en: { name: 'English', dir: 'ltr', strings: en },
}

let current = 'en'

export function setLanguage(code: string) {
  if (!languages[code]) return
  current = code
  document.documentElement.lang = code
  document.documentElement.dir = languages[code].dir
}

/** Translate a key. Use {name} in the text to insert values. */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  let text: string = languages[current].strings[key] ?? en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v))
  }
  return text
}
