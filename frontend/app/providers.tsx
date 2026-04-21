'use client'

import { SessionProvider } from 'next-auth/react'
import { NavigationSpinner } from '@/components/ui/navigation-spinner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NavigationSpinner />
      {children}
    </SessionProvider>
  )
}
