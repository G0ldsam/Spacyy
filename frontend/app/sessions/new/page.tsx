'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/contexts/LanguageContext'

export default function NewSessionPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    themeColor: '#3B82F6',
    slots: '1',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          slots: parseInt(formData.slots),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session')
      }

      router.push('/sessions')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('sessions_new.title')}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              {t('sessions_new.subtitle')}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('sessions_new.section_title')}</CardTitle>
              <CardDescription>{t('sessions_new.section_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-gray-900">
                    {t('sessions_new.name_label')}
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={t('sessions_new.name_placeholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium text-gray-900">
                    {t('sessions_new.desc_label')}
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    placeholder={t('sessions_new.desc_placeholder')}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="flex w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-base sm:text-sm text-gray-900 ring-offset-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="themeColor" className="text-sm font-medium text-gray-900">
                    {t('sessions_new.color_label')}
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="themeColor"
                      type="color"
                      value={formData.themeColor}
                      onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                      className="h-12 w-20 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.themeColor}
                      onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                      placeholder="#3B82F6"
                      className="h-12 text-base flex-1"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="slots" className="text-sm font-medium text-gray-900">
                    {t('sessions_new.slots_label')}
                  </label>
                  <Input
                    id="slots"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={formData.slots}
                    onChange={(e) => setFormData({ ...formData, slots: e.target.value })}
                    className="h-12 text-base"
                    required
                  />
                  <p className="text-xs text-gray-700">{t('sessions_new.slots_placeholder')}</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    {t('sessions_new.cancel')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? t('sessions_new.submitting') : t('sessions_new.submit')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
