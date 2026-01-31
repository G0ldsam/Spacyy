'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
}

export default function SessionDetailPage() {
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchBooking()
    }
  }, [status, router, bookingId])

  const fetchBooking = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`)
      if (!response.ok) throw new Error('Failed to fetch booking')
      const data = await response.json()
      setBooking(data)
      
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
  }

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
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Loading...</p>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-700 mb-4">Booking not found</p>
          <Link href="/my-sessions">
            <Button>Back to My Sessions</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              Back to My Sessions
            </Link>
          </div>

          <Card className="shadow-sm">
            <CardHeader
              className="pb-4"
              style={{ backgroundColor: booking.serviceSession?.themeColor || '#8B1538' }}
            >
              <div className="text-white">
                <CardTitle className="text-2xl sm:text-3xl text-white mb-2">
                  {booking.serviceSession?.name || 'Session'}
                </CardTitle>
                <p className="text-white/90 text-sm sm:text-base">
                  {formatDate(booking.startTime)}
                </p>
                <p className="text-white/90 text-sm sm:text-base">
                  {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {booking.serviceSession?.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{booking.serviceSession.description}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleChangeBooking}
                  disabled={!canChangeBooking || booking.status === 'CANCELLED'}
                >
                  Change Booking
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setShowCancelModal(true)}
                  disabled={booking.status === 'CANCELLED'}
                >
                  Cancel
                </Button>
              </div>
              {changeRestrictionMessage && (
                <p className="text-sm text-red-600 mt-2">{changeRestrictionMessage}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cancel Booking</h2>
            <p className="text-gray-700 mb-6">
              This lesson can not be rescheduled. Are you sure you want to cancel?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                No, Keep Booking
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
