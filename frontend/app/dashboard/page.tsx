import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogoutButton } from '@/components/auth/LogoutButton'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Check if user is an owner/admin (customer) or client
  const userOrg = session.user.organizations?.find(
    (org) => org.role === 'OWNER' || org.role === 'ADMIN'
  )

  if (!userOrg) {
    // Redirect clients to home page
    redirect('/home')
  }

  // Get counts for the organization
  const [sessionsCount, bookingsCount, clientsCount] = await Promise.all([
    prisma.serviceSession.count({
      where: {
        organizationId: userOrg.organization.id,
      },
    }),
    prisma.booking.count({
      where: {
        organizationId: userOrg.organization.id,
      },
    }),
    prisma.client.count({
      where: {
        organizationId: userOrg.organization.id,
      },
    }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8 relative">
            <div className="absolute top-0 right-0">
              <LogoutButton />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                Welcome back, {session.user.name || session.user.email}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <a href="/bookings">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-[#8B1538]">{bookingsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">Total bookings</p>
                </CardContent>
              </Card>
            </a>

            <a href="/sessions">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">My Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-[#8B1538]">{sessionsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">Total sessions</p>
                </CardContent>
              </Card>
            </a>

            <a href="/clients">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer sm:col-span-2 lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">Clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl sm:text-4xl font-bold text-[#8B1538]">{clientsCount}</p>
                  <p className="text-sm text-gray-700 mt-1">Total clients</p>
                </CardContent>
              </Card>
            </a>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            <a href="/policy">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">Policy Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">Configure booking policies and rules</p>
                </CardContent>
              </Card>
            </a>

            <a href="/admin/membership">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">Membership Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">Renew memberships and manage session allowances</p>
                </CardContent>
              </Card>
            </a>

            <a href="/admin/check-in">
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">Check-In</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">Scan QR codes to check in clients for sessions</p>
                </CardContent>
              </Card>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
