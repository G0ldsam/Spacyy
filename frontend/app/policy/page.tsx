'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/contexts/LanguageContext'

type CancellationPolicy = 'ALLOW_REFUND' | 'RESCHEDULE_ONLY' | 'FORFEIT_SLOT'

interface PolicySettings {
  bookingChangeHours: number | null
  allowPendingSlot: boolean
  cancellationPolicy: CancellationPolicy
}

export default function PolicyPage() {
  const { t } = useLanguage()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [settings, setSettings] = useState<PolicySettings>({
    bookingChangeHours: null,
    allowPendingSlot: false,
    cancellationPolicy: 'ALLOW_REFUND',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      // Check if user is admin/owner
      const userOrg = session?.user?.organizations?.find(
        (org) => org.role === 'OWNER' || org.role === 'ADMIN'
      )
      if (!userOrg) {
        router.push('/dashboard')
        return
      }
      fetchSettings()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/organization/policy')
      if (!response.ok) throw new Error('Failed to fetch settings')
      const data = await response.json()
      setSettings({
        bookingChangeHours: data.bookingChangeHours,
        allowPendingSlot: data.allowPendingSlot || false,
        cancellationPolicy: data.cancellationPolicy || 'ALLOW_REFUND',
      })
    } catch (error) {
      console.error('Error fetching settings:', error)
      setError(t('policy.error_load'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const response = await fetch('/api/organization/policy', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingChangeHours: settings.bookingChangeHours === null || settings.bookingChangeHours === 0
            ? null
            : settings.bookingChangeHours,
          allowPendingSlot: settings.allowPendingSlot,
          cancellationPolicy: settings.cancellationPolicy,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('policy.error_save'))
      }

      setSuccess(t('policy.saved'))
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return <PageSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
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
              {t('policy.back')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('policy.title')}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              {t('policy.subtitle')}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('policy.section_title')}</CardTitle>
              <CardDescription>
                {t('policy.section_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
                    {success}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="bookingChangeHours" className="text-sm font-medium text-gray-900">
                      {t('policy.hours_label')}
                    </label>
                    <Input
                      id="bookingChangeHours"
                      type="number"
                      min="0"
                      placeholder={t('policy.hours_placeholder')}
                      value={settings.bookingChangeHours || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setSettings({
                          ...settings,
                          bookingChangeHours: value === '' ? null : parseInt(value) || 0,
                        })
                      }}
                      className="h-12 text-base"
                    />
                    <p className="text-xs text-gray-600">
                      {t('policy.hours_hint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">
                      {t('policy.cancellation_label')}
                    </p>
                    <div className="space-y-2 pt-1">
                      {(
                        [
                          { value: 'ALLOW_REFUND',    label: t('policy.cancellation_allow_refund_label'),    hint: t('policy.cancellation_allow_refund_hint') },
                          { value: 'RESCHEDULE_ONLY', label: t('policy.cancellation_reschedule_only_label'), hint: t('policy.cancellation_reschedule_only_hint') },
                          { value: 'FORFEIT_SLOT',    label: t('policy.cancellation_forfeit_label'),         hint: t('policy.cancellation_forfeit_hint') },
                        ] as { value: CancellationPolicy; label: string; hint: string }[]
                      ).map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            settings.cancellationPolicy === opt.value
                              ? 'border-[#8B1538] bg-[#8B1538]/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="cancellationPolicy"
                            value={opt.value}
                            checked={settings.cancellationPolicy === opt.value}
                            onChange={() => setSettings({ ...settings, cancellationPolicy: opt.value })}
                            className="mt-0.5 h-4 w-4 text-[#8B1538] focus:ring-[#8B1538] border-gray-300"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="allowPendingSlot"
                        checked={settings.allowPendingSlot}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            allowPendingSlot: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-[#8B1538] focus:ring-[#8B1538] border-gray-300 rounded"
                      />
                      <label htmlFor="allowPendingSlot" className="text-sm font-medium text-gray-900">
                        {t('policy.pending_label')}
                      </label>
                    </div>
                    <p className="text-xs text-gray-600 ml-6">
                      {t('policy.pending_hint')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    {t('policy.cancel')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? t('policy.saving') : t('policy.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
