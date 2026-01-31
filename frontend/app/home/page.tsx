'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/auth/LogoutButton'

interface Booking {
  id: string
  serviceSession: {
    id: string
    name: string
    themeColor: string
  } | null
  startTime: string
  endTime: string
  status: string
}

interface Session {
  id: string
  name: string
  description: string | null
  themeColor: string
  slots: number
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [sessionAllowance, setSessionAllowance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchMyBookings()
      fetchClientInfo()
    }
  }, [status, router])

  const fetchMyBookings = async () => {
    try {
      const response = await fetch('/api/bookings/my')
      if (response.ok) {
        const data = await response.json()
        setMyBookings(data)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClientInfo = async () => {
    try {
      const response = await fetch('/api/clients/me')
      if (response.ok) {
        const data = await response.json()
        setSessionAllowance(data.sessionAllowance)
      }
    } catch (error) {
      console.error('Error fetching client info:', error)
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
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8 relative">
            <div className="absolute top-0 right-0">
              <LogoutButton />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Home</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                Welcome, {session?.user?.name || session?.user?.email}
              </p>
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* My Sessions - Upcoming Bookings */}
            <div className="lg:col-span-2">
              <Link href="/my-sessions">
                <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg sm:text-xl">My Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-1">
                        {myBookings.length}
                      </p>
                      <p className="text-sm text-gray-700">
                        {myBookings.length === 1 ? 'Session' : 'Sessions'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Right Sidebar */}
            <div className="flex flex-col gap-6">
              {/* Book a Session */}
              <Card className="shadow-sm h-full">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">Book a Session</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 mb-4">
                    Browse available sessions and book your preferred time slot.
                  </p>
                  <Link href="/book">
                    <Button className="w-full">
                      Browse Sessions
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Member Card */}
              <Link href="/membership">
                <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg sm:text-xl">Member Card</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-[#8B1538] to-[#722F37] rounded-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xs opacity-80 mb-1">Member Since</p>
                            <p className="text-sm font-semibold">
                              {session?.user?.email ? new Date().getFullYear() : '2024'}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="border-t border-white/20 pt-4">
                          <p className="text-xs opacity-80 mb-1">Sessions Used</p>
                          <p className="text-2xl font-bold">{myBookings.length}</p>
                          <p className="text-xs opacity-60 mt-1">
                            {sessionAllowance !== null ? `of ${sessionAllowance} allowed` : 'Unlimited'}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 text-center">Tap to view QR code and details</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
