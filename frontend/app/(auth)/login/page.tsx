'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/contexts/LanguageContext'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (globalThis.window !== undefined) {
      const params = new URLSearchParams(globalThis.location.search)
      const emailParam = params.get('email')
      const passwordParam = params.get('password')
      if (emailParam) setEmail(emailParam)
      if (passwordParam) setPassword(passwordParam)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t('login.error_invalid'))
      } else if (result?.ok) {
        const session = await getSession()
        const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'

        if ((session?.user as any)?.mustChangePassword) {
          router.push('/change-password')
          return
        }

        const adminOrg = session?.user?.organizations?.find(
          (org) => org.role === 'OWNER' || org.role === 'ADMIN'
        )

        if (adminOrg?.organization?.slug && typeof window !== 'undefined') {
          const currentHost = window.location.hostname
          const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1'
          const targetHost = `${adminOrg.organization.slug}.${mainDomain}`
          if (!isLocalhost && currentHost === mainDomain) {
            window.location.href = `${window.location.protocol}//${targetHost}/dashboard`
            return
          }
        }

        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError(t('login.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 mobile-container">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl">{t('login.title')}</CardTitle>
          <CardDescription className="text-base">{t('login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-900">
                {t('login.email_label')}
              </label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-900">
                {t('login.password_label')}
              </label>
              <Input
                id="password"
                type="password"
                inputMode="text"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
