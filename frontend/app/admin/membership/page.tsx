'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Html5Qrcode } from 'html5-qrcode'

interface ScannedClient {
  id: string
  name: string
  email: string
  sessionAllowance: number | null
  activeBookings: number
}

export default function MembershipManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scannedClient, setScannedClient] = useState<ScannedClient | null>(null)
  const [sessionAllowance, setSessionAllowance] = useState<string>('')
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
  }, [status, session, router])

  const startScanning = async () => {
    try {
      setError('')
      setScanning(true)
      setScannedClient(null)

      // Check if we're in a secure context (HTTPS or localhost)
      const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!isSecure) {
        setError('Camera access requires HTTPS. Please use a secure connection or localhost.')
        setScanning(false)
        return
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API is not available in this browser. Please use a modern browser that supports camera access.')
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
      } else {
        cameraId = devices[0].id
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
      
      let errorMessage = 'Failed to start camera. '
      
      if (error.name === 'NotAllowedError' || error.message?.includes('permission')) {
        errorMessage += 'Camera permission denied. Please allow camera access in your browser settings and try again.'
      } else if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
        errorMessage += 'No camera found. Please connect a camera device.'
      } else if (error.name === 'NotReadableError' || error.message?.includes('not readable')) {
        errorMessage += 'Camera is already in use by another application. Please close other apps using the camera.'
      } else if (error.message?.includes('HTTPS') || error.message?.includes('secure')) {
        errorMessage += 'Camera access requires HTTPS. Please use a secure connection.'
      } else {
        errorMessage += 'Please ensure camera permissions are granted and try again.'
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
          throw new Error('Client not found')
        }
        
        const clientData = await response.json()
        setScannedClient(clientData)
        setSessionAllowance(clientData.sessionAllowance?.toString() || '')
      } else {
        setError('Invalid QR code. Please scan a membership QR code.')
      }
    } catch (error: any) {
      console.error('Error processing QR code:', error)
      setError('Invalid QR code format. Please try again.')
    }
  }

  const handleRenewMembership = async () => {
    if (!scannedClient) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const allowance = sessionAllowance === '' ? null : parseInt(sessionAllowance)
      if (sessionAllowance !== '' && (isNaN(allowance!) || allowance! < 0)) {
        throw new Error('Session allowance must be a positive number or empty for unlimited')
      }

      const response = await fetch(`/api/admin/clients/${scannedClient.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionAllowance: allowance,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update membership')
      }

      const updated = await response.json()
      setScannedClient({
        ...scannedClient,
        sessionAllowance: updated.sessionAllowance,
      })
      setSuccess('Membership renewed successfully!')
      setTimeout(() => {
        setScannedClient(null)
        setSessionAllowance('')
        setSuccess('')
      }, 2000)
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Membership Management</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              Scan a member&apos;s QR code to renew their membership
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
                      <div id="qr-reader" className="w-full max-w-full overflow-hidden" ref={scanAreaRef}></div>
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

            {/* Client Info and Renewal Form */}
            {scannedClient && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Renew Membership</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Name</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words">{scannedClient.name}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Email</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 break-words break-all">{scannedClient.email}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Current Session Allowance</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">
                          {scannedClient.sessionAllowance !== null
                            ? `${scannedClient.sessionAllowance} sessions`
                            : 'Unlimited'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Active Bookings</p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900">{scannedClient.activeBookings}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="sessionAllowance" className="text-sm font-medium text-gray-900">
                        New Session Allowance
                      </label>
                      <Input
                        id="sessionAllowance"
                        type="number"
                        min="0"
                        placeholder="Leave empty for unlimited"
                        value={sessionAllowance}
                        onChange={(e) => setSessionAllowance(e.target.value)}
                        className="h-12 text-base"
                      />
                      <p className="text-xs text-gray-600">
                        Enter the number of sessions allowed with this membership. Leave empty for unlimited.
                      </p>
                    </div>

                    <Button
                      onClick={handleRenewMembership}
                      className="w-full"
                      disabled={saving}
                    >
                      {saving ? 'Renewing...' : 'Renew Membership'}
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
