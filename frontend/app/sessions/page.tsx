'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SessionCard } from '@/components/sessions/SessionCard'
import { useLanguage } from '@/contexts/LanguageContext'

export default function SessionsPage() {
  const { t } = useLanguage()
  const { data: authSession, status } = useSession()
  const router = useRouter()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      const userOrg = authSession?.user?.organizations?.find(
        (org) => org.role === 'OWNER' || org.role === 'ADMIN'
      )
      if (!userOrg) {
        router.push('/book')
        return
      }
      fetchSessions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      if (!response.ok) throw new Error('Failed to fetch sessions')
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return <PageSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <Link href="/dashboard" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {t('sessions.back')}
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('sessions.title')}</h1>
                <p className="text-gray-800 mt-2 text-sm sm:text-base">
                  {t('sessions.subtitle')}
                </p>
              </div>
              <Link href="/sessions/new">
                <Button className="w-full sm:w-auto">
                  {t('sessions.create')}
                </Button>
              </Link>
            </div>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-700">{t('sessions.no_sessions')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((sessionItem) => (
                <SessionCard key={sessionItem.id} session={sessionItem} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
