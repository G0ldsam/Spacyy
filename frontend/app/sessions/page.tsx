import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SessionCard } from '@/components/sessions/SessionCard'

export default async function SessionsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Check if user is an owner/admin
  const userOrg = session.user.organizations?.find(
    (org) => org.role === 'OWNER' || org.role === 'ADMIN'
  )

  if (!userOrg) {
    redirect('/book')
  }

  // Get all sessions for this organization
  const sessions = await prisma.serviceSession.findMany({
    where: {
      organizationId: userOrg.organization.id,
    },
    include: {
      timetable: {
        orderBy: [
          { dayOfWeek: 'asc' },
          { startTime: 'asc' },
        ],
      },
      _count: {
        select: {
          bookings: true,
          timetable: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <Link href="/dashboard" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Sessions</h1>
                <p className="text-gray-800 mt-2 text-sm sm:text-base">
                  Manage your service sessions
                </p>
              </div>
              <Link href="/sessions/new">
                <Button className="w-full sm:w-auto">
                  Create Session
                </Button>
              </Link>
            </div>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-700">No sessions yet. Click "Create Session" above to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((sessionItem) => (
                <SessionCard key={sessionItem.id} session={sessionItem} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
