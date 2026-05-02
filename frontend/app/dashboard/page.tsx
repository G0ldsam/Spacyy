'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import AdminBottomNav from '@/components/AdminBottomNav'
import DashboardHomeView from '@/components/views/DashboardHomeView'
import BookingsView from '@/components/views/BookingsView'
import SessionsView from '@/components/views/SessionsView'
import ClientsView from '@/components/views/ClientsView'

type AdminView = 'home' | 'bookings' | 'sessions' | 'clients'

export default function AdminShell() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeView, setActiveView] = useState<AdminView>('home')
  const [mountedViews, setMountedViews] = useState<Set<AdminView>>(new Set(['home']))

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      const userOrg = session?.user?.organizations?.find(
        (org) => org.role === 'OWNER' || org.role === 'ADMIN'
      )
      if (!userOrg) {
        router.push('/home')
      }
    }
  }, [status, session, router])

  const navigate = (view: AdminView) => {
    setMountedViews((prev) => new Set([...prev, view]))
    setActiveView(view)
  }

  if (status === 'loading') return <PageSpinner />

  return (
    <div className="pb-16">
      <div style={{ display: activeView === 'home' ? 'block' : 'none' }}>
        {mountedViews.has('home') && (
          <DashboardHomeView
            userName={session?.user?.name}
            userEmail={session?.user?.email}
            onNavigate={navigate}
          />
        )}
      </div>
      <div style={{ display: activeView === 'bookings' ? 'block' : 'none' }}>
        {mountedViews.has('bookings') && <BookingsView onBack={() => navigate('home')} />}
      </div>
      <div style={{ display: activeView === 'sessions' ? 'block' : 'none' }}>
        {mountedViews.has('sessions') && <SessionsView onBack={() => navigate('home')} />}
      </div>
      <div style={{ display: activeView === 'clients' ? 'block' : 'none' }}>
        {mountedViews.has('clients') && <ClientsView onBack={() => navigate('home')} />}
      </div>
      <AdminBottomNav activeView={activeView} onNavigate={navigate} />
    </div>
  )
}
