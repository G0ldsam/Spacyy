'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  userId: string | null
  sessionAllowance: number | null
  createdAt: string
}

export default function ClientsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    createAccount: true,
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    sessionAllowance: '',
  })
  const [updating, setUpdating] = useState(false)

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
      fetchClients()
    }
  }, [status, session, router])

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients')
      if (!response.ok) throw new Error('Failed to fetch clients')
      const data = await response.json()
      setClients(data)
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create client')
      }

      // If account was created, show temporary password
      if (data.tempPassword) {
        setTempPassword(data.tempPassword)
      } else {
        // Reset form and close modal
        setFormData({
          name: '',
          email: '',
          phone: '',
          notes: '',
          createAccount: true,
        })
        setShowCreateModal(false)
        fetchClients()
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setCreating(false)
    }
  }

  const handleClosePasswordModal = () => {
    setTempPassword(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      notes: '',
      createAccount: true,
    })
    setShowCreateModal(false)
    fetchClients()
  }

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setUpdating(true)

    try {
      if (!editingClient) return

      const updateData: any = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone || null,
        notes: editFormData.notes || null,
      }

      // Handle sessionAllowance - empty string means null (unlimited)
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update client')
      }

      setEditingClient(null)
      setEditFormData({
        name: '',
        email: '',
        phone: '',
        notes: '',
        sessionAllowance: '',
      })
      fetchClients()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setUpdating(false)
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
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Clients</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                Manage your clients
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              + Create Client
            </Button>
          </div>

          {clients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-700">No clients yet. Click &quot;Create Client&quot; to get started.</p>
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
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-700 break-words break-all min-w-0">{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center text-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-gray-700 break-words">{client.phone}</span>
                        </div>
                      )}
                      {client.userId && (
                        <div className="flex items-center text-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-2 text-green-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-green-700 font-medium">Has Account</span>
                        </div>
                      )}
                      {client.sessionAllowance !== null && (
                        <div className="flex items-center text-sm">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-2 text-[#8B1538]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="text-gray-700">
                            <span className="font-medium">{client.sessionAllowance}</span> sessions allowed
                          </span>
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
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Client</h2>
            <form onSubmit={handleCreateClient} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-900">
                  Name *
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Client name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-900">
                  Email *
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-gray-900">
                  Phone
                </label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="notes" className="text-sm font-medium text-gray-900">
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base sm:text-sm text-gray-900 ring-offset-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="createAccount"
                  checked={formData.createAccount}
                  onChange={(e) => setFormData({ ...formData, createAccount: e.target.checked })}
                  className="h-4 w-4 text-[#8B1538] focus:ring-[#8B1538] border-gray-300 rounded"
                />
                <label htmlFor="createAccount" className="text-sm text-gray-700">
                  Create login account (with temporary password)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateModal(false)
                    setError('')
                    setFormData({
                      name: '',
                      email: '',
                      phone: '',
                      notes: '',
                      createAccount: true,
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Client'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Password Modal */}
      {tempPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Client Account Created</h2>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>Important:</strong> Share this temporary password with the client. They will be required to change it on first login.
                </p>
                <div className="bg-white rounded border border-yellow-300 p-3 mt-3">
                  <p className="text-xs text-gray-600 mb-1">Email:</p>
                  <p className="font-mono text-sm font-semibold text-gray-900">{formData.email}</p>
                  <p className="text-xs text-gray-600 mb-1 mt-3">Temporary Password:</p>
                  <p className="font-mono text-lg font-bold text-[#8B1538]">{tempPassword}</p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleClosePasswordModal}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Client</h2>
            <form onSubmit={handleUpdateClient} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="edit-name" className="text-sm font-medium text-gray-900">
                  Name *
                </label>
                <Input
                  id="edit-name"
                  type="text"
                  placeholder="Client name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-email" className="text-sm font-medium text-gray-900">
                  Email *
                </label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="client@example.com"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-phone" className="text-sm font-medium text-gray-900">
                  Phone
                </label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-notes" className="text-sm font-medium text-gray-900">
                  Notes
                </label>
                <textarea
                  id="edit-notes"
                  rows={3}
                  placeholder="Additional notes..."
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base sm:text-sm text-gray-900 ring-offset-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-sessionAllowance" className="text-sm font-medium text-gray-900">
                  Session Allowance
                </label>
                <Input
                  id="edit-sessionAllowance"
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  value={editFormData.sessionAllowance}
                  onChange={(e) => setEditFormData({ ...editFormData, sessionAllowance: e.target.value })}
                />
                <p className="text-xs text-gray-600">Number of sessions allowed. Leave empty for unlimited.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditingClient(null)
                    setError('')
                    setEditFormData({
                      name: '',
                      email: '',
                      phone: '',
                      notes: '',
                      sessionAllowance: '',
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={updating}>
                  {updating ? 'Updating...' : 'Update Client'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
