'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import QRCode from 'qrcode'
import { useLanguage } from '@/contexts/LanguageContext'
import { useClients } from '@/hooks/useBookingsData'
import { useQueryClient } from '@tanstack/react-query'

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  userId: string | null
  sessionAllowance: number | null
  activeBookingsCount: number
  createdAt: string
}

interface Props {
  onBack?: () => void
}

export default function ClientsView({ onBack }: Props) {
  const { t } = useLanguage()
  const router = useRouter()
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const { data: clients = [], isLoading } = useClients()
  const [fetchError] = useState('')

  // Invite QR modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [inviteQrUrl, setInviteQrUrl] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteExpiresAt, setInviteExpiresAt] = useState<Date | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  // Edit modal
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    sessionAllowance: '',
  })
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      const userOrg = session?.user?.organizations?.find(
        (org) => org.role === 'OWNER' || org.role === 'ADMIN'
      )
      if (!userOrg) {
        router.push('/dashboard')
        return
      }
    }
  }, [status, router, session])

  const handleGenerateInvite = async () => {
    setInviteError('')
    setGeneratingInvite(true)
    setInviteQrUrl('')
    setInviteLink('')
    setInviteExpiresAt(null)
    setLinkCopied(false)

    try {
      const res = await fetch('/api/invitations', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('clients.invite_error'))
      }

      const registerUrl = `${window.location.origin}/register?token=${data.token}`
      const qrDataUrl = await QRCode.toDataURL(registerUrl, { width: 256, margin: 2 })

      setInviteLink(registerUrl)
      setInviteQrUrl(qrDataUrl)
      setInviteExpiresAt(new Date(data.expiresAt))
    } catch (err: any) {
      setInviteError(err.message || t('clients.invite_error'))
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleOpenInviteModal = () => {
    setShowInviteModal(true)
    setInviteQrUrl('')
    setInviteLink('')
    setInviteExpiresAt(null)
    setInviteError('')
    setLinkCopied(false)
  }

  const handleCloseInviteModal = () => {
    setShowInviteModal(false)
    setInviteQrUrl('')
    setInviteLink('')
    setInviteExpiresAt(null)
    setInviteError('')
    setLinkCopied(false)
    queryClient.invalidateQueries({ queryKey: ['clients'] })
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
    }
  }

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError('')
    setUpdating(true)

    try {
      if (!editingClient) return

      const updateData: any = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone || null,
        notes: editFormData.notes || null,
      }

      if (editFormData.sessionAllowance === '') {
        updateData.sessionAllowance = null
      } else if (editFormData.sessionAllowance) {
        const allowance = parseInt(editFormData.sessionAllowance)
        if (isNaN(allowance) || allowance < 1) {
          throw new Error('Session allowance must be a positive number')
        }
        updateData.sessionAllowance = allowance
      }

      const response = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update client')
      }

      setEditingClient(null)
      setEditFormData({ name: '', email: '', phone: '', notes: '', sessionAllowance: '' })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    } catch (err: any) {
      setEditError(err.message || 'An error occurred')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteClient = async () => {
    if (!editingClient) return
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) return

    setEditError('')
    setUpdating(true)

    try {
      const response = await fetch(`/api/clients/${editingClient.id}`, { method: 'DELETE' })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete client')
      }

      setEditingClient(null)
      setEditFormData({ name: '', email: '', phone: '', notes: '', sessionAllowance: '' })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    } catch (err: any) {
      setEditError(err.message || 'An error occurred')
    } finally {
      setUpdating(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return <PageSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {onBack ? (
                <button onClick={onBack} className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {t('clients.back')}
                </button>
              ) : (
                <Link href="/dashboard" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {t('clients.back')}
                </Link>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('clients.title')}</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">{t('clients.subtitle')}</p>
            </div>
            <Button onClick={handleOpenInviteModal}>{t('clients.invite_btn')}</Button>
          </div>

          {fetchError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4 mb-4 text-sm text-red-800">
              {t('clients.error_load', { error: fetchError })}
            </div>
          )}

          {!fetchError && clients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-700">{t('clients.no_clients')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((client) => (
                <Card key={client.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg sm:text-xl">{client.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-700 break-words break-all min-w-0">{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-gray-700 break-words">{client.phone}</span>
                        </div>
                      )}
                      {client.userId && (
                        <div className="flex items-center text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-green-700 font-medium">{t('clients.has_account')}</span>
                        </div>
                      )}
                      {client.sessionAllowance !== null && (
                        <div className="flex items-center text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[#8B1538]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="text-gray-700">{t('clients.sessions_allowed', { count: client.sessionAllowance! })}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingClient(client)
                          setEditFormData({
                            name: client.name,
                            email: client.email,
                            phone: client.phone || '',
                            notes: client.notes || '',
                            sessionAllowance: client.sessionAllowance?.toString() || '',
                          })
                        }}
                        className="w-full"
                      >
                        {t('clients.edit')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite QR modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('clients.invite_modal_title')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('clients.invite_modal_desc')}</p>

            {inviteError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 mb-4">
                {inviteError}
              </div>
            )}

            {!inviteQrUrl && (
              <Button
                className="w-full"
                onClick={handleGenerateInvite}
                disabled={generatingInvite}
              >
                {generatingInvite ? t('clients.invite_generating') : t('clients.invite_generate_btn')}
              </Button>
            )}

            {inviteQrUrl && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={inviteQrUrl} alt="Registration QR Code" width={224} height={224} />
                </div>

                {inviteExpiresAt && (
                  <p className="text-xs text-center text-gray-500">
                    {t('clients.invite_expires', {
                      date: inviteExpiresAt.toLocaleDateString(),
                    })}
                  </p>
                )}

                <div className="relative">
                  <input
                    readOnly
                    value={inviteLink}
                    className="w-full text-xs px-3 py-2 pr-9 border border-gray-300 rounded-md bg-gray-50 text-gray-700 truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    title={linkCopied ? t('clients.invite_copied') : t('clients.invite_copy')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {linkCopied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>

                <Button variant="outline" className="w-full" onClick={handleGenerateInvite} disabled={generatingInvite}>
                  {t('clients.invite_generate_new')}
                </Button>
              </div>
            )}

            <Button variant="ghost" className="w-full mt-3 text-gray-600" onClick={handleCloseInviteModal}>
              {t('clients.invite_close')}
            </Button>
          </div>
        </div>
      )}

      {/* Edit client modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('clients.edit_title')}</h2>
            <form onSubmit={handleUpdateClient} className="space-y-4">
              {editError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">{editError}</div>}
              <div className="space-y-2">
                <label htmlFor="edit-name" className="text-sm font-medium text-gray-900">{t('clients.name_label')}</label>
                <Input id="edit-name" type="text" placeholder={t('clients.name_placeholder')} value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-email" className="text-sm font-medium text-gray-900">{t('clients.email_label')}</label>
                <Input id="edit-email" type="email" placeholder={t('clients.email_placeholder')} value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-phone" className="text-sm font-medium text-gray-900">{t('clients.phone_label')}</label>
                <Input id="edit-phone" type="tel" placeholder={t('clients.phone_placeholder')} value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-notes" className="text-sm font-medium text-gray-900">{t('clients.notes_label')}</label>
                <textarea id="edit-notes" rows={3} placeholder={t('clients.notes_placeholder')} value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} className="flex w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base sm:text-sm text-gray-900 ring-offset-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-sessionAllowance" className="text-sm font-medium text-gray-900">{t('clients.allowance_label')}</label>
                {editingClient.sessionAllowance !== null && editingClient.activeBookingsCount !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${editingClient.activeBookingsCount >= editingClient.sessionAllowance ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (editingClient.activeBookingsCount / editingClient.sessionAllowance) * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-700 whitespace-nowrap">
                      {editingClient.activeBookingsCount} / {editingClient.sessionAllowance}
                    </span>
                  </div>
                )}
                <Input id="edit-sessionAllowance" type="number" min="1" placeholder={t('clients.allowance_placeholder')} value={editFormData.sessionAllowance} onChange={(e) => setEditFormData({ ...editFormData, sessionAllowance: e.target.value })} />
                <p className="text-xs text-gray-600">{t('clients.allowance_hint')}</p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setEditingClient(null); setEditError(''); setEditFormData({ name: '', email: '', phone: '', notes: '', sessionAllowance: '' }) }}>{t('clients.cancel')}</Button>
                  <Button type="submit" className="flex-1" disabled={updating}>{updating ? t('clients.submitting_edit') : t('clients.submit_edit')}</Button>
                </div>
                <Button type="button" variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDeleteClient} disabled={updating}>{t('clients.delete')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
