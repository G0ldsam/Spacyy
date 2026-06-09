'use client'

import { cn } from '@/lib/utils'
import { useAdminInterestList } from '@/hooks/useBookingsData'

type AdminView = 'home' | 'bookings' | 'sessions' | 'clients' | 'waitlist'

interface Props {
  readonly activeView: AdminView
  readonly onNavigate: (view: AdminView) => void
}

const tabs: { view: AdminView; label: string; icon: React.ReactNode }[] = [
  {
    view: 'home',
    label: 'Home',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    view: 'bookings',
    label: 'Bookings',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    view: 'sessions',
    label: 'Sessions',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    view: 'waitlist',
    label: 'Waitlist',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    view: 'clients',
    label: 'Clients',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function AdminBottomNav({ activeView, onNavigate }: Props) {
  const { data: waitlistGroups = [] } = useAdminInterestList()
  const unnotifiedCount = waitlistGroups.reduce((sum, g) => sum + g.unnotifiedCount, 0)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = activeView === tab.view
          const showBadge = tab.view === 'waitlist' && unnotifiedCount > 0
          return (
            <button
              key={tab.view}
              onClick={() => onNavigate(tab.view)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full min-w-0 px-2 transition-colors duration-200 relative',
                isActive ? 'text-brand' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <div className="relative">
                {tab.icon}
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                    {unnotifiedCount > 9 ? '9+' : unnotifiedCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium mt-1 truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
