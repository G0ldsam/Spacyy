'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PolicySettings {
  bookingChangeHours: number | null
  requireMembershipForBooking: boolean
}

export default function PolicyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [settings, setSettings] = useState<PolicySettings>({
    bookingChangeHours: null,
    requireMembershipForBooking: false,
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
  }, [status, session, router])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/organization/policy')
      if (!response.ok) throw new Error('Failed to fetch settings')
      const data = await response.json()
      setSettings({
        bookingChangeHours: data.bookingChangeHours,
        requireMembershipForBooking: data.requireMembershipForBooking || false,
      })
    } catch (error) {
      console.error('Error fetching settings:', error)
      setError('Failed to load settings')
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
          requireMembershipForBooking: settings.requireMembershipForBooking,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings')
      }

      setSuccess('Settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Loading...</p>
      </div>
    )
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
              Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Policy Settings</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              Configure booking policies and rules
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Booking Policies</CardTitle>
              <CardDescription>
                Set rules for booking changes and membership requirements
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
                      Hours Before Booking to Allow Changes
                    </label>
                    <Input
                      id="bookingChangeHours"
                      type="number"
                      min="0"
                      placeholder="Leave empty for no restriction"
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
                      Clients can only change bookings if there are at least this many hours before the session starts. Leave empty to allow changes at any time.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="requireMembershipForBooking"
                        checked={settings.requireMembershipForBooking}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            requireMembershipForBooking: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-[#8B1538] focus:ring-[#8B1538] border-gray-300 rounded"
                      />
                      <label htmlFor="requireMembershipForBooking" className="text-sm font-medium text-gray-900">
                        Require Available Session Slots to Book
                      </label>
                    </div>
                    <p className="text-xs text-gray-600 ml-6">
                      If enabled, clients must have available session slots (based on their membership) to make new bookings. Clients without available slots will not be able to book.
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
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
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
