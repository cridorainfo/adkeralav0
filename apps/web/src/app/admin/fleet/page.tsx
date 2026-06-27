'use client';

/**
 * Live fleet map — shows all active buses on a Kerala Mapbox map.
 * Also shows audio alert badges and lets admin click to listen to bus audio.
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GpsPoint } from '@adkerala/types';

// Mapbox GL JS is loaded via CDN script tag to avoid bundling it
declare const mapboxgl: any;

interface BusMarker {
  busId:      string;
  numberPlate: string;
  lat:        number;
  lng:        number;
  silentAlert: boolean;
}

export default function FleetPage() {
  const mapRef           = useRef<HTMLDivElement>(null);
  const mapInstance      = useRef<any>(null);
  const markers          = useRef<Record<string, any>>({});
  const [buses, setBuses] = useState<BusMarker[]>([]);
  const [listeningBus, setListeningBus] = useState<string | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const socketRef        = useRef<Socket | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;

  // ── Init Mapbox ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js';
    script.onload = () => {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      mapInstance.current = new mapboxgl.Map({
        container: mapRef.current,
        style:     'mapbox://styles/mapbox/dark-v11',
        center:    [76.27, 10.85], // Kerala centre
        zoom:      7,
      });
    };
    document.head.appendChild(script);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css';
    document.head.appendChild(link);
  }, []);

  // ── Admin socket ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const s = io('/admin', { auth: { token }, transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => s.emit('admin:subscribe_fleet'));

    s.on('admin:gps_update', ({ busId, point }: { busId: string; point: GpsPoint }) => {
      updateMarker(busId, point.lat, point.lng);
      setBuses((prev) => {
        const existing = prev.find(b => b.busId === busId);
        if (!existing) return prev;
        return prev.map(b => b.busId === busId ? { ...b, lat: point.lat, lng: point.lng } : b);
      });
    });

    s.on('admin:audio_event', ({ busId, event }: { busId: string; event: string }) => {
      if (event === 'silent') {
        setBuses((prev) => prev.map(b => b.busId === busId ? { ...b, silentAlert: true } : b));
      }
    });

    s.on('admin:audio_chunk', ({ busId, chunk }: { busId: string; chunk: string }) => {
      if (busId !== listeningBus) return;
      playAudioChunk(chunk);
    });

    // Fetch current fleet state
    fetch('/api/buses?orgId=all', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setBuses(d.data.map((b: any) => ({
            busId:      b.id,
            numberPlate: b.numberPlate,
            lat:        b.lastLat ?? 10.85,
            lng:        b.lastLng ?? 76.27,
            silentAlert: false,
          })));
        }
      });

    return () => { s.disconnect(); };
  }, [token]);

  // ── Update Mapbox marker ──────────────────────────────────────────────
  function updateMarker(busId: string, lat: number, lng: number) {
    if (!mapInstance.current) return;
    if (markers.current[busId]) {
      markers.current[busId].setLngLat([lng, lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'bus-dot';
      el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#f97316;border:2px solid white;cursor:pointer;';
      markers.current[busId] = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapInstance.current);
    }
  }

  // ── Audio listening ───────────────────────────────────────────────────
  function startListening(busId: string) {
    setListeningBus(busId);
    socketRef.current?.emit('admin:listen_bus', { busId });
    audioCtxRef.current = new AudioContext();
  }

  function stopListening() {
    if (listeningBus) socketRef.current?.emit('admin:unlisten_bus', { busId: listeningBus });
    setListeningBus(null);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }

  function playAudioChunk(base64: string) {
    if (!audioCtxRef.current) return;
    const binary = atob(base64);
    const buf    = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    audioCtxRef.current.decodeAudioData(buf.buffer, (decoded) => {
      const src = audioCtxRef.current!.createBufferSource();
      src.buffer = decoded;
      src.connect(audioCtxRef.current!.destination);
      src.start();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Live Fleet</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 h-[500px] rounded-xl overflow-hidden border border-slate-700">
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Bus list */}
        <div className="space-y-2 overflow-y-auto max-h-[500px]">
          {buses.map((b) => (
            <div
              key={b.busId}
              className="bg-slate-800 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-mono font-bold">{b.numberPlate}</p>
                {b.silentAlert && (
                  <p className="text-red-400 text-xs mt-0.5">⚠ Silent alert</p>
                )}
              </div>
              <button
                onClick={() => listeningBus === b.busId ? stopListening() : startListening(b.busId)}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  listeningBus === b.busId
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                }`}
              >
                {listeningBus === b.busId ? '■ Stop' : '🎧 Listen'}
              </button>
            </div>
          ))}
          {buses.length === 0 && (
            <p className="text-slate-500 text-sm">No buses online</p>
          )}
        </div>
      </div>
    </div>
  );
}
