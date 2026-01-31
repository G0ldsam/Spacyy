'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Html5Qrcode } from 'html5-qrcode'
import { format } from 'date-fns'

interface CheckInInfo {
  clientId: string
  clientName: string
  clientEmail: string
  bookingId: string
  sessionName: string
  startTime: string
  endTime: string
  status: string
}

export default function CheckInPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [checkInInfo, setCheckInInfo] = useState<CheckInInfo | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)

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
      setLoading(false)
    }
  }, [status, session, router])

  const startScanning = async () => {
    try {
      setError('')
      setSuccess('')
      setCheckInInfo(null)
      setScanning(true)

      const scanner = new Html5Qrcode('qr-reader-checkin')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: Math.min(250, window.innerWidth - 80), height: Math.min(250, window.innerWidth - 80) },
        },
        (decodedText) => {
          handleQRCodeScanned(decodedText)
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      )
    } catch (error: any) {
      console.error('Error starting scanner:', error)
      setError('Failed to start camera. Please ensure camera permissions are granted.')
      setScanning(false)
    }
  }

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current?.clear()
        scannerRef.current = null
        setScanning(false)
      }).catch((err) => {
        console.error('Error stopping scanner:', err)
        setScanning(false)
      })
    }
  }

  const handleQRCodeScanned = async (qrData: string) => {
    try {
      const parsed = JSON.parse(qrData)
      if (parsed.type === 'membership' && parsed.clientId) {
        stopScanning()
        
        // Fetch client's upcoming booking for today
        const response = await fetch(`/api/admin/check-in/client/${parsed.clientId}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'No booking found for today')
        }
        
        const bookingData = await response.json()
        setCheckInInfo(bookingData)
      } else {
        setError('Invalid QR code. Please scan a membership QR code.')
      }
    } catch (error: any) {
      console.error('Error processing QR code:', error)
      setError(error.message || 'Invalid QR code format. Please try again.')
    }
  }

  const handleCheckIn = async () => {
    if (!checkInInfo) return

    setCheckingIn(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/admin/check-in/booking/${checkInInfo.bookingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to check in')
      }

      setSuccess('Client checked in successfully!')
      setTimeout(() => {
        setCheckInInfo(null)
        setSuccess('')
      }, 2000)
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setCheckingIn(false)
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Check-In</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              Scan a member's QR code to check them in for their session
            </p>
          </div>

          <div className="space-y-6">
            {/* QR Scanner */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Scan Membership QR Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!scanning ? (
                    <Button onClick={startScanning} className="w-full">
                      Start Scanning
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div id="qr-reader-checkin" className="w-full max-w-full overflow-hidden"></div>
                      <Button onClick={stopScanning} variant="outline" className="w-full">
                        Stop Scanning
                      </Button>
                    </div>
                  )}

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
                </div>
              </CardContent>
            </Card>

            {/* Check-In Info */}
            {checkInInfo && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Check-In Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Client Name</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">{checkInInfo.clientName}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Session</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">{checkInInfo.sessionName}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Time</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">
                          {format(new Date(checkInInfo.startTime), 'HH:mm')} -{' '}
                          {format(new Date(checkInInfo.endTime), 'HH:mm')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Date</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                          {format(new Date(checkInInfo.startTime), 'EEEE, MMMM d, yyyy')}
                        </p>
                      </div>
                      {checkInInfo.status === 'CHECKED_IN' && (
                        <div className="rounded-md bg-green-50 p-3 border border-green-200">
                          <p className="text-xs sm:text-sm text-green-800 font-semibold">Already Checked In</p>
                        </div>
                      )}
                    </div>

                    {checkInInfo.status !== 'CHECKED_IN' && (
                      <Button
                        onClick={handleCheckIn}
                        className="w-full"
                        disabled={checkingIn}
                      >
                        {checkingIn ? 'Checking In...' : 'Check In'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
