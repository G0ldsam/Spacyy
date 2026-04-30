'use client'

import { SessionProvider } from 'next-auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NavigationSpinner } from '@/components/ui/navigation-spinner'
import { PushSubscriptionProvider } from '@/contexts/PushSubscriptionContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { queryClient } from '@/lib/queryClient'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
          <PushSubscriptionProvider>
            <NavigationSpinner />
            {children}
          </PushSubscriptionProvider>
        </SessionProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
