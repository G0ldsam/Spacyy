import Link from 'next/link'
import Image from 'next/image'
import ContactForm from '@/components/ContactForm'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Spacyy" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold text-[#8B1538] tracking-tight">Spacyy</span>
          </div>
          <div className="flex items-center gap-6">
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
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#3D0817] pt-16">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#8B1538]/30 blur-[120px]" />
        </div>

        {/* Decorative rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-[#8B1538]/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-[#8B1538]/5 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
          {/* Logo mark */}
          <div className="mb-8 w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
            <Image src="/logo.png" alt="Spacyy" width={56} height={56} />
          </div>

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#8B1538]/30 border border-[#8B1538]/40 text-[#F4A0B5] text-xs font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F4A0B5] animate-pulse" />
            Booking platform for wellness businesses
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            Manage your studio<br />
            <span className="text-[#E8879A]">with elegance</span>
          </h1>

          <p className="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
            Spacyy gives fitness studios, yoga centers, and wellness businesses a complete platform —
            bookings, clients, memberships, and check-ins, beautifully unified.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="#contact"
              className="px-8 py-3.5 bg-[#8B1538] text-white font-medium rounded-xl hover:bg-[#6B1029] transition-all shadow-lg shadow-[#8B1538]/30 hover:shadow-[#8B1538]/50"
            >
              Get started
            </a>
            <a
              href="#features"
              className="px-8 py-3.5 bg-white/10 text-white font-medium rounded-xl hover:bg-white/15 transition-all border border-white/10"
            >
              See features
            </a>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Stats strip */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: 'PWA', label: 'Works offline & installs like a native app' },
              { value: 'QR', label: 'Instant check-in via QR code scan' },
              { value: '24/7', label: 'Clients book anytime, from any device' },
            ].map((stat) => (
              <div key={stat.value} className="flex flex-col items-center gap-2">
                <span className="text-3xl font-bold text-[#8B1538]">{stat.value}</span>
                <span className="text-sm text-gray-500 leading-snug">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-[#FDF5F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-[#8B1538] uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything in one place</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Built specifically for studios and wellness businesses that need more than a basic calendar.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                ),
                title: 'Smart Booking',
                desc: 'Real-time availability, slot management, and automatic confirmations sent to clients.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                ),
                title: 'Client Management',
                desc: 'Full client profiles with membership history, session credits, and booking records.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                ),
                title: 'QR Check-In',
                desc: 'Contactless check-in with QR codes. Scan and confirm attendance in seconds.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                title: 'Flexible Scheduling',
                desc: 'Recurring sessions, timetable management, and custom booking policies.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                ),
                title: 'PWA — Install Ready',
                desc: 'Works on any device. Clients can install it on their home screen like a native app.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                ),
                title: 'Custom Domain',
                desc: 'Use your own domain for a fully branded experience that represents your studio.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-7 border border-gray-100 hover:border-[#8B1538]/20 hover:shadow-lg hover:shadow-[#8B1538]/5 transition-all duration-300 group"
              >
                <div className="w-11 h-11 rounded-xl bg-[#8B1538]/8 flex items-center justify-center mb-5 group-hover:bg-[#8B1538]/15 transition-colors">
                  <svg className="w-5 h-5 text-[#8B1538]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="py-20 bg-[#8B1538]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
              <Image src="/logo.png" alt="Spacyy" width={40} height={40} />
            </div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to transform your studio?
          </h2>
          <p className="text-white/70 mb-8 text-lg">
            Get in touch and we&apos;ll set you up with your own branded booking platform.
          </p>
          <a
            href="#contact"
            className="inline-block px-10 py-4 bg-white text-[#8B1538] font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-xl"
          >
            Get in touch
          </a>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-[#8B1538] uppercase tracking-widest mb-3">Contact</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Let&apos;s talk</h2>
            <p className="text-gray-500">
              Interested in Spacyy for your business? Fill in the form and we&apos;ll get back to you.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#3D0817] py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Spacyy" width={28} height={28} className="opacity-90" />
            <span className="text-white/80 font-semibold">Spacyy</span>
          </div>
          <p className="text-white/40 text-sm">© 2026 Spacyy. Built for wellness businesses.</p>
          <Link href="/login" className="text-white/50 hover:text-white/80 text-sm transition-colors">
            Sign in
          </Link>
        </div>
      </footer>

    </div>
  )
}
