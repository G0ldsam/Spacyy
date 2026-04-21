import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'

const tenantFavicons: Record<string, string> = {
  'bodyglowpilates': '/favicon-bodyglow.ico',
}

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host') || ''
  const subdomain = host.split('.')[0]
  const favicon = tenantFavicons[subdomain] ?? '/favicon.ico'

  return {
    title: 'Spacyy - Booking & Resource Management',
    description: 'Universal booking and resource management platform',
    manifest: '/manifest.json',
    icons: { icon: favicon, shortcut: favicon },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Spacyy',
    },
    formatDetection: {
      telephone: false,
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
  viewportFit: 'cover', // For iOS notch support
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Spacyy" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
