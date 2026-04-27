'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => setLang('el')}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
          lang === 'el'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        ΕΛ
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
          lang === 'en'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        EN
      </button>
    </div>
  )
}
