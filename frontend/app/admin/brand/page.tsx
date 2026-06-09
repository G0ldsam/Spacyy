'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
      <div
        className="w-8 h-8 rounded-md border border-black/10 flex-shrink-0 shadow-sm"
        style={{ background: hex }}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{label}</p>
        {description && <p className="text-xs text-gray-400 truncate">{description}</p>}
        <p className="text-xs text-gray-400 font-mono">{hex}</p>
      </div>
    </div>
  )
}

function ColorPickerRow({
  label,
  value,
  onChange,
  description,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  description: string
}) {
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
        <div className="relative">
          <input
            type="color"
            value={valid ? inputVal : value}
            onChange={e => { setInputVal(e.target.value); onChange(e.target.value) }}
            className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white shadow-md p-0.5"
            style={{ background: 'none' }}
          />
        </div>
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
            <p className="text-xs text-red-500 mt-1">Must be #RRGGBB format</p>
          )}
        </div>
      </div>
    </div>
  )
}

function LivePreview({ colors }: { colors: BrandColors }) {
  const tokens = deriveTokens(colors)
  const cssVars = tokensToCssVars(tokens)

  return (
    <div style={{ ['--preview' as string]: cssVars }} className="space-y-3">
      {/* Hero section */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: tokens.heroGradient }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: tokens.ambientGradient }}
        />
        <div className="relative z-10">
          <p className="text-xs font-medium mb-1 opacity-75" style={{ color: tokens.onPrimary }}>
            YOGA FLOW · MON 9:00AM
          </p>
          <h3 className="text-xl font-bold mb-3" style={{ color: tokens.onPrimary }}>
            Morning Stretch Class
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
            Book Session
          </button>
        </div>
      </div>

      {/* Session cards */}
      <div className="grid grid-cols-2 gap-2">
        {['Pilates', 'Yoga Flow'].map((name, i) => (
          <div
            key={name}
            className="rounded-xl p-4 border relative overflow-hidden"
            style={{
              background: i === 0 ? tokens.primaryMuted : '#ffffff',
              borderColor: i === 0 ? tokens.primary + '33' : '#e5e7eb',
            }}
          >
            <div
              className="absolute inset-0 opacity-50"
              style={{ background: i === 0 ? tokens.cardGlow : 'none' }}
            />
            <p className="text-xs font-bold relative" style={{ color: i === 0 ? tokens.primary : '#374151' }}>
              {name}
            </p>
            <p className="text-xs relative" style={{ color: i === 0 ? tokens.primaryDark : '#6b7280' }}>
              10 slots · 60 min
            </p>
          </div>
        ))}
      </div>

      {/* Button row */}
      <div className="flex gap-2">
        <button
          className="flex-1 text-sm font-semibold py-2.5 rounded-xl shadow-sm transition-all"
          style={{ background: tokens.buttonGradient, color: tokens.onPrimary }}
        >
          Confirm
        </button>
        <button
          className="flex-1 text-sm font-medium py-2.5 rounded-xl border transition-all"
          style={{
            borderColor: tokens.primary + '44',
            color: tokens.primary,
            background: tokens.primaryMuted,
          }}
        >
          Cancel
        </button>
      </div>

      {/* Accent badge strip */}
      <div className="flex gap-2 flex-wrap">
        {['Active', 'Booked', 'Available'].map((tag, i) => (
          <span
            key={tag}
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{
              background: i === 0 ? tokens.accent : i === 1 ? tokens.accentLight : tokens.primaryMuted,
              color: i === 0 ? tokens.onAccent : i === 1 ? tokens.accent : tokens.primary,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function BrandStudioPage() {
  const [colors, setColors] = useState<BrandColors>(DEFAULT_BRAND)
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
        body: JSON.stringify({
          brandPrimary: colors.primary,
          brandSecondary: colors.secondary,
          brandAccent: colors.accent,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }, [colors])

  const handleReset = useCallback(() => {
    setColors(DEFAULT_BRAND)
  }, [])

  const tokens = deriveTokens(colors)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Brand Studio</h1>
          <p className="text-gray-500 text-sm mt-1">
            Customise your booking page colours. Changes apply instantly for your clients.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-5">
            {/* Presets */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">Quick Presets</CardTitle>
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

            {/* Color Pickers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">Brand Colours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ColorPickerRow
                  label="Primary"
                  value={colors.primary}
                  onChange={v => setColors(c => ({ ...c, primary: v }))}
                  description="Buttons, CTAs, active states"
                />
                <ColorPickerRow
                  label="Secondary"
                  value={colors.secondary}
                  onChange={v => setColors(c => ({ ...c, secondary: v }))}
                  description="Hero gradient end, cards"
                />
                <ColorPickerRow
                  label="Accent"
                  value={colors.accent}
                  onChange={v => setColors(c => ({ ...c, accent: v }))}
                  description="Badges, highlights, tags"
                />
              </CardContent>
            </Card>

            {/* Derived swatches */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">Auto-Generated Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <ColorSwatch label="Primary Light" hex={tokens.primaryLight} description="Hover backgrounds" />
                  <ColorSwatch label="Primary Dark" hex={tokens.primaryDark} description="Pressed states" />
                  <ColorSwatch label="Primary Muted" hex={tokens.primaryMuted} description="Card wash" />
                  <ColorSwatch label="Accent Light" hex={tokens.accentLight} description="Soft tags" />
                  <ColorSwatch label="On Primary" hex={tokens.onPrimary} description="Text on primary" />
                  <ColorSwatch label="On Accent" hex={tokens.onAccent} description="Text on accent" />
                </div>
              </CardContent>
            </Card>

            {/* Save */}
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
                style={{ background: tokens.buttonGradient, color: tokens.onPrimary }}
              >
                {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Brand Colours'}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                Reset
              </Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          {/* Live Preview */}
          <div className="space-y-4">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-700">Live Preview</CardTitle>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    Client view
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <LivePreview colors={colors} />
              </CardContent>
            </Card>

            {/* Gradient swatches */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">Generated Gradients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Hero', gradient: tokens.heroGradient },
                  { label: 'Button', gradient: tokens.buttonGradient },
                  { label: 'Card Glow', gradient: tokens.cardGlow },
                ].map(({ label, gradient }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="w-full h-8 rounded-lg border border-black/5 shadow-sm"
                      style={{ background: gradient }}
                    />
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">{label}</span>
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
