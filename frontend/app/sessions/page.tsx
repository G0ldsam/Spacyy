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
      <style>{`
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(28px, -18px) scale(1.06); }
          66%       { transform: translate(-16px, 12px) scale(0.94); }
        }
        @keyframes orb-drift-reverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(-24px, 14px) scale(0.96); }
          66%       { transform: translate(20px, -10px) scale(1.04); }
        }
        @keyframes text-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      {/* Hero header */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #8B1538 0%, #5c0d26 45%, #1e0610 100%)' }}
      >
        {/* Floating orbs */}
        <div
          className="absolute -top-16 -left-10 w-80 h-80 rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #e91e8c 0%, transparent 70%)', animation: 'orb-drift 8s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-20 right-8 w-96 h-96 rounded-full blur-3xl opacity-35 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #ff6b6b 0%, transparent 70%)', animation: 'orb-drift-reverse 11s ease-in-out infinite' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-40 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #fff 0%, transparent 70%)' }}
        />

        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pt-8 sm:pb-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-white/60 hover:text-white text-sm mb-6 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white/90 border border-white/20 backdrop-blur-sm mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </span>

              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #fff 0%, #ffc0cb 40%, #fff 80%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'text-shimmer 5s linear infinite',
                }}
              >
                My Sessions
              </h1>
              <p className="text-white/55 mt-2 text-sm sm:text-base">
                Design, schedule and manage your classes
              </p>
            </div>

            <Link href="/sessions/new">
              <Button
                className="shrink-0 border border-white/30 text-white font-semibold px-5 py-2.5 backdrop-blur-sm transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                + Create Session
              </Button>
            </Link>
          </div>
        </div>

        {/* Bottom fade into page bg */}
        <div className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none"
             style={{ background: 'linear-gradient(to bottom, transparent, #f9fafb)' }} />
      </div>

      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-700">No sessions yet. Use &quot;Create Session&quot; above to get started.</p>
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
