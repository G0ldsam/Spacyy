'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import AutoPushSubscribe from '@/components/AutoPushSubscribe'
import DashboardHeader from '@/components/DashboardHeader'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDashboardStats } from '@/hooks/useBookingsData'

type AdminView = 'home' | 'bookings' | 'sessions' | 'clients'

interface Props {
  readonly userName: string | null | undefined
  readonly userEmail: string | null | undefined
  readonly onNavigate: (view: AdminView) => void
}

function StatCard({
  title,
  value,
  sub,
  extra,
  isLoading,
  onClick,
}: Readonly<{
  title: string
  value: number
  sub: string
  extra?: React.ReactNode
  isLoading: boolean
  onClick: () => void
}>) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-16 mb-2" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <p className="text-3xl sm:text-4xl font-bold text-brand">{value}</p>
              <p className="text-sm text-gray-700 mt-1">{sub}{extra}</p>
            </>
          )}
        </CardContent>
      </Card>
    </button>
  )
}

export default function DashboardHomeView({ userName, userEmail, onNavigate }: Props) {
  const { t } = useLanguage()
  const { data: stats, isLoading } = useDashboardStats()

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
            <StatCard
              title={t('dashboard.bookings')}
              value={activeBookingsCount}
              sub={t('dashboard.active_bookings')}
              extra={
                reservedBookingsCount > 0 && !isLoading ? (
                  <span className="text-purple-600 font-medium ml-1">
                    ({reservedBookingsCount} reserved)
                  </span>
                ) : null
              }
              isLoading={isLoading}
              onClick={() => onNavigate('bookings')}
            />
            <StatCard
              title={t('dashboard.my_sessions')}
              value={sessionsCount}
              sub={t('dashboard.total_sessions')}
              isLoading={isLoading}
              onClick={() => onNavigate('sessions')}
            />
            <div className="sm:col-span-2 lg:col-span-1">
              <StatCard
                title={t('dashboard.clients')}
                value={clientsCount}
                sub={t('dashboard.total_clients')}
                isLoading={isLoading}
                onClick={() => onNavigate('clients')}
              />
            </div>
          </div>

          {!isLoading && totalBookingsCount > 0 && (
            <p className="text-xs text-gray-500 mt-2 px-1">
              {t('dashboard.total', { count: totalBookingsCount })}
            </p>
          )}

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
