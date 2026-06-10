export interface BrandColors {
  primary: string
  secondary: string
  accent: string
  surface?: string
}

export interface DerivedTokens {
  // Base
  primary: string
  secondary: string
  accent: string
  // Tints (lighter)
  primaryLight: string
  secondaryLight: string
  accentLight: string
  // Shades (darker)
  primaryDark: string
  secondaryDark: string
  // Muted (very desaturated)
  primaryMuted: string
  // Text on primary (white or black, WCAG contrast)
  onPrimary: string
  onSecondary: string
  onAccent: string
  // Gradients
  heroGradient: string
  ambientGradient: string
  cardGlow: string
  buttonGradient: string
  // Surface
  surfaceBg: string
}

export const DEFAULT_BRAND: BrandColors = {
  primary: '#8B1538',
  secondary: '#6B1030',
  accent: '#C4184A',
}

function hexToHsl(hex: string): [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s))
  l = Math.max(0, Math.min(100, l))
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function relativeLuminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function onColor(bg: string): string {
  return contrastRatio(bg, '#ffffff') >= 4.5 ? '#ffffff' : '#0f172a'
}

export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}

export function wcagLevel(bg: string, fg: string): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  const ratio = contrastRatio(bg, fg)
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA Large'
  return 'Fail'
}

export function deriveTokens(brand: BrandColors): DerivedTokens {
  const [ph, ps, pl] = hexToHsl(brand.primary)
  const [sh, ss, sl] = hexToHsl(brand.secondary)
  const [ah, as_, al] = hexToHsl(brand.accent)

  const primaryLight  = hslToHex(ph, Math.max(ps - 15, 10), Math.min(pl + 28, 92))
  const primaryDark   = hslToHex(ph, Math.min(ps + 5, 100), Math.max(pl - 12, 8))
  const primaryMuted  = hslToHex(ph, Math.max(ps - 35, 5), Math.min(pl + 42, 95))
  const secondaryLight = hslToHex(sh, Math.max(ss - 15, 10), Math.min(sl + 28, 92))
  const secondaryDark  = hslToHex(sh, Math.min(ss + 5, 100), Math.max(sl - 12, 8))
  const accentLight    = hslToHex(ah, Math.max(as_ - 15, 10), Math.min(al + 28, 92))

  // Analogous hue shift for button gradient (+12°)
  const buttonEnd = hslToHex(ph + 12, ps, Math.max(pl - 5, 10))

  return {
    primary:        brand.primary,
    secondary:      brand.secondary,
    accent:         brand.accent,
    primaryLight,
    primaryDark,
    primaryMuted,
    secondaryLight,
    secondaryDark,
    accentLight,
    onPrimary:      onColor(brand.primary),
    onSecondary:    onColor(brand.secondary),
    onAccent:       onColor(brand.accent),
    heroGradient:   `linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%)`,
    ambientGradient:`radial-gradient(ellipse at 20% 80%, ${brand.primary}14 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, ${brand.secondary}0f 0%, transparent 55%)`,
    cardGlow:       `radial-gradient(ellipse at top, ${brand.primary}1f 0%, transparent 65%)`,
    buttonGradient: `linear-gradient(135deg, ${brand.primary} 0%, ${buttonEnd} 100%)`,
    surfaceBg:      brand.surface ?? hslToHex(ph, Math.min(ps * 0.07, 7), 97.5),
  }
}

function hexToRgbChannels(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

export function tokensToCssVars(tokens: DerivedTokens): string {
  return `
    --brand-primary: ${tokens.primary};
    --brand-primary-rgb: ${hexToRgbChannels(tokens.primary)};
    --brand-secondary: ${tokens.secondary};
    --brand-accent: ${tokens.accent};
    --brand-accent-rgb: ${hexToRgbChannels(tokens.accent)};
    --brand-primary-light: ${tokens.primaryLight};
    --brand-primary-dark: ${tokens.primaryDark};
    --brand-primary-dark-rgb: ${hexToRgbChannels(tokens.primaryDark)};
    --brand-primary-muted: ${tokens.primaryMuted};
    --brand-secondary-light: ${tokens.secondaryLight};
    --brand-secondary-dark: ${tokens.secondaryDark};
    --brand-accent-light: ${tokens.accentLight};
    --brand-on-primary: ${tokens.onPrimary};
    --brand-on-secondary: ${tokens.onSecondary};
    --brand-on-accent: ${tokens.onAccent};
    --brand-hero-gradient: ${tokens.heroGradient};
    --brand-ambient-gradient: ${tokens.ambientGradient};
    --brand-card-glow: ${tokens.cardGlow};
    --brand-button-gradient: ${tokens.buttonGradient};
    --brand-surface: ${tokens.surfaceBg};
    --background: ${tokens.surfaceBg};
  `.trim()
}
