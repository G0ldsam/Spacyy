'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { PUSH_OPT_OUT_KEY } from '@/components/AutoPushSubscribe'
import { useLanguage } from '@/contexts/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

interface Props {
  open: boolean
  onClose: () => void
  user: {
    name?: string | null
    email?: string | null
  }
}

export default function SettingsSidebar({ open, onClose, user }: Props) {
  const { state, subscribe, unsubscribe } = usePushSubscription()
  const [pushError, setPushError] = useState('')
  const { t } = useLanguage()

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
              <div className="w-10 h-10 rounded-full bg-[#8B1538] flex items-center justify-center shrink-0">
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

          {/* Notifications */}
          <div className="px-5 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('settings.notifications')}</p>

            {state === 'unsupported' && (
              <p className="text-sm text-gray-500">{t('settings.push_unsupported')}</p>
            )}

            {state === 'denied' && (
              <div>
                <p className="text-sm text-gray-700 mb-1">{t('settings.push_blocked')}</p>
                <p className="text-xs text-gray-500">{t('settings.push_blocked_desc')}</p>
              </div>
            )}

            {(state === 'unsubscribed' || state === 'subscribed' || state === 'loading') && (
              <div>
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
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${state === 'subscribed' ? 'bg-[#8B1538]' : 'bg-gray-200'}`}
                      aria-label={t('settings.push_notifications')}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${state === 'subscribed' ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  )}
                </div>

                {pushError && (
                  <p className="text-xs text-red-500 mt-2">{pushError}</p>
                )}
              </div>
            )}
          </div>

          {/* Account */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('settings.account')}</p>
            <div className="space-y-1">
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
