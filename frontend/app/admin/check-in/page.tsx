'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Html5Qrcode } from 'html5-qrcode'
import { format } from 'date-fns'
import { useLanguage } from '@/contexts/LanguageContext'

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
  const { t } = useLanguage()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router])

  const startScanning = async () => {
    try {
      setError('')
      setSuccess('')
      setCheckInInfo(null)
      setScanning(true)

      // Check if we're in a secure context (HTTPS or localhost)
      const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!isSecure) {
        setError(t('check_in.error_https'))
        setScanning(false)
        return
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(t('check_in.error_api'))
        setScanning(false)
        return
      }

      // Check if camera is available
      let devices: any[] = []
      try {
        devices = await Html5Qrcode.getCameras()
      } catch (camError: any) {
        // If getCameras fails, try to start with default camera
        console.warn('Could not enumerate cameras, trying default:', camError)
      }

      if (devices.length === 0) {
        // Try to start with default camera constraints
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
        return
      }

      const scanner = new Html5Qrcode('qr-reader-checkin')
      scannerRef.current = scanner

      // Try to use back camera first, fallback to any available camera
      let cameraId: string | null = null
      const backCamera = devices.find((device: any) => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      )
      
      if (backCamera) {
        cameraId = backCamera.id
      } else if (devices.length > 0) {
        cameraId = devices[0].id
      }

      if (!cameraId) {
        setError(t('check_in.error_no_camera'))
        setScanning(false)
        return
      }

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: Math.min(250, window.innerWidth - 80), height: Math.min(250, window.innerWidth - 80) },
        },
        (decodedText) => {
          handleQRCodeScanned(decodedText)
        },
        (errorMessage) => {
          // Ignore scanning errors (these are usually just "no QR code found" messages)
        }
      )
    } catch (error: any) {
      console.error('Error starting scanner:', error)

      let errorMessage = t('check_in.error_start') + ' '

      if (error.name === 'NotAllowedError' || error.message?.includes('permission')) {
        errorMessage += t('check_in.error_denied')
      } else if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
        errorMessage += t('check_in.error_no_camera2')
      } else if (error.name === 'NotReadableError' || error.message?.includes('not readable')) {
        errorMessage += t('check_in.error_in_use')
      } else if (error.message?.includes('HTTPS') || error.message?.includes('secure')) {
        errorMessage += t('check_in.error_https2')
      } else {
        errorMessage += t('check_in.error_permissions')
      }

      setError(errorMessage)
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
          throw new Error(data.error || t('check_in.error_no_booking'))
        }
        
        const bookingData = await response.json()
        setCheckInInfo(bookingData)
      } else {
        setError(t('check_in.error_invalid_qr'))
      }
    } catch (error: any) {
      console.error('Error processing QR code:', error)
      setError(error.message || t('check_in.error_invalid_qr'))
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
              {t('check_in.back')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('check_in.title')}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              {t('check_in.subtitle')}
            </p>
          </div>

          <div className="space-y-6">
            {/* QR Scanner */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>{t('check_in.scan_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!scanning ? (
                    <Button onClick={startScanning} className="w-full">
                      {t('check_in.start')}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div id="qr-reader-checkin" className="w-full max-w-full overflow-hidden"></div>
                      <Button onClick={stopScanning} variant="outline" className="w-full">
                        {t('check_in.stop')}
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
                  <CardTitle>{t('check_in.info_title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('check_in.client_name')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">{checkInInfo.clientName}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('check_in.session')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">{checkInInfo.sessionName}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('check_in.time')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">
                          {format(new Date(checkInInfo.startTime), 'HH:mm')} -{' '}
                          {format(new Date(checkInInfo.endTime), 'HH:mm')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('check_in.date')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                          {format(new Date(checkInInfo.startTime), 'EEEE, MMMM d, yyyy')}
                        </p>
                      </div>
                      {checkInInfo.status === 'CHECKED_IN' && (
                        <div className="rounded-md bg-green-50 p-3 border border-green-200">
                          <p className="text-xs sm:text-sm text-green-800 font-semibold">{t('check_in.already_checked')}</p>
                        </div>
                      )}
                    </div>

                    {checkInInfo.status !== 'CHECKED_IN' && (
                      <Button
                        onClick={handleCheckIn}
                        className="w-full"
                        disabled={checkingIn}
                      >
                        {checkingIn ? t('check_in.checking_in') : t('check_in.check_in_btn')}
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
