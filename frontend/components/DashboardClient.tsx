'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AutoPushSubscribe from '@/components/AutoPushSubscribe'
import DashboardHeader from '@/components/DashboardHeader'
import { useLanguage } from '@/contexts/LanguageContext'

interface Props {
  userName: string | null | undefined
  userEmail: string | null | undefined
  activeBookingsCount: number
  totalBookingsCount: number
  sessionsCount: number
  clientsCount: number
}

export default function DashboardClient({
  userName,
  userEmail,
  activeBookingsCount,
  totalBookingsCount,
  sessionsCount,
  clientsCount,
}: Props) {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gray-50">
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
            <a href="/bookings">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.bookings')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-[#8B1538]">{activeBookingsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">{t('dashboard.active_bookings')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('dashboard.total', { count: totalBookingsCount })}</p>
                </CardContent>
              </Card>
            </a>

            <a href="/sessions">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.my_sessions')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-[#8B1538]">{sessionsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">{t('dashboard.total_sessions')}</p>
                </CardContent>
              </Card>
            </a>

            <a href="/clients">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer sm:col-span-2 lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.clients')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-[#8B1538]">{clientsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">{t('dashboard.total_clients')}</p>
                </CardContent>
              </Card>
            </a>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            <a href="/policy">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.policy')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{t('dashboard.policy_desc')}</p>
                </CardContent>
              </Card>
            </a>

            <a href="/admin/membership">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.membership')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{t('dashboard.membership_desc')}</p>
                </CardContent>
              </Card>
            </a>

            <a href="/admin/check-in">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{t('dashboard.checkin')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{t('dashboard.checkin_desc')}</p>
                </CardContent>
              </Card>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
