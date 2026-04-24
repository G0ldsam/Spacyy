import Link from 'next/link'
import Image from 'next/image'
import ContactForm from '@/components/ContactForm'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Spacyy" width={30} height={30} />
            <span className="text-lg font-bold text-[#8B1538] tracking-tight">Spacyy</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#contact" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Contact
            </a>
            <Link
              href="/login"
              className="px-5 py-2 bg-[#8B1538] text-white text-sm font-medium rounded-lg hover:bg-[#6B1029] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#2C0910] pt-16">
        {/* Ambient light */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#8B1538]/20 blur-[160px] rounded-full" />
        </div>

        {/* Fine grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-12">
            <div className="w-20 h-20 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
              <Image src="/logo.png" alt="Spacyy" width={48} height={48} />
            </div>
          </div>

          {/* Headline — weight contrast, no color tricks */}
          <h1 className="mb-6">
            <span className="block text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-none">
              Studio management
            </span>
            <span className="block text-5xl sm:text-6xl lg:text-7xl font-light text-white/50 tracking-tight leading-tight italic mt-2">
              made effortless.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-white/45 mb-10 max-w-lg mx-auto leading-relaxed font-light">
            Bookings, clients, memberships, and check-ins — all in one clean platform built for fitness and wellness studios.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#contact"
              className="px-8 py-3.5 bg-[#8B1538] text-white text-sm font-medium rounded-xl hover:bg-[#7A1230] transition-colors shadow-lg shadow-[#8B1538]/25"
            >
              Get started
            </a>
            <a
              href="#features"
              className="px-8 py-3.5 text-white/70 text-sm font-medium rounded-xl border border-white/10 hover:border-white/20 hover:text-white/90 transition-colors"
            >
              See features
            </a>
          </div>
        </div>

        {/* Bottom fade to white */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Thin divider strip */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
            {[
              { value: 'PWA', label: 'Installs like a native app' },
              { value: 'QR', label: 'Instant contactless check-in' },
              { value: '24 / 7', label: 'Clients book on their own time' },
            ].map((s) => (
              <div key={s.value} className="px-6 flex flex-col items-center gap-1.5">
                <span className="text-2xl font-bold text-[#8B1538]">{s.value}</span>
                <span className="text-xs text-gray-400 leading-snug">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 bg-[#FAFAFA]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-16">
            <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-[0.15em] mb-3">Features</p>
            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
              Everything your studio needs, nothing it doesn&apos;t.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-2xl overflow-hidden border border-gray-200">
            {[
              {
                icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
                title: 'Smart Booking',
                desc: 'Real-time availability, slot limits, and automatic email confirmations.',
              },
              {
                icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
                title: 'Client Management',
                desc: 'Profiles, session credits, membership history, and booking records.',
              },
              {
                icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
                title: 'QR Check-In',
                desc: 'Scan and confirm attendance in seconds. No paper, no friction.',
              },
              {
                icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                title: 'Flexible Scheduling',
                desc: 'Recurring sessions, timetable management, and custom booking windows.',
              },
              {
                icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
                title: 'PWA — Install Ready',
                desc: 'Works on any device. Clients install it on their home screen.',
              },
              {
                icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
                title: 'Custom Domain',
                desc: 'Your own branded URL. A seamless experience for your clients.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white p-8 hover:bg-[#FDF8F9] transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-[#8B1538]/8 flex items-center justify-center mb-5 group-hover:bg-[#8B1538]/15 transition-colors">
                  <svg className="w-4.5 h-4.5 text-[#8B1538]" style={{width:'18px',height:'18px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-28 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left copy */}
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-[0.15em] mb-3">Get in touch</p>
              <h2 className="text-4xl font-bold text-gray-900 mb-5 leading-tight">
                Ready to take your studio to the next level?
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Tell us about your business and we&apos;ll set you up with a fully branded booking platform — fast.
              </p>
              <div className="space-y-4">
                {[
                  'Your own subdomain or custom domain',
                  'Onboarding support included',
                  'No long-term contract required',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#8B1538]/10 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-[#8B1538]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
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
          <p className="text-white/30 text-xs">© 2026 Spacyy. Built for wellness businesses.</p>
          <Link href="/login" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Sign in →
          </Link>
        </div>
      </footer>

    </div>
  )
}
