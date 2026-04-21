'use client'

import { SessionProvider } from 'next-auth/react'
import NextTopLoader from 'nextjs-toploader'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NextTopLoader color="#8B1538" height={3} showSpinner={false} shadow="0 0 10px #8B153880" />
      {children}
    </SessionProvider>
  )
}
