'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import QRCode from 'qrcode'
import Image from 'next/image'

export function ClientQRButton() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const isClient = session?.user?.organizations?.some((o) => o.role === 'CLIENT')
  const isAdminOnly = session?.user?.organizations?.every(
    (o) => o.role === 'OWNER' || o.role === 'ADMIN'
  )

  if (!session || !isClient || isAdminOnly) return null

  const handleOpen = async () => {
    setOpen(true)
    if (qrUrl) return
    setLoading(true)
    try {
      const res = await fetch('/api/clients/me')
      if (res.ok) {
        const data = await res.json()
        const encoded = JSON.stringify({ type: 'membership', clientId: data.id })
        const brandPrimary = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#8B1538'
        const url = await QRCode.toDataURL(encoded, {
          width: 300,
          margin: 2,
          color: { dark: brandPrimary, light: '#FFFFFF' },
        })
        setQrUrl(url)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Show membership QR code"
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-brand"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12v.01M12 4h.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Membership QR</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-gray-500 text-sm">Generating...</p>
              </div>
            ) : qrUrl ? (
              <Image
                src={qrUrl}
                alt="Membership QR Code"
                width={280}
                height={280}
                className="w-full h-auto rounded-xl"
              />
            ) : (
              <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-gray-500 text-sm">Could not generate QR code</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
