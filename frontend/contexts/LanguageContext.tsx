'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import en from '@/messages/en'
import el from '@/messages/el'

export type Lang = 'en' | 'el'

const STORAGE_KEY = 'spacyy_lang'
const DEFAULT_LANG: Lang = 'el'

const messages = { en, el } as const

function getNestedValue(obj: unknown, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return path
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : path
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (stored === 'en' || stored === 'el') {
      setLangState(stored)
    }
  }, [])

  function setLang(newLang: Lang) {
    setLangState(newLang)
    localStorage.setItem(STORAGE_KEY, newLang)
  }

  function t(key: string, vars?: Record<string, string | number>): string {
    const msgs = messages[lang]

    if (vars?.count !== undefined) {
      const count = Number(vars.count)
      const pluralKey = count === 1 ? `${key}_one` : `${key}_other`
      const pluralStr = getNestedValue(msgs, pluralKey)
      if (pluralStr !== pluralKey) {
        return interpolate(pluralStr, vars)
      }
    }

    const str = getNestedValue(msgs, key)
    return interpolate(str, vars)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
