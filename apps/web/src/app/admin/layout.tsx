'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin',         icon: <GridIcon />,    label: 'Dashboard' },
  { href: '/admin/fleet',   icon: <MapIcon />,     label: 'Live Fleet' },
  { href: '/admin/routes',  icon: <RouteIcon />,   label: 'Routes' },
  { href: '/admin/stops',   icon: <PinIcon />,     label: 'Stops' },
  { href: '/admin/buses',   icon: <BusIcon />,     label: 'Buses' },
  { href: '/admin/drivers', icon: <UserIcon />,    label: 'Drivers' },
  { href: '/admin/ads',     icon: <AdsIcon />,     label: 'Advertisements' },
  { href: '/admin/revenue', icon: <RevenueIcon />, label: 'Revenue' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);
  // Lock body scroll when drawer open on mobile
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const Sidebar = () => (
    <aside className="w-[220px] shrink-0 flex flex-col h-full overflow-y-auto"
           style={{ background: '#09090B', borderRight: '1px solid #27272A' }}>
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #27272A' }}>
        <Link href="/" className="block">
          <Image src="/adkerala-logo.svg" alt="adkerala" width={132} height={38}
                 className="brightness-0 invert" priority />
        </Link>
        <p className="text-xs mt-2" style={{ color: '#52525B' }}>Administration Portal</p>
      </div>

      <div className="px-3 pt-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest px-2 mb-2"
           style={{ color: '#3F3F46' }}>Operations</p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 pb-4">
        {NAV.map(n => {
          const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href}
              className={`sidebar-link ${active ? 'active' : ''}`}
              style={{ transition: 'all 0.15s' }}>
              <span className="icon w-4 h-4 shrink-0">{n.icon}</span>
              <span>{n.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: '#34D399' }} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4" style={{ borderTop: '1px solid #27272A' }}>
        <Image src="/kerala-tourism-badge.svg" alt="Kerala Tourism"
               width={140} height={50} className="opacity-40 hover:opacity-70 transition-opacity" />
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F4F4F5' }}>

      {/* ── Desktop sidebar (always visible ≥ md) ──────────────────────── */}
      <div className="hidden md:flex flex-col h-full">
        <Sidebar />
      </div>

      {/* ── Mobile drawer backdrop ─────────────────────────────────────── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40"
             style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
             onClick={() => setOpen(false)} />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <div className={`md:hidden fixed top-0 left-0 h-full z-50 flex flex-col
                       transition-transform duration-300 ease-out
                       ${open ? 'translate-x-0' : '-translate-x-full'}`}
           style={{ width: 240, boxShadow: open ? '4px 0 40px rgba(0,0,0,0.4)' : 'none' }}>
        <Sidebar />
      </div>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="h-12 shrink-0 flex items-center justify-between px-4 sm:px-6"
                style={{ background: '#fff', borderBottom: '1px solid #E4E4E7' }}>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setOpen(o => !o)}
              className="md:hidden flex flex-col gap-1 p-1.5 rounded-lg transition-colors
                         hover:bg-zinc-100 tap-target"
              aria-label="Open menu">
              <span className={`block h-0.5 w-4 bg-zinc-600 transition-all duration-200 ${open ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block h-0.5 w-4 bg-zinc-600 transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-4 bg-zinc-600 transition-all duration-200 ${open ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </button>
            {/* Current page title */}
            <span className="text-sm font-semibold text-zinc-700 md:hidden">
              {NAV.find(n => n.href === pathname || (n.href !== '/admin' && pathname.startsWith(n.href)))?.label ?? 'Admin'}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" className="hidden sm:block text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              ← Public site
            </Link>
            <div className="hidden sm:block w-px h-4 bg-zinc-200" />
            <span className="badge-green text-xs hidden sm:inline-flex">Platform Admin</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                 style={{ background: '#006B3C' }}>A</div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

function GridIcon()    { return <svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>; }
function MapIcon()     { return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 1.5L1 3.5v11l5-2 4 2 5-2v-11l-5 2-4-2zm0 1.9l4 2v7.2l-4-2V3.4zm-4 1.6l3-1.2v7.4L2 12.4V5zm10 4.8l-3 1.2V3.6l3-1.2v7.4z"/></svg>; }
function RouteIcon()   { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="3" cy="8" r="2"/><circle cx="13" cy="8" r="2"/><path d="M5 8h6" strokeDasharray="2 1"/></svg>; }
function PinIcon()     { return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a4 4 0 00-4 4c0 3 4 9 4 9s4-6 4-9a4 4 0 00-4-4zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>; }
function BusIcon()     { return <svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="14" height="9" rx="2"/><rect x="3" y="5" width="3" height="3" rx="0.5" fill="#09090B"/><rect x="7" y="5" width="3" height="3" rx="0.5" fill="#09090B"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="13" r="1.5"/></svg>; }
function UserIcon()    { return <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6H2z"/></svg>; }
function AdsIcon()     { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 11V8m3 3V6m3 5V9"/></svg>; }
function RevenueIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v12M5.5 4a2.5 2.5 0 015 0c0 1.5-1.25 2-2.5 2.5C6.75 7 5.5 7.5 5.5 9a2.5 2.5 0 005 0"/></svg>; }
