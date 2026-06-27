'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function DriverLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.warn);
    const token = sessionStorage.getItem('adkerala_token');
    if (token) router.replace('/driver/pair');
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Login failed'); return; }
      if (data.data.user.role !== 'driver') { setError('Not a driver account'); return; }
      sessionStorage.setItem('adkerala_token', data.data.token);
      sessionStorage.setItem('adkerala_user',  JSON.stringify(data.data.user));
      router.push('/driver/pair');
    } catch { setError('Network error'); }
    finally   { setLoading(false); }
  }

  return (
    <div className="driver-shell flex flex-col" style={{ background: '#09090B' }}>

      {/* Top branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-7">
        <div className="mb-10 text-center">
          <Image src="/adkerala-logo.svg" alt="adkerala" width={160} height={45}
                 className="brightness-0 invert mx-auto mb-4" priority />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
               style={{ background: '#134E26', color: '#6EE7B7' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-kerala-400" />
            Driver Application
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="w-full space-y-4" style={{ maxWidth: 320 }}>
          <div>
            <label className="block text-xs font-semibold mb-2 tracking-wider uppercase"
                   style={{ color: '#52525B' }}>
              Email
            </label>
            <input type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-xl text-white text-base px-4 py-3.5 outline-none transition-all"
              style={{
                background: '#18181B', border: '1px solid #27272A',
                caretColor: '#6EE7B7',
              }}
              onFocus={e => (e.target.style.borderColor = '#006B3C')}
              onBlur={e  => (e.target.style.borderColor = '#27272A')} />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 tracking-wider uppercase"
                   style={{ color: '#52525B' }}>
              Password
            </label>
            <input type="password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} required
              className="w-full rounded-xl text-white text-base px-4 py-3.5 outline-none transition-all"
              style={{ background: '#18181B', border: '1px solid #27272A' }}
              onFocus={e => (e.target.style.borderColor = '#006B3C')}
              onBlur={e  => (e.target.style.borderColor = '#27272A')} />
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm"
                 style={{ background: '#450A0A', border: '1px solid #7F1D1D', color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-base transition-all"
            style={{
              background: loading ? '#064E3B' : 'linear-gradient(135deg, #006B3C 0%, #064E3B 100%)',
              color: '#fff', opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 20px rgba(0,107,60,0.35)',
            }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="py-6 flex justify-center">
        <Image src="/kerala-tourism-badge.svg" alt="Kerala Tourism" width={110} height={38}
               className="opacity-30" />
      </div>
    </div>
  );
}
