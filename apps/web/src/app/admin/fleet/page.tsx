'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface BusState {
  busId:       string;
  numberPlate: string;
  routeName:   string;
  driverName:  string;
  currentStop: string | null;
  nextStop:    string | null;
  lat:         number;
  lng:         number;
  speed:       number;
  heading:     number | null;
  updatedAt:   number;
  silentAlert: boolean;
  isIdle?:     boolean;
}

interface IdleBus {
  busId: string; numberPlate: string; name: string | null;
  lat: number; lng: number; lastSeen: string; isIdle: true;
}

type AnyBus = BusState | IdleBus;

/* ─── Kerala geographic constants ─────────────────────────────────────────── */
const KERALA_CENTER: [number, number] = [10.52, 76.21];
const KERALA_ZOOM = 7;
const KERALA_BOUNDS: [[number, number], [number, number]] = [[8.07, 74.85], [12.78, 77.42]];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}
function isActive(b: AnyBus): boolean {
  if ((b as BusState).updatedAt) return Date.now() - (b as BusState).updatedAt < 5 * 60 * 1000;
  return false;
}

/* ─── Custom bus SVG marker ───────────────────────────────────────────────── */
function busMarkerSvg(active: boolean, selected: boolean, heading: number | null) {
  const color  = selected ? '#FBBF24' : active ? '#22C55E' : '#71717A';
  const rotate = heading != null ? `transform="rotate(${heading} 16 16)"` : '';
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
  ${active ? `<circle cx="16" cy="16" r="15" fill="${color}" opacity="0.18">
    <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite"/>
  </circle>` : ''}
  <g ${rotate}>
    <rect x="4" y="6" width="24" height="18" rx="4" fill="${color}" stroke="white" stroke-width="1.5"/>
    <rect x="6" y="9" width="7" height="5" rx="1" fill="white" opacity="0.85"/>
    <rect x="15" y="9" width="7" height="5" rx="1" fill="white" opacity="0.85"/>
    <rect x="7" y="16" width="18" height="2" rx="1" fill="white" opacity="0.5"/>
    <circle cx="9" cy="26" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="23" cy="26" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
  </g>
  ${heading != null ? `<polygon points="16,0 12,8 20,8" fill="${color}" opacity="0.9"/>` : ''}
</svg>`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Fleet Map Page
   ══════════════════════════════════════════════════════════════════════════════ */
export default function FleetPage() {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;

  const mapRef       = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<any>(null);
  const markersRef   = useRef<Map<string, any>>(new Map());
  const popupsRef    = useRef<Map<string, any>>(new Map());
  const socketRef    = useRef<Socket | null>(null);
  const leafletRef   = useRef<any>(null);
  const mapReady     = useRef(false);

  const [buses, setBuses]         = useState<Map<string, AnyBus>>(new Map());
  const [selected, setSelected]   = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'all' | 'active' | 'idle' | 'alert'>('all');
  const [tracking, setTracking]   = useState<string | null>(null);
  const [leafletOk, setLeafletOk] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats]         = useState({ active: 0, idle: 0, alert: 0 });

  /* ── Load Leaflet from CDN ──────────────────────────────────────────── */
  useEffect(() => {
    if (leafletRef.current) return;

    // CSS
    const css = document.createElement('link');
    css.rel   = 'stylesheet';
    css.href  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);

    // JS
    const script = document.createElement('script');
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => {
      leafletRef.current = (window as any).L;
      setLeafletOk(true);
    };
    document.head.appendChild(script);
  }, []);

  /* ── Init map once Leaflet ready ────────────────────────────────────── */
  useEffect(() => {
    if (!leafletOk || !mapRef.current || mapInstance.current) return;
    const L = leafletRef.current;

    const map = L.map(mapRef.current, {
      center:        KERALA_CENTER,
      zoom:          KERALA_ZOOM,
      maxBounds:     L.latLngBounds(KERALA_BOUNDS[0], KERALA_BOUNDS[1]),
      maxBoundsViscosity: 0.85,
      zoomControl:   false,
    });

    // Tile layer — CartoDB dark (premium look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains:  'abcd',
      maxZoom:     19,
    }).addTo(map);

    // Custom zoom control (bottom-right)
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Scale
    L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

    mapInstance.current = map;
    mapReady.current    = true;

    // Load initial bus data
    loadInitialData();
  }, [leafletOk]);

  /* ── Load initial REST data ─────────────────────────────────────────── */
  async function loadInitialData() {
    try {
      const res  = await fetch('/api/fleet', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.ok) return;

      const map = new Map<string, AnyBus>();
      data.data.active.forEach((b: BusState) => { map.set(b.busId, b); });
      data.data.idle.forEach((b: IdleBus)    => { map.set(b.busId, b); });
      setBuses(map);
      syncMarkersToState(map);
    } catch (e) { console.error('[fleet] loadInitialData', e); }
  }

  /* ── Socket.IO subscription ─────────────────────────────────────────── */
  useEffect(() => {
    if (!token) return;

    const s = io('/admin', { auth: { token }, transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => {
      s.emit('admin:subscribe_fleet');
    });

    // Full snapshot (on subscribe or manual refresh)
    s.on('admin:fleet_snapshot', ({ buses: list }: { buses: BusState[] }) => {
      setBuses(prev => {
        const next = new Map(prev);
        list.forEach(b => next.set(b.busId, b));
        return next;
      });
    });

    // Individual bus update (GPS / stop change)
    s.on('admin:bus_update', (b: BusState) => {
      setBuses(prev => {
        const next = new Map(prev);
        next.set(b.busId, b);
        return next;
      });
      updateMarker(b);
      // Auto-track
      if (tracking === b.busId && mapInstance.current) {
        mapInstance.current.panTo([b.lat, b.lng], { animate: true, duration: 0.5 });
      }
    });

    // Bus removed (session ended)
    s.on('admin:bus_removed', ({ busId }: { busId: string }) => {
      setBuses(prev => { const next = new Map(prev); next.delete(busId); return next; });
      removeMarker(busId);
    });

    return () => { s.disconnect(); };
  }, [token, tracking]);

  /* ── Sync all markers when buses state changes ──────────────────────── */
  useEffect(() => {
    syncMarkersToState(buses);
    const activeCount = [...buses.values()].filter(b => isActive(b)).length;
    const idleCount   = [...buses.values()].filter(b => !isActive(b)).length;
    const alertCount  = [...buses.values()].filter(b => (b as BusState).silentAlert).length;
    setStats({ active: activeCount, idle: idleCount, alert: alertCount });
  }, [buses, selected]);

  /* ── Marker helpers ─────────────────────────────────────────────────── */
  function syncMarkersToState(map: Map<string, AnyBus>) {
    if (!mapInstance.current || !leafletRef.current) return;
    map.forEach(bus => updateMarker(bus));
    // Remove markers not in state
    markersRef.current.forEach((_, id) => {
      if (!map.has(id)) removeMarker(id);
    });
  }

  function updateMarker(bus: AnyBus) {
    if (!mapInstance.current || !leafletRef.current) return;
    const L      = leafletRef.current;
    const active = isActive(bus);
    const isSel  = selected === bus.busId;
    const b = bus as BusState;

    const icon = L.divIcon({
      html:      busMarkerSvg(active, isSel, b.heading ?? null),
      className: '',
      iconSize:  [32, 38],
      iconAnchor:[16, 19],
      popupAnchor:[0, -20],
    });

    if (markersRef.current.has(bus.busId)) {
      const m = markersRef.current.get(bus.busId)!;
      m.setLatLng([bus.lat, bus.lng]);
      m.setIcon(icon);
    } else {
      const m = L.marker([bus.lat, bus.lng], { icon })
        .addTo(mapInstance.current)
        .on('click', () => {
          setSelected(id => id === bus.busId ? null : bus.busId);
          mapInstance.current?.panTo([bus.lat, bus.lng], { animate: true });
        });
      markersRef.current.set(bus.busId, m);
    }
  }

  function removeMarker(busId: string) {
    const m = markersRef.current.get(busId);
    if (m && mapInstance.current) mapInstance.current.removeLayer(m);
    markersRef.current.delete(busId);
  }

  /* ── Fly to bus ─────────────────────────────────────────────────────── */
  function flyTo(bus: AnyBus) {
    if (!mapInstance.current) return;
    setSelected(bus.busId);
    mapInstance.current.flyTo([bus.lat, bus.lng], 14, { animate: true, duration: 1.2 });
  }

  /* ── Fit all buses ──────────────────────────────────────────────────── */
  function fitAll() {
    if (!mapInstance.current || !leafletRef.current || buses.size === 0) return;
    const L = leafletRef.current;
    const points = [...buses.values()].map(b => [b.lat, b.lng] as [number, number]);
    mapInstance.current.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
    setSelected(null);
    setTracking(null);
  }

  /* ── Filtered bus list ──────────────────────────────────────────────── */
  const filteredBuses = [...buses.values()].filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || b.numberPlate.toLowerCase().includes(q)
      || (b as BusState).routeName?.toLowerCase().includes(q)
      || (b as BusState).driverName?.toLowerCase().includes(q)
      || (b as BusState).currentStop?.toLowerCase().includes(q);
    const matchFilter =
      filter === 'all'    ? true :
      filter === 'active' ? isActive(b) :
      filter === 'idle'   ? !isActive(b) :
      filter === 'alert'  ? !!(b as BusState).silentAlert : true;
    return matchSearch && matchFilter;
  }).sort((a, b) => {
    // Active buses first, then by most recent update
    if (isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1;
    return ((b as BusState).updatedAt ?? 0) - ((a as BusState).updatedAt ?? 0);
  });

  const selectedBus = selected ? buses.get(selected) : null;

  return (
    <div className="flex h-full -m-4 sm:-m-6 lg:-m-7 overflow-hidden" style={{ background: '#09090B' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className={`flex flex-col shrink-0 transition-all duration-300 ease-out
                       ${sidebarOpen ? 'w-[300px] sm:w-[320px]' : 'w-0 overflow-hidden'}`}
           style={{ background: '#0C0C0E', borderRight: '1px solid #1C1C1F' }}>

        {/* Header */}
        <div className="px-4 py-3.5 flex items-center justify-between"
             style={{ borderBottom: '1px solid #1C1C1F' }}>
          <div>
            <h2 className="text-sm font-bold text-white">Live Fleet</h2>
            <p className="text-xs mt-0.5" style={{ color: '#52525B' }}>
              {stats.active} active · {stats.idle} idle
              {stats.alert > 0 && ` · ${stats.alert} alerts`}
            </p>
          </div>
          <button onClick={() => { socketRef.current?.emit('admin:get_fleet'); }}
            className="text-xs px-2.5 py-1.5 rounded-lg transition-colors tap-target"
            style={{ background: '#18181B', color: '#71717A', border: '1px solid #27272A' }}
            title="Refresh">
            ↻
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #1C1C1F' }}>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                 style={{ color: '#52525B' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search plate, route, stop, driver…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-white outline-none"
              style={{ background: '#18181B', border: '1px solid #27272A', caretColor: '#22C55E' }} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">✕</button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 px-3 py-2.5" style={{ borderBottom: '1px solid #1C1C1F' }}>
          {([
            { key: 'all',    label: 'All',    count: buses.size },
            { key: 'active', label: 'Active', count: stats.active },
            { key: 'idle',   label: 'Idle',   count: stats.idle },
            ...(stats.alert > 0 ? [{ key: 'alert', label: '⚠ Alert', count: stats.alert }] : []),
          ] as { key: string; label: string; count: number }[]).map(f => (
            <button key={f.key}
              onClick={() => setFilter(f.key as any)}
              className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: filter === f.key ? '#006B3C' : '#18181B',
                color:      filter === f.key ? '#fff' : '#71717A',
                border:     `1px solid ${filter === f.key ? '#006B3C' : '#27272A'}`,
              }}>
              {f.label} <span className="opacity-60">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Bus list */}
        <div className="flex-1 overflow-y-auto scroll-smooth-ios">
          {filteredBuses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p className="text-xs" style={{ color: '#3F3F46' }}>No buses found</p>
            </div>
          ) : filteredBuses.map(bus => {
            const b     = bus as BusState;
            const active = isActive(bus);
            const isSel  = selected === bus.busId;
            return (
              <button key={bus.busId}
                onClick={() => flyTo(bus)}
                className="w-full text-left px-3 py-3 transition-all"
                style={{
                  background:   isSel ? 'rgba(0,107,60,0.15)' : 'transparent',
                  borderLeft:   `3px solid ${isSel ? '#22C55E' : 'transparent'}`,
                  borderBottom: '1px solid #1C1C1F',
                }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-zinc-600'}`} />
                      <span className="font-bold text-xs text-white font-mono">{bus.numberPlate}</span>
                      {b.silentAlert && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: '#450A0A', color: '#FCA5A5' }}>SILENT</span>
                      )}
                    </div>
                    {b.routeName && (
                      <p className="text-xs truncate" style={{ color: '#6EE7B7' }}>{b.routeName}</p>
                    )}
                    {b.currentStop && (
                      <p className="text-xs truncate mt-0.5" style={{ color: '#52525B' }}>
                        @ {b.currentStop}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {active && b.speed > 0 && (
                      <p className="text-xs font-mono font-bold" style={{ color: '#D4A017' }}>
                        {Math.round(b.speed)} <span style={{ color: '#52525B' }}>km/h</span>
                      </p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: '#3F3F46' }}>
                      {b.updatedAt ? timeAgo(b.updatedAt) : '—'}
                    </p>
                    {tracking === bus.busId && (
                      <p className="text-xs" style={{ color: '#22C55E' }}>● tracking</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Fit all button */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid #1C1C1F' }}>
          <button onClick={fitAll}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#18181B', color: '#71717A', border: '1px solid #27272A' }}>
            Show all buses on map
          </button>
        </div>
      </div>

      {/* ── Map area ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-w-0">

        {/* Sidebar toggle */}
        <button onClick={() => setSidebarOpen(o => !o)}
          className="absolute top-3 left-3 z-[1000] flex items-center justify-center
                     w-8 h-8 rounded-lg transition-all"
          style={{ background: 'rgba(12,12,14,0.9)', border: '1px solid #27272A', color: '#A1A1AA',
                   backdropFilter: 'blur(8px)' }}>
          {sidebarOpen ? '←' : '→'}
        </button>

        {/* Top-right controls */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <button onClick={fitAll}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            style={{ background: 'rgba(12,12,14,0.9)', border: '1px solid #27272A',
                     color: '#A1A1AA', backdropFilter: 'blur(8px)' }}>
            <span>⊕</span> Fit Kerala
          </button>
          {selected && (
            <button
              onClick={() => setTracking(t => t === selected ? null : selected)}
              className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
              style={{
                background:   tracking === selected ? 'rgba(0,107,60,0.85)' : 'rgba(12,12,14,0.9)',
                border:       `1px solid ${tracking === selected ? '#22C55E' : '#27272A'}`,
                color:        tracking === selected ? '#fff' : '#A1A1AA',
                backdropFilter: 'blur(8px)',
              }}>
              {tracking === selected ? '● Tracking' : '◎ Track bus'}
            </button>
          )}
        </div>

        {/* Loading state */}
        {!leafletOk && (
          <div className="absolute inset-0 flex items-center justify-center z-[500]"
               style={{ background: '#09090B' }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 animate-spin"
                   style={{ borderColor: '#27272A', borderTopColor: '#22C55E' }} />
              <p className="text-sm" style={{ color: '#52525B' }}>Loading map…</p>
            </div>
          </div>
        )}

        {/* Map container */}
        <div ref={mapRef} className="w-full h-full" style={{ zIndex: 1 }} />

        {/* ── Selected bus detail card ──────────────────────────────── */}
        {selectedBus && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-[min(420px,90vw)]
                          rounded-2xl p-4 animate-scale-in"
               style={{ background: 'rgba(12,12,14,0.96)', border: '1px solid #27272A',
                        backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${isActive(selectedBus) ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
                  <span className="font-bold text-white font-mono">{selectedBus.numberPlate}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: isActive(selectedBus) ? '#134E26' : '#27272A',
                                 color: isActive(selectedBus) ? '#6EE7B7' : '#71717A' }}>
                    {isActive(selectedBus) ? 'Active' : 'Idle'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {(selectedBus as BusState).routeName && (
                    <>
                      <span style={{ color: '#52525B' }}>Route</span>
                      <span className="text-white truncate">{(selectedBus as BusState).routeName}</span>
                    </>
                  )}
                  {(selectedBus as BusState).driverName && (
                    <>
                      <span style={{ color: '#52525B' }}>Driver</span>
                      <span className="text-white">{(selectedBus as BusState).driverName}</span>
                    </>
                  )}
                  {(selectedBus as BusState).currentStop && (
                    <>
                      <span style={{ color: '#52525B' }}>Current stop</span>
                      <span style={{ color: '#6EE7B7' }} className="truncate">{(selectedBus as BusState).currentStop}</span>
                    </>
                  )}
                  {(selectedBus as BusState).nextStop && (
                    <>
                      <span style={{ color: '#52525B' }}>Next stop</span>
                      <span style={{ color: '#D4A017' }} className="truncate">{(selectedBus as BusState).nextStop}</span>
                    </>
                  )}
                  {(selectedBus as BusState).speed > 0 && (
                    <>
                      <span style={{ color: '#52525B' }}>Speed</span>
                      <span className="text-white">{Math.round((selectedBus as BusState).speed)} km/h</span>
                    </>
                  )}
                  <span style={{ color: '#52525B' }}>Coordinates</span>
                  <span className="text-white font-mono text-xs">
                    {selectedBus.lat.toFixed(5)}, {selectedBus.lng.toFixed(5)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => setTracking(t => t === selectedBus.busId ? null : selectedBus.busId)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: tracking === selectedBus.busId ? '#006B3C' : '#18181B',
                    color:      tracking === selectedBus.busId ? '#fff' : '#71717A',
                    border:     `1px solid ${tracking === selectedBus.busId ? '#22C55E' : '#27272A'}`,
                  }}>
                  {tracking === selectedBus.busId ? '● Live' : 'Track'}
                </button>
                <button onClick={() => setSelected(null)}
                  className="px-3 py-1.5 rounded-lg text-xs transition-all text-zinc-500 hover:text-white"
                  style={{ background: '#18181B', border: '1px solid #27272A' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {leafletOk && buses.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
            <div className="text-center p-6 rounded-2xl"
                 style={{ background: 'rgba(12,12,14,0.8)', backdropFilter: 'blur(12px)', border: '1px solid #27272A' }}>
              <p className="text-3xl mb-2">🚌</p>
              <p className="text-sm font-semibold text-white">No buses on map</p>
              <p className="text-xs mt-1" style={{ color: '#52525B' }}>Buses appear when drivers start a journey</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Leaflet attribution override ─────────────────────────────── */}
      <style>{`
        .leaflet-control-attribution {
          background: rgba(12,12,14,0.8) !important;
          color: #3F3F46 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #52525B !important; }
        .leaflet-control-zoom a {
          background: rgba(12,12,14,0.9) !important;
          border-color: #27272A !important;
          color: #A1A1AA !important;
        }
        .leaflet-control-zoom a:hover { background: #18181B !important; color: #fff !important; }
        .leaflet-bar { border: 1px solid #27272A !important; box-shadow: none !important; }
      `}</style>
    </div>
  );
}
