'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import QRCode from 'qrcode'

interface ClientInfo {
  id: string
  name: string
  email: string
  sessionAllowance: number | null
}

export default function MembershipPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [activeBookings, setActiveBookings] = useState(0)
  const [expirationWarning, setExpirationWarning] = useState<{
    show: boolean
    lastBookingDate: Date | null
  }>({ show: false, lastBookingDate: null })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchClientInfo()
    }
  }, [status, router])

  // Check for expiration warning when both clientInfo and activeBookings are available
  useEffect(() => {
    if (clientInfo && clientInfo.sessionAllowance !== null && activeBookings > 0) {
      // If all sessions are used, check if last booking is expiring soon
      if (activeBookings >= clientInfo.sessionAllowance) {
        // Fetch bookings to find the last one
        fetch('/api/bookings/my')
          .then(res => res.json())
          .then((data: any[]) => {
            const now = new Date()
            const active = data.filter((b: any) => {
              if (b.status === 'CANCELLED') return false
              const endTime = new Date(b.endTime)
              return endTime >= now
            })
            
            if (active.length > 0) {
              // Find the last booking (furthest in the future)
              const sortedBookings = active.sort((a: any, b: any) => 
                new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
              )
              const lastBooking = sortedBookings[0]
              const lastBookingEnd = new Date(lastBooking.endTime)
              
              // Check if last booking ends within 1 day
              const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
              if (lastBookingEnd <= oneDayFromNow) {
                setExpirationWarning({
                  show: true,
                  lastBookingDate: lastBookingEnd,
                })
              } else {
                setExpirationWarning({ show: false, lastBookingDate: null })
              }
            } else {
              setExpirationWarning({ show: false, lastBookingDate: null })
            }
          })
          .catch(() => {
            setExpirationWarning({ show: false, lastBookingDate: null })
          })
      } else {
        setExpirationWarning({ show: false, lastBookingDate: null })
      }
    } else {
      setExpirationWarning({ show: false, lastBookingDate: null })
    }
  }, [clientInfo, activeBookings])

  const fetchClientInfo = async () => {
    try {
      const response = await fetch('/api/clients/me')
      if (response.ok) {
        const data = await response.json()
        setClientInfo(data)
        
        // Generate QR code with client ID
        const qrData = JSON.stringify({
          type: 'membership',
          clientId: data.id,
          timestamp: Date.now(),
        })
        const qrCode = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#8B1538',
            light: '#FFFFFF',
          },
        })
        setQrCodeDataUrl(qrCode)
        
        // Fetch bookings after client info is loaded
        await fetchActiveBookings()
      }
    } catch (error) {
      console.error('Error fetching client info:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveBookings = async () => {
    try {
      const response = await fetch('/api/bookings/my')
      if (response.ok) {
        const data = await response.json()
        const now = new Date()
        // Filter out cancelled bookings and past bookings (where endTime is before now)
        const active = data.filter((b: any) => {
          if (b.status === 'CANCELLED') return false
          const endTime = new Date(b.endTime)
          return endTime >= now
        })
        setActiveBookings(active.length)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Loading...</p>
      </div>
    )
  }

  if (!clientInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Unable to load membership information</p>
      </div>
    )
  }

  const availableSessions = clientInfo.sessionAllowance !== null
    ? Math.max(0, clientInfo.sessionAllowance - activeBookings)
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <Link href="/home" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
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
              Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Member Card</h1>
          </div>

          <div className="space-y-6">
            {/* QR Code */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-center">Membership QR Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Membership QR Code" 
                      className="w-full max-w-[280px] h-auto sm:max-w-[320px]" 
                    />
                  ) : (
                    <div className="w-full max-w-[280px] aspect-square bg-gray-200 rounded flex items-center justify-center sm:max-w-[320px]">
                      <p className="text-gray-500 text-sm px-4 text-center">Generating QR code...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Membership Info Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Membership Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-[#8B1538] to-[#722F37] rounded-lg p-4 sm:p-6 text-white">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs sm:text-sm opacity-90">Member Since</p>
                        <p className="text-base sm:text-lg font-semibold break-words">
                          {new Date(clientInfo.id.substring(0, 8)).getFullYear() || new Date().getFullYear()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm opacity-90">Name</p>
                        <p className="text-base sm:text-lg font-semibold break-words">{clientInfo.name}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm opacity-90">Email</p>
                        <p className="text-base sm:text-lg font-semibold break-words break-all">{clientInfo.email}</p>
                      </div>
                      <div className="pt-3 border-t border-white/20">
                        <p className="text-xs sm:text-sm opacity-90">Total Sessions Booked</p>
                        <p className="text-xl sm:text-2xl font-bold">{activeBookings}</p>
                      </div>
                      {clientInfo.sessionAllowance !== null && (
                        <div className="pt-3 border-t border-white/20">
                          <p className="text-xs sm:text-sm opacity-90">Available Sessions</p>
                          <p className="text-xl sm:text-2xl font-bold">
                            {availableSessions !== null ? availableSessions : 'Unlimited'}
                          </p>
                        </div>
                      )}
                      {expirationWarning.show && (
                        <div className="pt-3 border-t border-white/20">
                          <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-3">
                            <p className="text-xs sm:text-sm font-semibold text-yellow-100 mb-1">
                              ⚠️ Membership Expiring
                            </p>
                            <p className="text-xs text-yellow-100/90">
                              Your last session ends {expirationWarning.lastBookingDate?.toLocaleDateString('en-US', { 
                                weekday: 'short',
                                month: 'short', 
                                day: 'numeric' 
                              })}. Please renew to continue booking.
                            </p>
                          </div>
                        </div>
                      )}
                      {clientInfo.sessionAllowance === null && (
                        <div className="pt-3 border-t border-white/20">
                          <p className="text-xs sm:text-sm opacity-90">Session Allowance</p>
                          <p className="text-xl sm:text-2xl font-bold">Unlimited</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
