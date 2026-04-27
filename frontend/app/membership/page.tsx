'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import QRCode from 'qrcode'
import { useLanguage } from '@/contexts/LanguageContext'

interface ClientInfo {
  id: string
  name: string
  email: string
  sessionAllowance: number | null
}

export default function MembershipPage() {
  const { t } = useLanguage()
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

  const fetchActiveBookings = useCallback(async () => {
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
  }, [])

  const fetchClientInfo = useCallback(async () => {
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
  }, [fetchActiveBookings])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchClientInfo()
    }
  }, [status, router, fetchClientInfo])

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

  if (status === 'loading' || loading) {
    return (
      <PageSpinner />
    )
  }

  if (!clientInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">{t('membership.load_error')}</p>
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
              {t('membership.back')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('membership.title')}</h1>
          </div>

          <div className="space-y-6">
            {/* QR Code */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-center">{t('membership.qr_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  {qrCodeDataUrl ? (
                    <Image 
                      src={qrCodeDataUrl} 
                      alt="Membership QR Code" 
                      width={320}
                      height={320}
                      className="w-full max-w-[280px] h-auto sm:max-w-[320px]" 
                    />
                  ) : (
                    <div className="w-full max-w-[280px] aspect-square bg-gray-200 rounded flex items-center justify-center sm:max-w-[320px]">
                      <p className="text-gray-500 text-sm px-4 text-center">{t('membership.generating')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Membership Info Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>{t('membership.info_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-[#8B1538] to-[#722F37] rounded-lg p-4 sm:p-6 text-white">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs sm:text-sm opacity-90">{t('membership.member_since')}</p>
                        <p className="text-base sm:text-lg font-semibold break-words">
                          {new Date(clientInfo.id.substring(0, 8)).getFullYear() || new Date().getFullYear()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm opacity-90">{t('membership.name')}</p>
                        <p className="text-base sm:text-lg font-semibold break-words">{clientInfo.name}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm opacity-90">{t('membership.email')}</p>
                        <p className="text-base sm:text-lg font-semibold break-words break-all">{clientInfo.email}</p>
                      </div>
                      <div className="pt-3 border-t border-white/20">
                        <p className="text-xs sm:text-sm opacity-90">{t('membership.total_sessions')}</p>
                        <p className="text-xl sm:text-2xl font-bold">{activeBookings}</p>
                      </div>
                      {clientInfo.sessionAllowance !== null && (
                        <div className="pt-3 border-t border-white/20">
                          <p className="text-xs sm:text-sm opacity-90">{t('membership.available_sessions')}</p>
                          <p className="text-xl sm:text-2xl font-bold">
                            {availableSessions !== null ? availableSessions : t('membership.unlimited')}
                          </p>
                        </div>
                      )}
                      {expirationWarning.show && (
                        <div className="pt-3 border-t border-white/20">
                          <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-3">
                            <p className="text-xs sm:text-sm font-semibold text-yellow-100 mb-1">
                              {t('membership.expiring_title')}
                            </p>
                            <p className="text-xs text-yellow-100/90">
                              {t('membership.expiring_desc', {
                                date: expirationWarning.lastBookingDate?.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                }) ?? ''
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                      {clientInfo.sessionAllowance === null && (
                        <div className="pt-3 border-t border-white/20">
                          <p className="text-xs sm:text-sm opacity-90">{t('membership.session_allowance')}</p>
                          <p className="text-xl sm:text-2xl font-bold">{t('membership.unlimited')}</p>
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
