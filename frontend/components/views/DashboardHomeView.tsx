'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AutoPushSubscribe from '@/components/AutoPushSubscribe'
import DashboardHeader from '@/components/DashboardHeader'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDashboardStats } from '@/hooks/useBookingsData'
import { PageSpinner } from '@/components/ui/spinner'

type AdminView = 'home' | 'bookings' | 'sessions' | 'clients'

interface Props {
  readonly userName: string | null | undefined
  readonly userEmail: string | null | undefined
  readonly onNavigate: (view: AdminView) => void
}

export default function DashboardHomeView({ userName, userEmail, onNavigate }: Props) {
  const { t } = useLanguage()
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) return <PageSpinner />

  const activeBookingsCount = stats?.activeBookingsCount ?? 0
  const reservedBookingsCount = stats?.reservedBookingsCount ?? 0
  const totalBookingsCount = stats?.totalBookingsCount ?? 0
  const sessionsCount = stats?.sessionsCount ?? 0
  const clientsCount = stats?.clientsCount ?? 0

  return (
    <div className="min-h-screen bg-brand-surface">
      <AutoPushSubscribe />
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8 relative">
            <div className="absolute top-0 right-0">
              <DashboardHeader userName={userName} userEmail={userEmail} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('dashboard.title')}</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                {t('dashboard.welcome', { name: userName || userEmail || '' })}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <button onClick={() => onNavigate('bookings')} className="text-left">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.bookings')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-brand">{activeBookingsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {t('dashboard.active_bookings')}
                    {reservedBookingsCount > 0 && (
                      <span className="text-purple-600 font-medium ml-1">
                        ({reservedBookingsCount} reserved)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{t('dashboard.total', { count: totalBookingsCount })}</p>
                </CardContent>
              </Card>
            </button>

            <button onClick={() => onNavigate('sessions')} className="text-left">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.my_sessions')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-brand">{sessionsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">{t('dashboard.total_sessions')}</p>
                </CardContent>
              </Card>
            </button>

            <button onClick={() => onNavigate('clients')} className="text-left sm:col-span-2 lg:col-span-1 w-full">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.clients')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-brand">{clientsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">{t('dashboard.total_clients')}</p>
                </CardContent>
              </Card>
            </button>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            <Link href="/policy">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.policy')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{t('dashboard.policy_desc')}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/membership">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.membership')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{t('dashboard.membership_desc')}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/check-in">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.checkin')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{t('dashboard.checkin_desc')}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/brand">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.brand_studio')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{t('dashboard.brand_studio_desc')}</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
