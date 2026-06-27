'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useGps, drainGpsQueue } from '@/hooks/useGps';
import { useLanSocket } from '@/hooks/useLanSocket';
import type { Stop, GpsPoint } from '@adkerala/types';

interface SessionData {
  sessionId: string; busId: string;
  route: { id: string; name: string; nameMl: string; stops: { stop: Stop; order: number }[] };
  currentStopIndex: number;
}

export default function JourneyPage() {
  const router = useRouter();
  const [session, setSession]     = useState<SessionData | null>(null);
  const [stopIndex, setStopIndex] = useState(0);
  const [socket, setSocket]       = useState<Socket | null>(null);
  const [cloudOk, setCloudOk]     = useState(false);
  const [gpsOk, setGpsOk]         = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;

  useEffect(() => {
    if (!token) { router.replace('/driver'); return; }
    const raw = sessionStorage.getItem('adkerala_session');
    if (!raw)  { router.replace('/driver/pair'); return; }
    const s = JSON.parse(raw) as SessionData;
    setSession(s);
    setStopIndex(s.currentStopIndex);
  }, [token, router]);

  useEffect(() => {
    if (!token || !session) return;
    const s = io('/driver', { auth: { token }, transports: ['websocket'] });
    setSocket(s);
    s.on('connect',    () => { setCloudOk(true); flushQueue(s, session); });
    s.on('disconnect', () => setCloudOk(false));
    s.on('driver:stop_update', ({ stopIndex: idx }: any) => setStopIndex(idx));
    return () => { s.disconnect(); };
  }, [session, token]);

  const lan = useLanSocket({
    enabled:   !!session,
    busId:     session?.busId     ?? '',
    sessionId: session?.sessionId ?? '',
  });

  const onPoint = useCallback((point: GpsPoint) => {
    if (!session) return;
    setGpsOk(true);
    lan.pushGps(point);
    if (socket?.connected) socket.emit('driver:gps', { ...point, busId: session.busId, sessionId: session.sessionId });
  }, [session, socket, lan]);

  useGps({ onPoint, onError: () => setGpsOk(false) });

  function act(action: 'forward' | 'undo' | 'announce') {
    setLastAction(action);
    setTimeout(() => setLastAction(null), 600);
    socket?.emit(`driver:${action}`, { sessionId: session?.sessionId });
    lan.sendButton(action);
  }

  async function endJourney() {
    if (!confirm('End this journey?')) return;
    socket?.emit('driver:end_session', { sessionId: session?.sessionId });
    sessionStorage.removeItem('adkerala_session');
    router.push('/driver/pair');
  }

  const stops       = session?.route.stops.sort((a, b) => a.order - b.order).map(rs => rs.stop) ?? [];
  const currentStop = stops[stopIndex];
  const nextStop    = stops[stopIndex + 1] ?? null;
  const progress    = stops.length > 1 ? ((stopIndex) / (stops.length - 1)) * 100 : 0;

  if (!session) {
    return (
      <div className="driver-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-kerala-500 animate-spin" />
          <p className="text-xs" style={{ color: '#52525B' }}>Loading session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="driver-shell flex flex-col" style={{ background: '#09090B' }}>

      {/* ── Status bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3"
           style={{ borderBottom: '1px solid #18181B' }}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: '#71717A' }}>
            {session.route.nameMl || session.route.name}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {[
            { label: 'GPS',     ok: gpsOk      },
            { label: 'Display', ok: lan.connected },
            { label: 'Cloud',   ok: cloudOk    },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-kerala-500' : 'bg-zinc-700'}`} />
              <span className="text-xs" style={{ color: ok ? '#52525B' : '#3F3F46' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div className="h-0.5 shrink-0" style={{ background: '#18181B' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: '#006B3C' }} />
      </div>

      {/* ── Current stop ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="text-xs font-semibold tracking-widest uppercase mb-4"
           style={{ color: '#3F3F46' }}>
          CURRENT STOP
        </p>
        <p className="text-4xl font-black text-white text-center leading-snug"
           style={{ fontFamily: "'Noto Sans Malayalam', sans-serif", letterSpacing: '-0.01em' }}>
          {currentStop?.nameMl || currentStop?.name || '—'}
        </p>
        {currentStop?.nameMl && (
          <p className="mt-2 text-lg text-center" style={{ color: '#52525B' }}>
            {currentStop.name}
          </p>
        )}
        <p className="mt-4 text-xs tabular-nums" style={{ color: '#3F3F46' }}>
          {stopIndex + 1} / {stops.length}
        </p>
      </div>

      {/* ── Next stop strip ──────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-4 flex items-center gap-3"
           style={{ background: '#18181B', borderTop: '1px solid #27272A', borderBottom: '1px solid #27272A' }}>
        <span className="text-xs font-semibold tracking-widest uppercase shrink-0"
              style={{ color: '#3F3F46' }}>
          NEXT
        </span>
        <span className="text-lg font-bold truncate" style={{ color: '#D4A017', fontFamily: "'Noto Sans Malayalam', sans-serif" }}>
          {nextStop?.nameMl || nextStop?.name || 'End of Route'}
        </span>
      </div>

      {/* ── Action buttons ───────────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-3 gap-2.5 p-4"
           style={{ background: '#09090B' }}>

        {/* Undo */}
        <button onClick={() => act('undo')}
          className="flex flex-col items-center gap-2 py-5 rounded-2xl transition-all active:scale-95"
          style={{
            background: lastAction === 'undo' ? '#27272A' : '#18181B',
            border: '1px solid #27272A',
          }}>
          <svg className="w-5 h-5" style={{ color: '#71717A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 010 8H9m-6-8l3-3M3 10l3 3" />
          </svg>
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#52525B' }}>Undo</span>
        </button>

        {/* Announce */}
        <button onClick={() => act('announce')}
          className="flex flex-col items-center gap-2 py-5 rounded-2xl transition-all active:scale-95"
          style={{
            background: lastAction === 'announce' ? '#134E26' : '#0D2D1A',
            border: `1px solid ${lastAction === 'announce' ? '#006B3C' : '#134E26'}`,
          }}>
          <svg className="w-5 h-5" style={{ color: '#6EE7B7' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 000-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#6EE7B7' }}>Announce</span>
        </button>

        {/* Forward */}
        <button onClick={() => act('forward')}
          className="flex flex-col items-center gap-2 py-5 rounded-2xl transition-all active:scale-95"
          style={{
            background: lastAction === 'forward' ? '#92400E' : '#451A03',
            border: `1px solid ${lastAction === 'forward' ? '#D4A017' : '#78350F'}`,
            boxShadow: '0 2px 12px rgba(212,160,23,0.15)',
          }}>
          <svg className="w-5 h-5" style={{ color: '#FCD34D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-bold tracking-wider uppercase" style={{ color: '#FCD34D' }}>Forward</span>
        </button>
      </div>

      {/* ── End journey ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex justify-center pb-6 pt-1">
        <button onClick={endJourney}
          className="text-xs px-5 py-2 rounded-lg transition-colors"
          style={{ color: '#3F3F46', background: 'transparent' }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = '#DC2626')}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = '#3F3F46')}>
          End Journey
        </button>
      </div>

    </div>
  );
}

async function flushQueue(socket: Socket, session: SessionData) {
  const points = await drainGpsQueue();
  for (const point of points) {
    socket.emit('driver:gps', { ...point, busId: session.busId, sessionId: session.sessionId });
  }
  if (points.length) console.log(`[GPS] flushed ${points.length} offline points`);
}
