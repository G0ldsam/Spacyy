'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { useLanguage } from '@/contexts/LanguageContext'

type CancellationPolicy = 'ALLOW_REFUND' | 'RESCHEDULE_ONLY' | 'FORFEIT_SLOT'

interface Booking {
  id: string
  serviceSession: {
    id: string
    name: string
    description: string | null
    themeColor: string
  } | null
  startTime: string
  endTime: string
  status: string
  organization?: {
    bookingChangeHours: number | null
    cancellationPolicy: CancellationPolicy
  }
}

export default function SessionDetailPage() {
  const { t } = useLanguage()
  const params = useParams()
  const router = useRouter()
  const { status } = useSession()
  const bookingId = params.id as string

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [canChangeBooking, setCanChangeBooking] = useState(true)
  const [changeRestrictionMessage, setChangeRestrictionMessage] = useState<string | null>(null)
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>('ALLOW_REFUND')

  const fetchBooking = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`)
      if (!response.ok) throw new Error('Failed to fetch booking')
      const data = await response.json()
      setBooking(data)
      
      // Set cancellation policy from org
      if (data.organization?.cancellationPolicy) {
        setCancellationPolicy(data.organization.cancellationPolicy)
      }

      // Check if booking can be changed based on policy
      if (data.organization?.bookingChangeHours !== null && data.organization?.bookingChangeHours !== undefined) {
        const now = new Date()
        const bookingStart = new Date(data.startTime)
        const hoursUntilBooking = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60)

        if (hoursUntilBooking < data.organization.bookingChangeHours) {
          setCanChangeBooking(false)
          setChangeRestrictionMessage(
            `Bookings can only be changed ${data.organization.bookingChangeHours} hours or more before the session starts.`
          )
        }
      }
    } catch (error) {
      console.error('Error fetching booking:', error)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchBooking()
    }
  }, [status, router, fetchBooking])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel booking')
      }

      router.push('/my-sessions')
      router.refresh()
    } catch (error: any) {
      alert(error.message || 'Failed to cancel booking')
    } finally {
      setCancelling(false)
      setShowCancelModal(false)
    }
  }

  const handleChangeBooking = () => {
    // Store the current booking ID in sessionStorage to track it
    sessionStorage.setItem('changingBookingId', bookingId)
    router.push('/book')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (status === 'loading' || loading) {
    return (
      <PageSpinner />
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-4">{t('booking_detail.not_found')}</p>
          <Link href="/my-sessions" className={buttonVariants('default', 'md')}>
            {t('booking_detail.back')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="mobile-container">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <Link href="/my-sessions" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
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
              {t('booking_detail.back')}
            </Link>
          </div>

          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="pb-5" style={{ background: 'var(--brand-hero-gradient)' }}>
              <CardTitle className="text-2xl sm:text-3xl text-white mb-2 leading-tight">
                {booking.serviceSession?.name || 'Session'}
              </CardTitle>
              <p className="text-white/80 text-sm sm:text-base">{formatDate(booking.startTime)}</p>
              <p className="text-white/80 text-sm sm:text-base font-medium">
                {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
              </p>
            </CardHeader>

            <CardContent className="pt-6">
              {booking.serviceSession?.description && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t('booking_detail.description')}
                  </p>
                  <p className="text-gray-700 text-sm leading-relaxed">{booking.serviceSession.description}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  size="md"
                  className="flex-1"
                  onClick={handleChangeBooking}
                  disabled={!canChangeBooking || booking.status === 'CANCELLED'}
                >
                  {cancellationPolicy === 'RESCHEDULE_ONLY'
                    ? t('booking_detail.reschedule')
                    : t('booking_detail.change_booking')}
                </Button>
                {cancellationPolicy !== 'RESCHEDULE_ONLY' && (
                  <Button
                    variant="default"
                    size="md"
                    className="flex-1"
                    onClick={() => setShowCancelModal(true)}
                    disabled={booking.status === 'CANCELLED'}
                  >
                    {t('booking_detail.cancel_booking')}
                  </Button>
                )}
              </div>
              {cancellationPolicy === 'RESCHEDULE_ONLY' && booking.status !== 'CANCELLED' && (
                <p className="text-sm text-amber-600 mt-3 bg-amber-50 rounded-xl px-4 py-3">
                  {t('booking_detail.reschedule_only_msg')}
                </p>
              )}
              {changeRestrictionMessage && (
                <p className="text-sm text-gray-500 mt-3 bg-gray-50 rounded-xl px-4 py-3">
                  {changeRestrictionMessage}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('booking_detail.cancel_booking')}</h2>
            <p className="text-gray-700 mb-4">
              {t('booking_detail.cancel_confirm')}
            </p>
            {cancellationPolicy === 'FORFEIT_SLOT' && (
              <div className="mb-4 rounded-xl bg-brand/8 border border-brand/20 px-4 py-3">
                <p className="text-sm font-semibold text-brand">
                  {t('booking_detail.forfeit_warning')}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                {t('booking_detail.keep')}
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('booking_detail.cancelling')}
                  </span>
                ) : t('booking_detail.yes_cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
