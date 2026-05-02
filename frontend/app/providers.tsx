'use client'

import { useEffect } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NavigationSpinner } from '@/components/ui/navigation-spinner'
import { PushSubscriptionProvider } from '@/contexts/PushSubscriptionContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { queryClient } from '@/lib/queryClient'

function DataPrefetcher() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session) return
    queryClient.prefetchQuery({ queryKey: ['sessions'], queryFn: () => fetch('/api/sessions').then(r => r.json()) })
    queryClient.prefetchQuery({ queryKey: ['clients'], queryFn: () => fetch('/api/clients').then(r => r.json()) })
    queryClient.prefetchQuery({ queryKey: ['dashboard-stats'], queryFn: () => fetch('/api/dashboard/stats').then(r => r.json()) })
  }, [session])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
          <DataPrefetcher />
          <PushSubscriptionProvider>
            <NavigationSpinner />
            {children}
          </PushSubscriptionProvider>
        </SessionProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
