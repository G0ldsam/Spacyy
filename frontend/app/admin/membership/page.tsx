'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Html5Qrcode } from 'html5-qrcode'
import { useLanguage } from '@/contexts/LanguageContext'

interface ScannedClient {
  id: string
  name: string
  email: string
  sessionAllowance: number | null
  activeBookings: number
  pendingSlotsUsed: number
}

export default function MembershipManagementPage() {
  const { t } = useLanguage()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scannedClient, setScannedClient] = useState<ScannedClient | null>(null)
  const [sessionsToAdd, setSessionsToAdd] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scanAreaRef = useRef<HTMLDivElement>(null)

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
      setScanning(true)
      setScannedClient(null)

      // Check if we're in a secure context (HTTPS or localhost)
      const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!isSecure) {
        setError(t('membership_mgmt.error_https'))
        setScanning(false)
        return
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(t('membership_mgmt.error_api'))
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
        const scanner = new Html5Qrcode('qr-reader')
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

      const scanner = new Html5Qrcode('qr-reader')
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
        setError(t('membership_mgmt.error_no_camera'))
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

      let errorMessage = ''

      if (error.name === 'NotAllowedError' || error.message?.includes('permission')) {
        errorMessage = t('check_in.error_denied')
      } else if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
        errorMessage = t('check_in.error_no_camera2')
      } else if (error.name === 'NotReadableError' || error.message?.includes('not readable')) {
        errorMessage = t('check_in.error_in_use')
      } else if (error.message?.includes('HTTPS') || error.message?.includes('secure')) {
        errorMessage = t('check_in.error_https2')
      } else {
        errorMessage = t('check_in.error_permissions')
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
        
        // Fetch client information
        const response = await fetch(`/api/admin/clients/${parsed.clientId}`)
        if (!response.ok) {
          throw new Error(t('membership_mgmt.error_not_found'))
        }
        
        const clientData = await response.json()
        setScannedClient(clientData)
        setSessionsToAdd('')
      } else {
        setError(t('membership_mgmt.error_invalid_qr'))
      }
    } catch (error: any) {
      console.error('Error processing QR code:', error)
      setError(t('membership_mgmt.error_invalid_qr'))
    }
  }

  const handleRenewMembership = async () => {
    if (!scannedClient) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const sessionsToAddNum = parseInt(sessionsToAdd)
      if (isNaN(sessionsToAddNum) || sessionsToAddNum <= 0) {
        throw new Error('Please enter a positive number of sessions to add')
      }

      const response = await fetch(`/api/admin/clients/${scannedClient.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionsToAdd: sessionsToAddNum,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('membership_mgmt.error_renew'))
      }

      const updated = await response.json()
      setScannedClient({
        ...scannedClient,
        sessionAllowance: updated.sessionAllowance,
        pendingSlotsUsed: 0,
      })
      setSuccess(`Successfully added ${sessionsToAddNum} session(s)! New total: ${updated.sessionAllowance || 'Unlimited'}`)
      setTimeout(() => {
        setScannedClient(null)
        setSessionsToAdd('')
        setSuccess('')
      }, 3000)
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setSaving(false)
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
              {t('membership_mgmt.back')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('membership_mgmt.title')}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              {t('membership_mgmt.subtitle')}
            </p>
          </div>

          <div className="space-y-6">
            {/* QR Scanner */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>{t('membership_mgmt.scan_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!scanning ? (
                    <Button onClick={startScanning} className="w-full">
                      {t('membership_mgmt.start')}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div id="qr-reader" className="w-full max-w-full overflow-hidden" ref={scanAreaRef}></div>
                      <Button onClick={stopScanning} variant="outline" className="w-full">
                        {t('membership_mgmt.stop')}
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

            {/* Client Info and Renewal Form */}
            {scannedClient && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>{t('membership_mgmt.renew')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {scannedClient.pendingSlotsUsed > 0 && (
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-amber-800">
                            {t(scannedClient.pendingSlotsUsed === 1 ? 'membership_mgmt.pending_slots_one' : 'membership_mgmt.pending_slots_other', { count: scannedClient.pendingSlotsUsed })}
                          </p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            {t(scannedClient.pendingSlotsUsed === 1 ? 'membership_mgmt.pending_desc_one' : 'membership_mgmt.pending_desc_other', { count: scannedClient.pendingSlotsUsed })}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('membership_mgmt.name')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">{scannedClient.name}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('membership_mgmt.email')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words break-all">{scannedClient.email}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('membership_mgmt.current_allowance')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">
                          {scannedClient.sessionAllowance !== null
                            ? t('membership_mgmt.sessions_count', { count: scannedClient.sessionAllowance })
                            : t('membership_mgmt.unlimited')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('membership_mgmt.active_bookings')}</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">{scannedClient.activeBookings}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="sessionsToAdd" className="text-sm font-medium text-gray-900">
                        {t('membership_mgmt.sessions_to_add')}
                      </label>
                      <Input
                        id="sessionsToAdd"
                        type="number"
                        min="1"
                        placeholder={t('membership_mgmt.sessions_placeholder')}
                        value={sessionsToAdd}
                        onChange={(e) => setSessionsToAdd(e.target.value)}
                        className="h-12 text-base"
                      />
                      <p className="text-xs text-gray-600">
                        {t('membership_mgmt.sessions_hint', {
                          current: scannedClient.sessionAllowance !== null
                            ? t('membership_mgmt.sessions_count', { count: scannedClient.sessionAllowance })
                            : t('membership_mgmt.unlimited')
                        })}
                      </p>
                      {scannedClient.sessionAllowance !== null && sessionsToAdd && !isNaN(parseInt(sessionsToAdd)) && (
                        <p className="text-sm font-semibold text-[#8B1538]">
                          {t('membership_mgmt.new_total', { count: scannedClient.sessionAllowance + parseInt(sessionsToAdd) })}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={handleRenewMembership}
                      className="w-full"
                      disabled={saving}
                    >
                      {saving ? t('membership_mgmt.submitting') : t('membership_mgmt.renew')}
                    </Button>
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
