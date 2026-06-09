import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { getTenantContext } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { deriveTokens, tokensToCssVars, DEFAULT_BRAND } from '@/shared/lib/brandColors'

export const metadata: Metadata = {
  title: 'Spacyy - Booking & Resource Management',
  description: 'Universal booking and resource management platform',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Spacyy',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
  viewportFit: 'cover', // For iOS notch support
}

async function getBrandCssVars(): Promise<string> {
  try {
    const tenant = await getTenantContext()
    if (!tenant) return tokensToCssVars(deriveTokens(DEFAULT_BRAND))
    const org = await prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { brandPrimary: true, brandSecondary: true, brandAccent: true, brandSurface: true },
    })
    const tokens = deriveTokens({
      primary:   org?.brandPrimary   ?? DEFAULT_BRAND.primary,
      secondary: org?.brandSecondary ?? DEFAULT_BRAND.secondary,
      accent:    org?.brandAccent    ?? DEFAULT_BRAND.accent,
      surface:   org?.brandSurface   ?? undefined,
    })
    return tokensToCssVars(tokens)
  } catch {
    return tokensToCssVars(deriveTokens(DEFAULT_BRAND))
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const brandCssVars = await getBrandCssVars()

  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Spacyy" />
        <style dangerouslySetInnerHTML={{ __html: `:root { ${brandCssVars} }` }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
