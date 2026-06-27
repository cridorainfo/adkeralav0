'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';

/* ── Intersection-observer hook for scroll-triggered animations ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Animated counter ── */
function Counter({ to, duration = 1200 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(to / (duration / 16));
    const id = setInterval(() => {
      start = Math.min(start + step, to);
      setValue(start);
      if (start >= to) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [inView, to, duration]);
  return <span ref={ref}>{value}</span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const features = useInView();
  const platform = useInView();
  const cta      = useInView();

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="shrink-0">
            <Image src="/adkerala-logo.svg" alt="adkerala" width={130} height={37} priority />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {['#features','#platform'].map((h, i) => (
              <a key={h} href={h}
                className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
                {['Features','Platform'][i]}
              </a>
            ))}
            <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
              Admin
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/driver" className="btn-secondary text-sm">Driver App</Link>
            <Link href="/admin"  className="btn-primary  text-sm ripple-btn">Dashboard →</Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(o => !o)}
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg tap-target"
            aria-label="Menu">
            <span className={`block h-0.5 w-5 bg-zinc-700 transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block h-0.5 w-5 bg-zinc-700 transition-all duration-300 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-zinc-700 transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-72 border-b border-zinc-200' : 'max-h-0'}`}
             style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)' }}>
          <nav className="px-4 py-3 space-y-1">
            {[['#features','Features'],['#platform','Platform'],['/admin','Admin'],['/driver','Driver App']].map(([href,label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between py-3 px-3 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
                {label}
                <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7"/>
                </svg>
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Link href="/driver" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm flex-1 flex justify-center">Driver</Link>
              <Link href="/admin"  onClick={() => setMenuOpen(false)} className="btn-primary  text-sm flex-1 flex justify-center">Dashboard</Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 relative overflow-hidden">
        {/* Grid bg */}
        <div className="absolute inset-0 pointer-events-none"
             style={{
               backgroundImage: 'linear-gradient(rgba(0,107,60,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,107,60,0.04) 1px,transparent 1px)',
               backgroundSize: '48px 48px',
             }} />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] pointer-events-none opacity-25"
             style={{ background: 'radial-gradient(ellipse at top, #006B3C, transparent 70%)' }} />

        <div className="relative max-w-5xl mx-auto text-center stagger-children">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-kerala-50
                          border border-kerala-200 text-kerala-700 text-xs font-semibold
                          tracking-wide uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-kerala-500 animate-pulse" />
            Kerala Smart Bus Network
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-zinc-950 leading-tight
                         tracking-tight mb-5 max-w-3xl mx-auto">
            Real-time passenger{' '}
            <span className="relative inline-block" style={{ color: '#006B3C' }}>
              information
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 8" fill="none"
                   style={{ stroke: '#006B3C', opacity: 0.3 }}>
                <path d="M0 6 Q75 2 150 6 Q225 10 300 6" strokeWidth="3" strokeLinecap="round"
                      strokeDasharray="1" strokeDashoffset="1"
                      style={{ animation: 'drawIn 1s 0.6s cubic-bezier(0.22,1,0.36,1) forwards', strokeDasharray: '1', strokeDashoffset: '1' }} />
              </svg>
            </span>{' '}
            for Kerala&apos;s buses
          </h1>

          <p className="text-base sm:text-lg text-zinc-500 max-w-xl mx-auto leading-relaxed mb-8">
            GPS-powered stop announcements, in-bus digital displays, and a CPM ad platform —
            all offline-first on the bus LAN.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/admin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5
                         rounded-xl font-semibold text-white text-base tracking-tight
                         hover-lift ripple-btn"
              style={{ background: 'linear-gradient(135deg,#006B3C 0%,#064E3B 100%)',
                       boxShadow: '0 4px 20px rgba(0,107,60,0.35)' }}>
              Open Admin Dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </Link>
            <Link href="/driver"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5
                         rounded-xl font-medium text-zinc-700 text-base bg-white
                         border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-all">
              Driver PWA
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative max-w-2xl mx-auto mt-14 sm:mt-20 grid grid-cols-3 gap-px
                        bg-zinc-200 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm
                        animate-fade-in-up delay-400">
          {[
            { value: 14,      label: 'Districts',   unit: '' },
            { value: null,    label: 'GPS Tracking', unit: 'Live' },
            { value: null,    label: 'Ad Revenue',   unit: 'CPM' },
          ].map(s => (
            <div key={s.label} className="bg-white px-4 sm:px-8 py-5 sm:py-6 text-center">
              <div className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                {s.value !== null ? <Counter to={s.value} /> : s.unit}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-zinc-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-16 sm:py-24 bg-zinc-50 border-y border-zinc-200">
        <div ref={features.ref} className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className={`text-center mb-10 sm:mb-16 transition-all duration-700 ${features.inView ? 'animate-fade-in-up' : 'opacity-0 translate-y-8'}`}>
            <p className="section-title mb-2">Platform Capabilities</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
              Everything your bus network needs
            </h2>
          </div>

          <div className="auto-grid">
            {[
              { icon: '📍', title: 'Live Stop Announcements',    desc: 'Malayalam audio plays automatically as the bus approaches each stop, triggered by GPS geofence.' },
              { icon: '📡', title: 'Offline-First Architecture', desc: 'Bus LAN keeps ESP32, driver, and display in sync without internet. Cloud syncs when available.' },
              { icon: '💰', title: 'CPM Ad Revenue',             desc: 'Display ads on the kiosk screen. Atomic per-impression billing — owners earn, platform retains margin.' },
              { icon: '🗺️', title: 'Fleet Map',                  desc: 'Real-time Mapbox map showing all active buses across Kerala, visible to platform admin.' },
              { icon: '🔒', title: 'Role-Based Access',           desc: 'Admin, bus owner, driver, display, ESP32, and advertiser — each with scoped permissions.' },
              { icon: '⚡', title: 'ESP32 Button Panel',          desc: 'Physical forward/undo/announce buttons on the bus dashboard, talking to display over WiFi.' },
            ].map((f, i) => (
              <div key={f.title}
                className={`bg-white rounded-xl border border-zinc-200 p-5 sm:p-6
                            hover:border-kerala-300 hover:shadow-lg hover:-translate-y-1
                            transition-all duration-300 cursor-default
                            ${features.inView ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4 animate-float"
                     style={{ background: '#ECFDF4', animationDelay: `${i * 0.4}s` }}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-zinc-900 mb-2 text-sm sm:text-base">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ─────────────────────────────────────────────────── */}
      <section id="platform" className="py-16 sm:py-24 px-4 sm:px-6">
        <div ref={platform.ref} className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className={`transition-all duration-700 delay-100 ${platform.inView ? 'animate-fade-in-up' : 'opacity-0 translate-y-8'}`}>
            <p className="section-title mb-3">Architecture</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight mb-4">
              Works even without internet
            </h2>
            <p className="text-zinc-500 leading-relaxed mb-7 text-sm sm:text-base">
              The bus WiFi router creates a private LAN. ESP32 buttons, driver phone, and display
              communicate directly — no cloud required for core operations.
            </p>
            <div className="space-y-4 stagger-children">
              {[
                { icon: '🌐', name: 'Railway Cloud',         detail: 'Next.js + Socket.IO + PostgreSQL + Redis.' },
                { icon: '📶', name: 'Bus LAN (SIM router)', detail: 'Private subnet. mDNS — no fixed IPs needed.' },
                { icon: '📱', name: 'Driver PWA',            detail: 'GPS watchPosition + Screen Wake Lock + IndexedDB.' },
                { icon: '🖥️', name: 'Electron Display',      detail: 'Fullscreen kiosk. SQLite cache. Local WS servers.' },
              ].map(l => (
                <div key={l.name} className="flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5
                                  transition-transform duration-200 group-hover:scale-110"
                       style={{ background: '#ECFDF4' }}>
                    {l.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{l.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{l.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal diagram */}
          <div className={`rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-2xl
                           font-mono text-xs leading-6 overflow-hidden
                           transition-all duration-700 delay-200
                           ${platform.inView ? 'animate-scale-in' : 'opacity-0 scale-95'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-zinc-500 text-xs">bus.local</span>
            </div>
            {[
              ['#6EE7B7', '┌─ Bus LAN (192.168.1.x) ──────────────┐'],
              ['#4B5563', '│                                        │'],
              ['#6EE7B7', '│  📱 Driver ──WS:8766──► 🖥️  Display    │'],
              ['#FCD34D', '│  🔘 ESP32  ──WS:8765──► 🖥️  Display    │'],
              ['#4B5563', '│                                        │'],
              ['#4B5563', '└────────────────────────────────────────┘'],
              ['#4B5563', ''],
              ['#3F3F46', '    ▼  online  ▼'],
              ['#4B5563', ''],
              ['#93C5FD', '  ☁  Railway ── /driver  Socket.IO'],
              ['#93C5FD', '             └─ /display Socket.IO'],
              ['#93C5FD', '             └─ PostgreSQL (Prisma)'],
              ['#93C5FD', '             └─ Redis pub/sub'],
            ].map(([color, text], i) => (
              <div key={i} style={{ color, animationDelay: `${0.3 + i * 0.05}s` }}
                   className={platform.inView ? 'animate-fade-in' : 'opacity-0'}>
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────────────────── */}
      <section ref={cta.ref} className="py-14 sm:py-20 px-4 sm:px-6 mx-4 sm:mx-6 md:mx-auto max-w-5xl mb-12 rounded-3xl overflow-hidden"
               style={{ background: 'linear-gradient(135deg,#022C22 0%,#006B3C 100%)' }}>
        <div className={`text-center transition-all duration-700 ${cta.inView ? 'animate-fade-in-up' : 'opacity-0 translate-y-8'}`}>
          <p className="section-title mb-3" style={{ color: '#6EE7B7' }}>Get Started</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
            Ready to modernise your bus network?
          </h2>
          <p className="text-kerala-300 text-sm sm:text-base max-w-md mx-auto mb-8">
            Open the admin portal to register buses, create routes, and launch your first ad campaign.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/admin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5
                         rounded-xl font-bold text-zinc-900 text-base hover-lift ripple-btn"
              style={{ background: 'linear-gradient(135deg,#D4A017,#FBBF24)',
                       boxShadow: '0 4px 20px rgba(212,160,23,0.40)' }}>
              Open Admin Portal
            </Link>
            <Link href="/display"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5
                         rounded-xl font-medium text-white text-base border border-white/20
                         hover:bg-white/10 transition-colors">
              Display Kiosk
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 py-8 sm:py-10 px-4 sm:px-6 bg-zinc-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <Image src="/adkerala-logo.svg" alt="adkerala" width={110} height={32} />
            <span className="text-xs text-zinc-400 hidden sm:inline">Kerala Smart Bus Network</span>
          </div>
          <Image src="/kerala-tourism-badge.svg" alt="Kerala Tourism" width={110} height={38} className="opacity-50" />
          <p className="text-xs text-zinc-400">© {new Date().getFullYear()} adkerala</p>
        </div>
      </footer>

    </div>
  );
}
