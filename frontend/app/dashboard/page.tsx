import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Check if user is an owner/admin (customer) or client
  const isOwner = session.user.organizations?.some(
    (org) => org.role === 'OWNER' || org.role === 'ADMIN'
  )

  if (!isOwner) {
    // Redirect clients to booking page
    redirect('/book')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Welcome back, {session.user.name || session.user.email}
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">0</p>
                <p className="text-sm text-gray-500 mt-1">Total bookings</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Spaces</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">0</p>
                <p className="text-sm text-gray-500 mt-1">Available spaces</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm sm:col-span-2 lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">Clients</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl sm:text-4xl font-bold">0</p>
                <p className="text-sm text-gray-500 mt-1">Total clients</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
