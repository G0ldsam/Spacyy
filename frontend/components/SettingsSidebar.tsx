'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { PUSH_OPT_OUT_KEY } from '@/components/AutoPushSubscribe'
import { useLanguage } from '@/contexts/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly user: {
    readonly name?: string | null
    readonly email?: string | null
  }
  readonly isAdmin?: boolean
}

const PUSH_HINT_SEEN_KEY = 'push-hint-seen'

type BeforeInstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function SettingsSidebar({ open, onClose, user, isAdmin }: Props) {
  const { state, subscribe, unsubscribe, isAndroid, isPWAInstalled, error: contextError } = usePushSubscription()
  const [pushError, setPushError] = useState('')
  const [showPushHint, setShowPushHint] = useState(false)
  const { t } = useLanguage()

  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches || isPWAInstalled)
    const handler = (e: Event) => {
      e.preventDefault()
      installPromptRef.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setCanInstall(false) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isPWAInstalled])

  async function handleInstall() {
    if (!installPromptRef.current) return
    setInstalling(true)
    try {
      await installPromptRef.current.prompt()
      const { outcome } = await installPromptRef.current.userChoice
      if (outcome === 'accepted') {
        installPromptRef.current = null
        setCanInstall(false)
        setIsInstalled(true)
      }
    } finally {
      setInstalling(false)
    }
  }

  useEffect(() => {
    // Check if hint already shown
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem(PUSH_HINT_SEEN_KEY)
      setShowPushHint(!seen && state === 'unsubscribed')
    }
  }, [state])

  useEffect(() => {
    // Mark as seen when sidebar opens and hint is visible
    if (open && showPushHint) {
      localStorage.setItem(PUSH_HINT_SEEN_KEY, '1')
      // Keep showing until they close sidebar
    }
  }, [open, showPushHint])

  async function handleToggle() {
    setPushError('')
    try {
      if (state === 'subscribed') {
        sessionStorage.setItem(PUSH_OPT_OUT_KEY, '1')
        await unsubscribe()
      } else {
        sessionStorage.removeItem(PUSH_OPT_OUT_KEY)
        await subscribe()
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : t('settings.push_unsupported'))
    }
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-3/4 max-w-sm bg-white z-50 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={t('settings.close')}
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile */}
          <div className="px-5 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('settings.profile')}</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                {user.name && <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>}
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Language */}
          <div className="px-5 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('settings.language')}</p>
            <LanguageSwitcher />
          </div>

          {/* Install App */}
          <div className="px-5 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('settings.install_app')}</p>

            {isInstalled ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('settings.install_already')}
              </div>
            ) : canInstall ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex items-center gap-2 w-full px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {installing ? '…' : t('settings.install_button')}
              </button>
            ) : (
              <div>
                <button
                  onClick={() => setShowHowTo((v) => !v)}
                  className="flex items-center justify-between w-full text-sm text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <span className="font-medium">{t('settings.install_how_to')}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showHowTo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showHowTo && (
                  <div className="mt-3 space-y-4">
                    {/* iOS */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                        {t('settings.install_ios_title')}
                      </p>
                      <ol className="space-y-1.5 text-xs text-gray-600 list-none">
                        {[
                          t('settings.install_ios_step1'),
                          t('settings.install_ios_step2'),
                          t('settings.install_ios_step3'),
                          t('settings.install_ios_step4'),
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-brand text-white text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Android */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.523 15.341c-.302 0-.604-.158-.753-.445l-1.498-2.697c-.224.034-.449.051-.676.051-2.803 0-5.082-2.28-5.082-5.083 0-2.803 2.279-5.083 5.082-5.083s5.083 2.28 5.083 5.083c0 1.574-.72 3.074-1.907 4.087l1.505 2.71c.22.396.077.894-.319 1.114-.125.069-.259.1-.392.1l-.043.163zm-2.927-4.576c.313-.065.61-.198.872-.386 1.037-.741 1.617-1.923 1.617-3.213 0-2.122-1.726-3.848-3.848-3.848s-3.848 1.726-3.848 3.848 1.726 3.848 3.848 3.848c.109 0 .218-.005.326-.014l.033-.235zm-9.479 6.558c-.55 0-1.084-.197-1.484-.569-.444-.41-.693-.981-.693-1.601 0-.602.232-1.177.655-1.622.41-.431.951-.673 1.522-.673.57 0 1.112.242 1.523.673l1.613 1.614c.39.39.39 1.023 0 1.413-.39.39-1.023.39-1.413 0l-1.614-1.614c-.13-.13-.337-.203-.552-.203-.215 0-.39.073-.536.224-.148.156-.228.356-.228.566 0 .218.088.418.241.555.156.141.361.208.571.196l.044-.007c.545-.007 1.011.426 1.018.971.007.546-.426 1.012-.971 1.019l-.029.001-.022.001z"/>
                        </svg>
                        {t('settings.install_android_title')}
                      </p>
                      <ol className="space-y-1.5 text-xs text-gray-600 list-none">
                        {[
                          t('settings.install_android_step1'),
                          t('settings.install_android_step2'),
                          t('settings.install_android_step3'),
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-brand text-white text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('settings.notifications')}</p>
              {showPushHint && state === 'unsubscribed' && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>

            {state === 'unsupported' && (
              <p className="text-sm text-gray-500">{t('settings.push_unsupported')}</p>
            )}

            {state === 'denied' && (
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-sm text-gray-900 font-medium mb-1">{t('settings.push_blocked')}</p>
                <p className="text-xs text-gray-600 mb-2">{contextError || t('settings.push_blocked_desc')}</p>
                {isAndroid && (
                  <p className="text-xs text-gray-500 italic">💡 Android: Settings → Apps → Browser → Notifications</p>
                )}
              </div>
            )}

            {(state === 'unsubscribed' || state === 'subscribed' || state === 'loading') && (
              <div>
                {/* Install prompt for Android users not in PWA */}
                {isAndroid && !isPWAInstalled && state === 'unsubscribed' && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-900 font-medium mb-1">📱 Install the app first</p>
                    <p className="text-xs text-gray-600">
                      For reliable notifications on Android, install Spacyy to your home screen: tap browser menu → &ldquo;Add to Home screen&rdquo;
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t('settings.push_notifications')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {state === 'subscribed'
                        ? t('settings.push_enabled')
                        : state === 'loading'
                        ? t('settings.push_updating')
                        : t('settings.push_disabled')}
                    </p>
                  </div>

                  {state === 'loading' ? (
                    <div className="w-11 h-6 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={handleToggle}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${state === 'subscribed' ? 'bg-brand' : 'bg-gray-200'}`}
                      aria-label={t('settings.push_notifications')}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${state === 'subscribed' ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  )}
                </div>

                {(pushError || contextError) && (
                  <p className="text-xs text-red-500 mt-2">{pushError || contextError}</p>
                )}
              </div>
            )}
          </div>

          {/* Account */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('settings.account')}</p>
            <div className="space-y-1">
              {isAdmin && (
                <Link
                  href="/home"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors w-full"
                >
                  <svg className="w-4 h-4 text-gray-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-sm text-gray-700">{t('dashboard_header.client_view')}</span>
                </Link>
              )}

              <Link
                href="/change-password"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors w-full"
              >
                <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-sm text-gray-700">{t('settings.change_password')}</span>
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors w-full text-left"
              >
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm text-red-600">{t('settings.sign_out')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
