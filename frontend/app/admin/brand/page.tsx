'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageSpinner } from '@/components/ui/spinner'
import { useLanguage } from '@/contexts/LanguageContext'
import { deriveTokens, tokensToCssVars, onColor, wcagLevel, DEFAULT_BRAND, isValidHex, type BrandColors } from '@/shared/lib/brandColors'

const PRESETS: { name: string; colors: BrandColors }[] = [
  { name: 'Crimson',  colors: { primary: '#8B1538', secondary: '#6B1030', accent: '#C4184A' } },
  { name: 'Ocean',    colors: { primary: '#0369A1', secondary: '#075985', accent: '#0EA5E9' } },
  { name: 'Forest',   colors: { primary: '#166534', secondary: '#14532D', accent: '#16A34A' } },
  { name: 'Dusk',     colors: { primary: '#6D28D9', secondary: '#5B21B6', accent: '#8B5CF6' } },
  { name: 'Slate',    colors: { primary: '#334155', secondary: '#1E293B', accent: '#64748B' } },
  { name: 'Rose',     colors: { primary: '#BE123C', secondary: '#9F1239', accent: '#F43F5E' } },
]

function WcagBadge({ bg, fg = '#ffffff' }: { bg: string; fg?: string }) {
  const level = wcagLevel(bg, fg)
  const colors: Record<string, string> = {
    'AAA': 'bg-green-100 text-green-800',
    'AA': 'bg-blue-100 text-blue-800',
    'AA Large': 'bg-yellow-100 text-yellow-800',
    'Fail': 'bg-red-100 text-red-800',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[level]}`}>
      {level}
    </span>
  )
}

function ColorSwatch({ label, hex, description }: { label: string; hex: string; description?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-md border border-black/10 flex-shrink-0 shadow-sm" style={{ background: hex }} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{label}</p>
        {description && <p className="text-xs text-gray-400 truncate">{description}</p>}
        <p className="text-xs text-gray-400 font-mono">{hex}</p>
      </div>
    </div>
  )
}

function ColorPickerRow({
  label, value, onChange, description, invalidMsg,
}: Readonly<{
  label: string; value: string; onChange: (hex: string) => void; description: string; invalidMsg: string
}>) {
  const [inputVal, setInputVal] = useState(value)
  const valid = isValidHex(inputVal)

  useEffect(() => { setInputVal(value) }, [value])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-800">{label}</label>
        <WcagBadge bg={valid ? inputVal : value} />
      </div>
      <p className="text-xs text-gray-500">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={valid ? inputVal : value}
          onChange={e => { setInputVal(e.target.value); onChange(e.target.value) }}
          className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white shadow-md p-0.5"
          style={{ background: 'none' }}
        />
        <div className="flex-1">
          <input
            type="text"
            value={inputVal}
            onChange={e => {
              setInputVal(e.target.value)
              if (isValidHex(e.target.value)) onChange(e.target.value)
            }}
            placeholder="#000000"
            maxLength={7}
            className={`w-full font-mono text-sm px-3 py-2 rounded-lg border transition-colors ${
              valid ? 'border-gray-200 focus:border-blue-400' : 'border-red-300 focus:border-red-400'
            } outline-none bg-white`}
          />
          {!valid && inputVal.length > 0 && (
            <p className="text-xs text-red-500 mt-1">{invalidMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function LivePreview({ colors, surface, t }: Readonly<{ colors: BrandColors; surface: string; t: (key: string) => string }>) {
  const tokens = deriveTokens({ ...colors, surface })
  const cssVars = tokensToCssVars(tokens)

  return (
    <div style={{ ['--preview' as string]: cssVars }} className="space-y-3">
      <div className="rounded-xl px-3 py-2 text-xs text-gray-500 border border-dashed border-gray-200 flex items-center gap-2" style={{ background: tokens.surfaceBg }}>
        <div className="w-3 h-3 rounded-sm border border-gray-300 flex-shrink-0" style={{ background: tokens.surfaceBg }} />
        Background: {tokens.surfaceBg}
      </div>
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: tokens.heroGradient }}>
        <div className="absolute inset-0 opacity-30" style={{ background: tokens.ambientGradient }} />
        <div className="relative z-10">
          <p className="text-xs font-medium mb-1 opacity-75" style={{ color: tokens.onPrimary }}>
            {t('brand.preview_session_label')}
          </p>
          <h3 className="text-xl font-bold mb-3" style={{ color: tokens.onPrimary }}>
            {t('brand.preview_session_title')}
          </h3>
          <button
            className="text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all"
            style={{
              background: tokens.onPrimary === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
              color: tokens.onPrimary,
              backdropFilter: 'blur(8px)',
              border: `1px solid ${tokens.onPrimary === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'}`,
            }}
          >
            {t('brand.preview_book')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['Pilates', 'Yoga Flow'].map((name, i) => (
          <div
            key={name}
            className="rounded-xl p-4 border relative overflow-hidden"
            style={{ background: i === 0 ? tokens.primaryMuted : '#ffffff', borderColor: i === 0 ? tokens.primary + '33' : '#e5e7eb' }}
          >
            <div className="absolute inset-0 opacity-50" style={{ background: i === 0 ? tokens.cardGlow : 'none' }} />
            <p className="text-xs font-bold relative" style={{ color: i === 0 ? tokens.primary : '#374151' }}>{name}</p>
            <p className="text-xs relative" style={{ color: i === 0 ? tokens.primaryDark : '#6b7280' }}>
              {t('brand.preview_session_slots')}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 text-sm font-semibold py-2.5 rounded-xl shadow-sm transition-all"
          style={{ background: tokens.buttonGradient, color: tokens.onPrimary }}
        >
          {t('brand.preview_confirm')}
        </button>
        <button
          className="flex-1 text-sm font-medium py-2.5 rounded-xl border transition-all"
          style={{ borderColor: tokens.primary + '44', color: tokens.primary, background: tokens.primaryMuted }}
        >
          {t('brand.preview_cancel')}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['preview_tag_active', 'preview_tag_booked', 'preview_tag_available'] as const).map((key, i) => (
          <span
            key={key}
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{
              background: i === 0 ? tokens.accent : i === 1 ? tokens.accentLight : tokens.primaryMuted,
              color: i === 0 ? tokens.onAccent : i === 1 ? tokens.accent : tokens.primary,
            }}
          >
            {t(`brand.${key}`)}
          </span>
        ))}
      </div>
    </div>
  )
}

