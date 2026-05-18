'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

const DISMISS_KEY = 'pwa-banner-dismissed'
const DISMISS_TTL = 48 * 60 * 60 * 1000

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallBanner() {
  const { t } = useLanguage()
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    const onInstalled = () => dismiss()

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    const showTimer = setTimeout(() => {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    }, 3000)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      clearTimeout(showTimer)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setTimeout(() => setMounted(false), 300)
  }

  async function handleInstall() {
    if (!promptRef.current) return
    setInstalling(true)
    try {
      await promptRef.current.prompt()
      const { outcome } = await promptRef.current.userChoice
      if (outcome === 'accepted') {
        promptRef.current = null
        dismiss()
      }
    } finally {
      setInstalling(false)
    }
  }

  if (!mounted) return null

  const iosSteps = [
    t('settings.install_ios_step1'),
    t('settings.install_ios_step2'),
    t('settings.install_ios_step3'),
    t('settings.install_ios_step4'),
  ]
  const androidSteps = [
    t('settings.install_android_step1'),
    t('settings.install_android_step2'),
    t('settings.install_android_step3'),
  ]

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[60] p-3 transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-w-lg mx-auto">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B1538] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{t('install_banner.title')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('install_banner.desc')}</p>
            </div>
            <button
              onClick={dismiss}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            {canInstall ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex-1 py-2 bg-[#8B1538] text-white text-sm font-semibold rounded-xl hover:bg-[#7a1230] transition-colors disabled:opacity-60"
              >
                {installing ? '…' : t('install_banner.install')}
              </button>
            ) : (
              <button
                onClick={() => setShowSteps((v) => !v)}
                className="flex-1 py-2 bg-[#8B1538] text-white text-sm font-semibold rounded-xl hover:bg-[#7a1230] transition-colors flex items-center justify-center gap-1.5"
              >
                {t('install_banner.howto')}
                <svg className={`w-3.5 h-3.5 transition-transform ${showSteps ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            <button
              onClick={dismiss}
              className="px-4 py-2 text-sm text-gray-500 rounded-xl hover:bg-gray-100 transition-colors font-medium"
            >
              {t('install_banner.dismiss')}
            </button>
          </div>
        </div>

        {showSteps && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-2">{t('settings.install_ios_title')}</p>
              <ol className="space-y-2 list-none">
                {iosSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#8B1538] text-white text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                    <span className="text-[11px] text-gray-600 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-2">{t('settings.install_android_title')}</p>
              <ol className="space-y-2 list-none">
                {androidSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#8B1538] text-white text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                    <span className="text-[11px] text-gray-600 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
