'use client';

/**
 * Display kiosk page — runs fullscreen on Android TV or in Electron.
 *
 * Layout:
 *   - TOP 78%: current stop (large) + banner ad at bottom of this area
 *   - BOTTOM 22%: ad display (banner overlay or fullscreen ad)
 *   - FIXED STRIP: next stop always visible at bottom regardless of ad format
 *
 * Audio: plays stop announcement MP3 on each advance/announce event.
 * Impression: reported back to cloud socket after ad plays.
 */

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Stop, Advertisement } from '@adkerala/types';

interface SessionState {
  sessionId:   string;
  routeId:     string;
  districtId:  string;
  busId:       string;
  pairingCode: string;
  pairingExpiry: number;
}

export default function DisplayPage() {
  const [session, setSession]       = useState<SessionState | null>(null);
  const [currentStop, setCurrentStop] = useState<Stop | null>(null);
  const [nextStop, setNextStop]     = useState<Stop | null>(null);
  const [playingAd, setPlayingAd]   = useState<Advertisement | null>(null);
  const [pairingCode, setPairingCode] = useState<string>('');
  const [adQueue, setAdQueue]       = useState<Advertisement[]>([]);
  const socketRef   = useRef<Socket | null>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const adTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRef    = useRef<MediaRecorder | null>(null);

  const busId       = typeof window !== 'undefined' ? localStorage.getItem('adkerala_bus_id') : null;
  const token       = typeof window !== 'undefined' ? localStorage.getItem('adkerala_display_token') : null;

  // ── Cloud socket connection ──────────────────────────────────────────
  useEffect(() => {
    if (!token || !busId) return;

    const s = io('/display', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = s;

    // Pairing code shown before any session
    s.on('display:pairing_code', ({ code, expiresInSeconds }: { code: string; expiresInSeconds: number }) => {
      setPairingCode(code);
    });

    s.on('display:session_start', ({ session: sess, route }: any) => {
      setSession({
        sessionId:  sess.id,
        routeId:    route.id,
        districtId: route.districtId,
        busId,
        pairingCode: '',
        pairingExpiry: 0,
      });
      const stops = route.stops.sort((a: any, b: any) => a.order - b.order).map((rs: any) => rs.stop);
      setCurrentStop(stops[0] ?? null);
      setNextStop(stops[1] ?? null);
      loadAds(busId, route.id, route.districtId);
    });

    s.on('display:stop_advance', ({ stop, nextStop: ns }: any) => {
      setCurrentStop(stop);
      setNextStop(ns);
      playAudio(stop.audioUrl);
    });

    s.on('display:stop_undo', ({ stop, nextStop: ns }: any) => {
      setCurrentStop(stop);
      setNextStop(ns);
    });

    s.on('display:announce', ({ stop }: any) => {
      playAudio(stop.audioUrl);
    });

    s.on('display:session_end', () => {
      setSession(null);
      setCurrentStop(null);
      setNextStop(null);
      setPlayingAd(null);
    });

    s.on('display:ad_play', ({ ad }: { ad: Advertisement }) => {
      showAd(ad, s);
    });

    return () => { s.disconnect(); };
  }, [token, busId]);

  // ── Load eligible ads on session start ──────────────────────────────
  async function loadAds(bid: string, routeId: string, districtId: string) {
    if (!token) return;
    const res  = await fetch(`/api/ads/eligible?busId=${bid}&routeId=${routeId}&districtId=${districtId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) {
      setAdQueue(data.data);
      scheduleNextAd(data.data);
    }
  }

  // ── Ad scheduling: rotate ads every 30 s ────────────────────────────
  function scheduleNextAd(queue: Advertisement[]) {
    adTimerRef.current && clearTimeout(adTimerRef.current);
    if (!queue.length) return;
    adTimerRef.current = setTimeout(() => {
      const ad = queue[Math.floor(Math.random() * queue.length)];
      showAd(ad, socketRef.current!);
    }, 30_000);
  }

  function showAd(ad: Advertisement, socket: Socket) {
    if (!session) return;
    setPlayingAd(ad);

    setTimeout(() => {
      setPlayingAd(null);
      scheduleNextAd(adQueue);

      // Report impression
      socket.emit('display:impression', {
        adId:            ad.id,
        campaignId:      ad.campaignId,
        busId:           session.busId,
        sessionId:       session.sessionId,
        routeId:         session.routeId,
        districtId:      session.districtId,
        format:          ad.format,
        durationSeconds: ad.durationSeconds,
        advertisedAt:    new Date().toISOString(),
      });
    }, ad.durationSeconds * 1000);
  }

  // ── Audio playback ────────────────────────────────────────────────────
  function playAudio(url: string | null) {
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
  }

  // ── Audio monitoring (stream to admin) ───────────────────────────────
  useEffect(() => {
    if (!session || !socketRef.current) return;
    startAudioMonitoring(socketRef.current, session.busId, session.sessionId);
  }, [session?.sessionId]);

  function startAudioMonitoring(socket: Socket, bid: string, sid: string) {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRef.current = recorder;

      // Volume detection for silent event
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data     = new Uint8Array(analyser.frequencyBinCount);

      const silenceCheck = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const vol = data.reduce((a, b) => a + b, 0) / data.length;
        if (vol < 5 && currentStop) {
          socket.emit('display:audio_event', { busId: bid, sessionId: sid, event: 'silent', stopName: currentStop.name });
        }
      }, 500);

      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (reader.result as string).split(',')[1];
          socket.emit('display:audio_chunk', { busId: bid, sessionId: sid, chunk: b64 });
        };
        reader.readAsDataURL(e.data);
      };

      recorder.start(500); // 500ms chunks

      return () => {
        clearInterval(silenceCheck);
        recorder.stop();
        stream.getTracks().forEach(t => t.stop());
      };
    }).catch(() => {});
  }

  // ── Pairing screen (no active session) ────────────────────────────────
  if (!session) {
    return (
      <div className="display-root flex flex-col" style={{ background: '#09090B' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-10 py-6"
             style={{ borderBottom: '1px solid #18181B' }}>
          <img src="/adkerala-logo.svg" alt="adkerala" className="h-9 brightness-0 invert opacity-80" />
          <div className="flex items-center gap-2 text-sm" style={{ color: '#3F3F46' }}>
            <span className={`w-2 h-2 rounded-full ${pairingCode ? 'bg-kerala-500' : 'bg-zinc-700 animate-pulse'}`} />
            {pairingCode ? 'Ready to pair' : 'Connecting…'}
          </div>
        </div>

        {/* Main pairing content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          {pairingCode ? (
            <>
              <div className="text-center">
                <p className="text-sm font-semibold tracking-widest uppercase mb-6"
                   style={{ color: '#52525B' }}>
                  SHOW THIS CODE TO THE DRIVER
                </p>
                {/* Code display — large, monospaced, split into 2 groups of 3 */}
                <div className="flex items-center gap-5">
                  {['012', '345'].map((_, groupIdx) => (
                    <div key={groupIdx} className="flex gap-2.5">
                      {[0,1,2].map(i => {
                        const idx = groupIdx * 3 + i;
                        return (
                          <div key={idx}
                               className="w-[7vw] h-[10vw] rounded-2xl flex items-center justify-center"
                               style={{ background: '#18181B', border: '1px solid #27272A' }}>
                            <span className="text-[5vw] font-black text-white font-mono"
                                  style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {pairingCode[idx]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-sm" style={{ color: '#3F3F46' }}>
                  Refreshes every 5 minutes
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-5">
              <div className="w-14 h-14 rounded-full border-2 animate-spin"
                   style={{ borderColor: '#27272A', borderTopColor: '#006B3C' }} />
              <p className="text-sm" style={{ color: '#3F3F46' }}>Connecting to cloud…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center py-6"
             style={{ borderTop: '1px solid #18181B' }}>
          <img src="/kerala-tourism-badge.svg" alt="Kerala Tourism" className="h-10 opacity-25" />
        </div>
      </div>
    );
  }

  const isBannerAd     = playingAd?.format === 'banner';
  const isFullscreenAd = playingAd?.format === 'fullscreen';

  return (
    <div className="display-root relative" style={{ background: '#09090B' }}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-8 py-3 z-30"
           style={{ background: 'rgba(9,9,11,0.85)', borderBottom: '1px solid #18181B', backdropFilter: 'blur(8px)' }}>
        <img src="/adkerala-logo.svg" alt="adkerala" className="h-6 brightness-0 invert opacity-30" />
        <div className="flex items-center gap-2 text-xs" style={{ color: '#3F3F46' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-kerala-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* ── Main content area (~78%) ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">

        {/* Current stop */}
        <div className="text-center px-12">
          <p className="text-[1.4vw] font-semibold tracking-[0.3em] uppercase mb-[2vw]"
             style={{ color: '#3F3F46' }}>
            നിലവിലെ സ്റ്റോപ്പ്  ·  Current Stop
          </p>
          <p className="font-black text-white leading-tight text-[7.5vw]"
             style={{ fontFamily: "'Noto Sans Malayalam', sans-serif", letterSpacing: '-0.02em' }}>
            {currentStop?.nameMl || currentStop?.name || '—'}
          </p>
          {currentStop?.nameMl && (
            <p className="text-[2.2vw] mt-[1vw]" style={{ color: '#52525B' }}>
              {currentStop.name}
            </p>
          )}
        </div>

        {/* Fullscreen ad overlay */}
        {isFullscreenAd && (
          <div className="absolute inset-0 z-10">
            <img src={playingAd.mediaUrl} alt="Ad" className="w-full h-full object-cover" />
            <div className="absolute top-6 right-6 rounded-2xl px-5 py-3"
                 style={{ background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)', border: '1px solid #27272A' }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#52525B' }}>Next Stop</p>
              <p className="text-2xl font-bold text-white"
                 style={{ fontFamily: "'Noto Sans Malayalam', sans-serif" }}>
                {nextStop?.nameMl || nextStop?.name || 'End of Route'}
              </p>
            </div>
          </div>
        )}

        {/* Banner ad */}
        {isBannerAd && (
          <div className="absolute bottom-0 left-0 right-0 h-[22%] z-10">
            <img src={playingAd.mediaUrl} alt="Ad" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* ── Next Stop strip (always visible, amber) ──────────────────── */}
      <div className="h-[22%] flex flex-col items-center justify-center z-20 shrink-0 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #D4A017 0%, #B45309 100%)' }}>
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }} />
        <p className="relative text-[1.2vw] font-semibold tracking-[0.25em] uppercase mb-[0.8vw]"
           style={{ color: '#451A03', opacity: 0.7 }}>
          അടുത്ത സ്റ്റോപ്പ്  ·  Next Stop
        </p>
        <p className="relative font-black leading-tight text-[4.8vw] text-center px-8"
           style={{ color: '#09090B', fontFamily: "'Noto Sans Malayalam', sans-serif", letterSpacing: '-0.02em' }}>
          {nextStop?.nameMl || nextStop?.name || 'End of Route'}
        </p>
        {nextStop?.nameMl && (
          <p className="relative text-[1.6vw] mt-[0.5vw]" style={{ color: '#451A03', opacity: 0.65 }}>
            {nextStop.name}
          </p>
        )}
      </div>
    </div>
  );
}
