'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  activeSessions: number; totalBuses: number; totalRoutes: number;
  totalStops: number; pendingStops: number; totalRevenue: number;
}

export default function AdminDashboard() {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;
  const [stats, setStats] = useState<Stats>({
    activeSessions: 0, totalBuses: 0, totalRoutes: 0,
    totalStops: 0, pendingStops: 0, totalRevenue: 0,
  });

  useEffect(() => {
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => d.ok && setStats(d.data))
      .catch(() => {});
  }, [token]);

  return (
    <div className="space-y-7 max-w-5xl">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-0.5">adkerala platform overview</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-kerala-500 animate-pulse" />
            Live
          </span>
          <Link href="/admin/fleet" className="btn-primary text-xs py-2">
            Open Fleet Map
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Sessions',  value: stats.activeSessions, icon: '📡', accent: '#059669' },
          { label: 'Registered Buses', value: stats.totalBuses,     icon: '🚌', accent: '#006B3C' },
          { label: 'Routes',           value: stats.totalRoutes,    icon: '⇔',  accent: '#006B3C' },
          { label: 'Stops',            value: stats.totalStops,     icon: '📍', accent: '#006B3C' },
          { label: 'Pending Reviews',  value: stats.pendingStops,   icon: '⏳', accent: stats.pendingStops > 0 ? '#D97706' : '#059669' },
          { label: 'Total Revenue',    value: `₹${stats.totalRevenue.toFixed(0)}`, icon: '₹', accent: '#006B3C' },
        ].map(card => (
          <div key={card.label} className="stat-card group">
            <div className="flex items-start justify-between mb-3">
              <div className="stat-icon text-lg">{card.icon}</div>
            </div>
            <div className="stat-value" style={{ color: card.accent }}>{card.value}</div>
            <div className="stat-label mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Two-col row */}
      <div className="grid grid-cols-2 gap-4">

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-800">Stop Submissions</h2>
            {stats.pendingStops > 0 && (
              <span className="badge-gold">{stats.pendingStops} pending</span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Community-submitted stops awaiting review before going live on routes.
          </p>
          <Link href="/admin/stops" className="btn-secondary text-xs w-full flex justify-center">
            Review Stops →
          </Link>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Quick Actions</h2>
          <div className="space-y-1">
            {[
              { href: '/admin/buses',   label: 'Add Bus',      desc: 'Register a bus and get display token' },
              { href: '/admin/drivers', label: 'Add Driver',   desc: 'Create a driver account' },
              { href: '/admin/routes',  label: 'Create Route', desc: 'Define stops and route order' },
              { href: '/admin/ads',     label: 'New Campaign', desc: 'Launch a new ad campaign' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg
                           hover:bg-zinc-50 transition-colors group
                           border border-transparent hover:border-zinc-200">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{a.label}</p>
                  <p className="text-xs text-zinc-400">{a.desc}</p>
                </div>
                <svg className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* System links */}
      <div className="card">
        <h2 className="text-sm font-semibold text-zinc-800 mb-4">System Links</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: '/display',   label: 'Display Kiosk', icon: '🖥️', desc: 'Bus display PWA' },
            { href: '/driver',    label: 'Driver App',    icon: '📱', desc: 'Driver PWA login' },
            { href: '/admin/ads', label: 'Ad Campaigns',  icon: '📢', desc: 'Manage campaigns' },
          ].map(s => (
            <Link key={s.href} href={s.href}
              className="flex flex-col gap-1.5 p-4 rounded-lg border border-zinc-200
                         hover:border-kerala-300 hover:bg-kerala-50 transition-all">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-sm font-semibold text-zinc-800">{s.label}</p>
              <p className="text-xs text-zinc-400">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
