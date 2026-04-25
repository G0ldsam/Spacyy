'use client'

import { SessionProvider } from 'next-auth/react'
import { NavigationSpinner } from '@/components/ui/navigation-spinner'
import { PushSubscriptionProvider } from '@/contexts/PushSubscriptionContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <PushSubscriptionProvider>
        <NavigationSpinner />
        {children}
      </PushSubscriptionProvider>
    </SessionProvider>
  )
}
