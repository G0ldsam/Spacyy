'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SessionCardProps {
  session: {
    id: string
    name: string
    description: string | null
    themeColor: string
    slots: number
    timetable: any[]
    _count: {
      bookings: number
      timetable: number
    }
  }
}

export function SessionCard({ session }: SessionCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete session')
      }

      router.refresh()
    } catch (error: any) {
      alert(error.message || 'Failed to delete session')
      setDeleting(false)
    }
  }

  return (
    <Card className="shadow-sm w-full">
      <CardHeader
        className="pb-3 relative flex items-center justify-center min-h-[60px] sm:min-h-[70px]"
        style={{ backgroundColor: session.themeColor }}
      >
        <CardTitle className="text-base sm:text-lg lg:text-xl text-white text-center break-words px-8">
          {session.name}
        </CardTitle>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-md hover:bg-black/20 transition-colors disabled:opacity-50 flex-shrink-0"
          aria-label="Delete session"
        >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 sm:h-5 sm:w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {session.description && (
          <p className="text-xs sm:text-sm text-gray-700 mb-3 mt-2 sm:mt-4 line-clamp-2 break-words">
            {session.description}
          </p>
        )}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-gray-700">Slots:</span>
            <span className="font-medium text-gray-900">{session.slots}</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-gray-700">Time slots:</span>
            <span className="font-medium text-gray-900">
              {session._count?.timetable ?? session.timetable?.length ?? 0}
            </span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-gray-700">Bookings:</span>
            <span className="font-medium text-gray-900">{session._count.bookings}</span>
          </div>
        </div>
        <div className="mt-3 sm:mt-4 flex gap-2">
          <Link href={`/sessions/${session.id}/timetable`} className="flex-1 min-w-0">
            <Button variant="outline" className="w-full text-xs sm:text-sm" size="sm">
              Timetable
            </Button>
          </Link>
          <Link href={`/sessions/${session.id}/edit`} className="flex-1 min-w-0">
            <Button variant="outline" className="w-full text-xs sm:text-sm" size="sm">
              Edit
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
