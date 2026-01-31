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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchClientInfo()
      fetchActiveBookings()
    }
  }, [status, router])

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
        const active = data.filter((b: any) => b.status !== 'CANCELLED').length
        setActiveBookings(active)
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