const DEFAULT_SURFACE = '#f9f8f9'

export default function BrandStudioPage() {
  const { t } = useLanguage()
  const [colors, setColors] = useState<BrandColors>(DEFAULT_BRAND)
  const [surface, setSurface] = useState<string>(DEFAULT_SURFACE)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/brand')
      .then(r => r.json())
      .then(data => {
        if (data.brandPrimary || data.brandSecondary || data.brandAccent) {
          setColors({
            primary:   data.brandPrimary   ?? DEFAULT_BRAND.primary,
            secondary: data.brandSecondary ?? DEFAULT_BRAND.secondary,
            accent:    data.brandAccent    ?? DEFAULT_BRAND.accent,
          })
        }
        if (data.brandSurface) setSurface(data.brandSurface)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/brand', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandPrimary: colors.primary, brandSecondary: colors.secondary, brandAccent: colors.accent, brandSurface: surface }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError(t('brand.error_save'))
    } finally {
      setSaving(false)
    }
  }, [colors, t])

  const tokens = deriveTokens(colors)
  let saveLabel = t('brand.save')
  if (saving) saveLabel = t('brand.saving')
  else if (saved) saveLabel = t('brand.saved')

  if (loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-brand-surface p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-800 transition-colors text-sm mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('brand.back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('brand.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('brand.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">{t('brand.presets')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => setColors(preset.colors)}
                      className="group relative rounded-xl overflow-hidden h-14 border-2 transition-all hover:scale-105 hover:shadow-md"
                      style={{
                        borderColor: colors.primary === preset.colors.primary ? preset.colors.primary : 'transparent',
                        background: `linear-gradient(135deg, ${preset.colors.primary} 0%, ${preset.colors.secondary} 100%)`,
                      }}
                      title={preset.name}
                    >
                      <span
                        className="absolute inset-0 flex items-end p-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: onColor(preset.colors.primary) }}
                      >
                        {preset.name}
                      </span>
                      <div
                        className="absolute bottom-1.5 right-1.5 w-3 h-3 rounded-full border border-white/50"
                        style={{ background: preset.colors.accent }}
                      />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">{t('brand.colours')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ColorPickerRow label={t('brand.primary')} value={colors.primary} onChange={v => setColors(c => ({ ...c, primary: v }))} description={t('brand.primary_desc')} invalidMsg={t('brand.invalid_hex')} />
                <ColorPickerRow label={t('brand.secondary')} value={colors.secondary} onChange={v => setColors(c => ({ ...c, secondary: v }))} description={t('brand.secondary_desc')} invalidMsg={t('brand.invalid_hex')} />
                <ColorPickerRow label={t('brand.accent')} value={colors.accent} onChange={v => setColors(c => ({ ...c, accent: v }))} description={t('brand.accent_desc')} invalidMsg={t('brand.invalid_hex')} />
                <ColorPickerRow label={t('brand.surface')} value={surface} onChange={setSurface} description={t('brand.surface_desc')} invalidMsg={t('brand.invalid_hex')} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">{t('brand.derived_tokens')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <ColorSwatch label={t('brand.token_primary_light')} hex={tokens.primaryLight} description={t('brand.token_primary_light_desc')} />
                  <ColorSwatch label={t('brand.token_primary_dark')} hex={tokens.primaryDark} description={t('brand.token_primary_dark_desc')} />
                  <ColorSwatch label={t('brand.token_primary_muted')} hex={tokens.primaryMuted} description={t('brand.token_primary_muted_desc')} />
                  <ColorSwatch label={t('brand.token_accent_light')} hex={tokens.accentLight} description={t('brand.token_accent_light_desc')} />
                  <ColorSwatch label={t('brand.token_on_primary')} hex={tokens.onPrimary} description={t('brand.token_on_primary_desc')} />
                  <ColorSwatch label={t('brand.token_on_accent')} hex={tokens.onAccent} description={t('brand.token_on_accent_desc')} />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="flex-1" style={{ background: tokens.buttonGradient, color: tokens.onPrimary }}>
                {saveLabel}
              </Button>
              <Button variant="outline" onClick={() => { setColors(DEFAULT_BRAND); setSurface(DEFAULT_SURFACE) }} disabled={saving}>
                {t('brand.reset')}
              </Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          {/* Live Preview */}
          <div className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-700">{t('brand.live_preview')}</CardTitle>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {t('brand.client_view')}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <LivePreview colors={colors} surface={surface} t={t} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">{t('brand.generated_gradients')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: 'gradient_hero', gradient: tokens.heroGradient },
                  { key: 'gradient_button', gradient: tokens.buttonGradient },
                  { key: 'gradient_card_glow', gradient: tokens.cardGlow },
                ].map(({ key, gradient }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-full h-8 rounded-lg border border-black/5 shadow-sm" style={{ background: gradient }} />
                    <span className="text-xs text-gray-500 w-20 flex-shrink-0">{t(`brand.${key}`)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
