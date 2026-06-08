'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import NotificationBell from '@/components/NotificationBell'
import AutoPushSubscribe from '@/components/AutoPushSubscribe'
import SettingsSidebar from '@/components/SettingsSidebar'
import { ClientQRButton } from '@/components/ClientQRButton'
import { PWAInstallBanner } from '@/components/PWAInstallBanner'
import { useLanguage } from '@/contexts/LanguageContext'

interface Booking {
  id: string
  serviceSession: { id: string; name: string; themeColor: string } | null
  startTime: string
  endTime: string
  status: string
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useLanguage()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [sessionAllowance, setSessionAllowance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [expirationWarning, setExpirationWarning] = useState<{
    show: boolean
    lastBookingDate: Date | null
  }>({ show: false, lastBookingDate: null })

  // Single parallel fetch — eliminates the sequential waterfall
  const loadData = useCallback(async () => {
    try {
      const [clientRes, bookingsRes] = await Promise.all([
        fetch('/api/clients/me'),
        fetch('/api/bookings/my'),
      ])

      const [clientData, bookingsData] = await Promise.all([
        clientRes.ok ? clientRes.json() : null,
        bookingsRes.ok ? bookingsRes.json() : [],
      ])

      const allowance: number | null = clientData?.sessionAllowance ?? null
      setSessionAllowance(allowance)

      const now = new Date()
      const active: Booking[] = bookingsData.filter((b: Booking) => {
        if (b.status === 'CANCELLED') return false
        return new Date(b.endTime) >= now
      })
      setMyBookings(active)

      if (allowance !== null && active.length >= allowance && active.length > 0) {
        const lastEnd = new Date(
          [...active].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0].endTime
        )
        const oneDayOut = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        setExpirationWarning({ show: lastEnd <= oneDayOut, lastBookingDate: lastEnd <= oneDayOut ? lastEnd : null })
      } else {
        setExpirationWarning({ show: false, lastBookingDate: null })
      }
    } catch (error) {
      console.error('Error loading home data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') loadData()
  }, [status, router, loadData])

  if (status === 'loading' || loading) return <PageSpinner />

  const isAdmin = session?.user?.organizations?.some(o => o.role === 'OWNER' || o.role === 'ADMIN') ?? false
  const slotsRemaining = sessionAllowance === null ? null : sessionAllowance - myBookings.length
  const showRebookBanner = !isAdmin && slotsRemaining !== null && slotsRemaining > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <AutoPushSubscribe />
      <PWAInstallBanner />
      {isAdmin && (
        <div className="bg-[#8B1538] text-white text-center text-sm py-2 px-4">
          {t('home.preview_banner')}{' '}
          <a href="/dashboard" className="underline font-medium hover:opacity-80">{t('home.preview_link')}</a>
        </div>
      )}

      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8 relative">
            <div className="absolute top-0 right-0 flex items-center gap-2">
              <NotificationBell />
              <ClientQRButton />
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label={t('home.settings_label')}
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <SettingsSidebar
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              user={{ name: session?.user?.name, email: session?.user?.email }}
              isAdmin={isAdmin}
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('home.title')}</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                {t('home.welcome', { name: session?.user?.name || session?.user?.email || '' })}
              </p>
            </div>
          </div>

          {/* Rebook banner — only when client has slots but no bookings yet */}
          {showRebookBanner && (
            <Link href="/rebook" className="block mb-6">
              <div className="rounded-2xl bg-gradient-to-r from-[#8B1538] to-[#a01a42] p-4 text-white flex items-center justify-between gap-4 shadow-md hover:shadow-lg hover:opacity-95 transition-all">
                <div>
                  <p className="font-bold text-sm leading-tight">Book your sessions for this month</p>
                  <p className="text-xs opacity-75 mt-0.5">
                    {sessionAllowance} session{sessionAllowance === 1 ? '' : 's'} available
                  </p>
                </div>
                <div className="shrink-0 bg-white/20 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                  Book now
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          )}

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* My Sessions + Waitlist */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Link href="/my-sessions">
                <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg sm:text-xl">{t('home.my_sessions')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-1">{myBookings.length}</p>
                      <p className="text-sm text-gray-700">
                        {myBookings.length === 1 ? t('home.session_one') : t('home.session_other')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/my-waitlist">
                <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{t('home.my_waitlist')}</p>
                        <p className="text-xs text-gray-500">{t('home.my_waitlist_desc')}</p>
                      </div>
                      <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Right Sidebar */}
            <div className="flex flex-col gap-6">
              {/* Book a Session */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">{t('home.book_session')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-700">{t('home.book_desc')}</p>
                  <Link href="/rebook">
                    <Button className="w-full bg-[#8B1538] hover:bg-[#7a1230]">
                      Book sessions
                    </Button>
                  </Link>
                  <Link href="/book">
                    <Button variant="outline" className="w-full">
                      {t('home.browse')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Member Card */}
              <Link href="/membership" className="block">
                <div className="bg-gradient-to-br from-[#8B1538] to-[#722F37] rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden min-h-[240px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-xs opacity-80 mb-1">{t('home.member_since')}</p>
                        <p className="text-base font-semibold">{new Date().getFullYear()}</p>
                      </div>
                      <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-xs opacity-80 mb-2">{t('home.member_label')}</p>
                      <p className="text-lg font-bold mb-1 truncate">
                        {session?.user?.name || session?.user?.email?.split('@')[0] || 'Member'}
                      </p>
                      {session?.user?.email && (
                        <p className="text-xs opacity-70 truncate">{session.user.email}</p>
                      )}
                    </div>

                    <div className="border-t border-white/20 pt-4">
                      <p className="text-xs opacity-80 mb-2">{t('home.sessions_label')}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold">{myBookings.length}</p>
                        <p className="text-sm opacity-70">
                          {sessionAllowance === null ? '/ ∞' : `/ ${sessionAllowance}`}
                        </p>
                      </div>
                      {slotsRemaining !== null && slotsRemaining > 0 && (
                        <p className="text-xs opacity-60 mt-1">
                          {t('home.remaining', { count: slotsRemaining })}
                        </p>
                      )}
                    </div>

                    {expirationWarning.show && (
                      <div className="border-t border-white/20 pt-4 mt-4">
                        <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-2.5">
                          <p className="text-[10px] sm:text-xs font-semibold text-yellow-100 mb-1">{t('home.expiring_title')}</p>
                          <p className="text-[10px] text-yellow-100/90">{t('home.expiring_desc')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs opacity-70 text-center">{t('home.tap_qr')}</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
