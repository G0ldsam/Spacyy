'use client'

import Link from 'next/link'
import Image from 'next/image'
import ContactForm from '@/components/ContactForm'
import { useLanguage } from '@/contexts/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export default function LandingPage() {
  const { t } = useLanguage()

  const features = [
    {
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      titleKey: 'landing.feature_booking_title',
      descKey: 'landing.feature_booking_desc',
    },
    {
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      titleKey: 'landing.feature_clients_title',
      descKey: 'landing.feature_clients_desc',
    },
    {
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      titleKey: 'landing.feature_qr_title',
      descKey: 'landing.feature_qr_desc',
    },
    {
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      titleKey: 'landing.feature_scheduling_title',
      descKey: 'landing.feature_scheduling_desc',
    },
    {
      icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
      titleKey: 'landing.feature_pwa_title',
      descKey: 'landing.feature_pwa_desc',
    },
    {
      icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
      titleKey: 'landing.feature_domain_title',
      descKey: 'landing.feature_domain_desc',
    },
  ]

  const badges = [
    { value: 'PWA', labelKey: 'landing.badge_pwa' },
    { value: 'QR', labelKey: 'landing.badge_qr' },
    { value: '24 / 7', labelKey: 'landing.badge_247' },
  ]

  const bullets = [
    'landing.contact_bullet_1',
    'landing.contact_bullet_2',
    'landing.contact_bullet_3',
  ]

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Spacyy" width={30} height={30} />
            <span className="text-lg font-bold text-[#8B1538] tracking-tight">Spacyy</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-8">
            <a href="#features" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">
              {t('landing.nav_features')}
            </a>
            <a href="#contact" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">
              {t('landing.nav_contact')}
            </a>
            <LanguageSwitcher />
            <Link
              href="/login"
              className="px-5 py-2 bg-[#8B1538] text-white text-sm font-medium rounded-lg hover:bg-[#6B1029] transition-colors"
            >
              {t('landing.nav_signin')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#2C0910] pt-16">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#8B1538]/20 blur-[160px] rounded-full" />
        </div>

        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-12">
            <div className="w-20 h-20 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
              <Image src="/logo.png" alt="Spacyy" width={48} height={48} />
            </div>
          </div>

          <h1 className="mb-6">
            <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-none">
              {t('landing.hero_title_1')}
            </span>
            <span className="block text-5xl sm:text-6xl lg:text-7xl font-light text-white/50 tracking-tight leading-tight italic mt-2">
              {t('landing.hero_title_2')}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-white/45 mb-10 max-w-lg mx-auto leading-relaxed font-light">
            {t('landing.hero_subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#contact"
              className="px-8 py-3.5 bg-[#8B1538] text-white text-sm font-medium rounded-xl hover:bg-[#7A1230] transition-colors shadow-lg shadow-[#8B1538]/25"
            >
              {t('landing.cta_start')}
            </a>
            <a
              href="#features"
              className="px-8 py-3.5 text-white/70 text-sm font-medium rounded-xl border border-white/10 hover:border-white/20 hover:text-white/90 transition-colors"
            >
              {t('landing.cta_features')}
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Stats strip */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
            {badges.map((s) => (
              <div key={s.value} className="px-6 flex flex-col items-center gap-1.5">
                <span className="text-2xl font-bold text-[#8B1538]">{s.value}</span>
                <span className="text-xs text-gray-400 leading-snug">{t(s.labelKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-16">
            <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-[0.15em] mb-3">{t('landing.features_label')}</p>
            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
              {t('landing.features_title')}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-2xl overflow-hidden border border-gray-200">
            {features.map((f) => (
              <div key={f.titleKey} className="bg-white p-8 hover:bg-[#FDF8F9] transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-[#8B1538]/8 flex items-center justify-center mb-5 group-hover:bg-[#8B1538]/15 transition-colors">
                  <svg className="w-4.5 h-4.5 text-[#8B1538]" style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{t(f.titleKey)}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-28 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-[0.15em] mb-3">{t('landing.contact_label')}</p>
              <h2 className="text-4xl font-bold text-gray-900 mb-5 leading-tight">
                {t('landing.contact_title')}
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                {t('landing.contact_desc')}
              </p>
              <div className="space-y-4">
                {bullets.map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#8B1538]/10 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-[#8B1538]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">{t(key)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2C0910] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Spacyy" width={24} height={24} className="opacity-80" />
            <span className="text-white/70 text-sm font-semibold">Spacyy</span>
          </div>
          <p className="text-white/30 text-xs">{t('landing.footer_copy')}</p>
          <Link href="/login" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            {t('landing.footer_signin')}
          </Link>
        </div>
      </footer>

    </div>
  )
}
