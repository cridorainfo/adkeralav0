'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import Image from 'next/image';

export default function PairPage() {
  const router = useRouter();
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket]   = useState<Socket | null>(null);
  const [digits, setDigits]   = useState(['', '', '', '', '', '']);

  const user  = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adkerala_user') || 'null') : null;
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;

  useEffect(() => {
    if (!token) { router.replace('/driver'); return; }
    const s = io('/driver', { auth: { token }, transports: ['websocket'] });
    setSocket(s);
    s.on('driver:paired', (data: any) => {
      sessionStorage.setItem('adkerala_session', JSON.stringify(data));
      router.push('/driver/journey');
    });
    s.on('driver:error', ({ message }: { message: string }) => {
      setError(message); setLoading(false);
    });
    return () => { s.disconnect(); };
  }, [token, router]);

  function handleDigit(val: string, idx: number) {
    const d = [...digits];
    d[idx] = val.replace(/\D/g, '').slice(-1);
    setDigits(d);
    const full = d.join('');
    setCode(full);
    if (val && idx < 5) {
      const next = document.getElementById(`digit-${idx + 1}`);
      (next as HTMLInputElement)?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      const prev = document.getElementById(`digit-${idx - 1}`);
      (prev as HTMLInputElement)?.focus();
    }
  }

  function handlePair(e: React.FormEvent) {
    e.preventDefault();
    if (!socket || !user || code.length !== 6) return;
    setError(''); setLoading(true);
    socket.emit('driver:pair', { pairingCode: code.trim(), driverId: user.id });
  }

  return (
    <div className="driver-shell flex flex-col items-center justify-between py-10 px-6"
         style={{ background: '#09090B' }}>

      {/* Header */}
      <div className="text-center">
        <Image src="/adkerala-logo.svg" alt="adkerala" width={140} height={40}
               className="brightness-0 invert mx-auto mb-3" priority />
        {user && (
          <div>
            <p className="text-sm font-semibold" style={{ color: '#E4E4E7' }}>{user.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>{user.email}</p>
          </div>
        )}
      </div>

      {/* Code entry */}
      <div className="w-full space-y-6" style={{ maxWidth: 340 }}>
        <div className="text-center">
          <p className="font-semibold text-lg" style={{ color: '#E4E4E7' }}>Pair with Display</p>
          <p className="text-sm mt-1" style={{ color: '#52525B' }}>
            Enter the 6-digit code shown on the bus screen
          </p>
        </div>

        <form onSubmit={handlePair} className="space-y-5">
          {/* OTP input row */}
          <div className="flex gap-2.5 justify-center">
            {digits.map((d, i) => (
              <input key={i} id={`digit-${i}`}
                type="text" inputMode="numeric" maxLength={1} value={d}
                onChange={e => handleDigit(e.target.value, i)}
                onKeyDown={e => handleKeyDown(e, i)}
                className="w-11 h-14 rounded-xl text-center text-2xl font-bold text-white outline-none transition-all"
                style={{
                  background: '#18181B',
                  border: `1.5px solid ${d ? '#006B3C' : '#27272A'}`,
                  boxShadow: d ? '0 0 0 3px rgba(0,107,60,0.15)' : 'none',
                }}
              />
            ))}
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm text-center"
                 style={{ background: '#450A0A', border: '1px solid #7F1D1D', color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          <button type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-4 rounded-xl font-bold text-base transition-all"
            style={{
              background: code.length === 6
                ? 'linear-gradient(135deg, #D4A017 0%, #B45309 100%)'
                : '#18181B',
              color: code.length === 6 ? '#022C22' : '#3F3F46',
              border: `1px solid ${code.length === 6 ? '#B45309' : '#27272A'}`,
              boxShadow: code.length === 6 ? '0 4px 20px rgba(212,160,23,0.30)' : 'none',
            }}>
            {loading ? 'Pairing…' : 'Pair & Start Journey'}
          </button>
        </form>
      </div>

      {/* Logout */}
      <button onClick={() => { sessionStorage.clear(); router.push('/driver'); }}
        className="text-xs transition-colors"
        style={{ color: '#3F3F46' }}
        onMouseEnter={e => ((e.target as HTMLElement).style.color = '#71717A')}
        onMouseLeave={e => ((e.target as HTMLElement).style.color = '#3F3F46')}>
        Sign out
      </button>
    </div>
  );
}
