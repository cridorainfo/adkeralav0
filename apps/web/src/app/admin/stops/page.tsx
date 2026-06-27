'use client';

import { useState, useEffect } from 'react';

interface Stop {
  id: string; name: string; nameMl: string; lat: number; lng: number;
  geofenceRadius: number; audioUrl: string | null;
}

export default function StopsPage() {
  const token  = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;
  const user   = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adkerala_user') || 'null') : null;
  const orgId  = user?.orgId;

  const [stops, setStops]   = useState<Stop[]>([]);
  const [query, setQuery]   = useState('');
  const [form, setForm]     = useState({ name: '', nameMl: '', lat: '', lng: '', geofenceRadius: '50' });
  const [genTts, setGenTts] = useState(false);

  async function loadStops() {
    const res  = await fetch(`/api/stops?orgId=${orgId}&q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) setStops(data.data);
  }

  useEffect(() => { if (orgId) loadStops(); }, [query, orgId]);

  async function createStop(e: React.FormEvent) {
    e.preventDefault();
    const res  = await fetch('/api/stops', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), orgId }),
    });
    const data = await res.json();
    if (data.ok) {
      if (genTts && data.data.nameMl) {
        await fetch('/api/tts', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ text: data.data.nameMl, stopId: data.data.id }),
        });
      }
      setForm({ name: '', nameMl: '', lat: '', lng: '', geofenceRadius: '50' });
      loadStops();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stops Library</h1>

      {/* Add stop form */}
      <form onSubmit={createStop} className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">Add Stop</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="English name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            required className="bg-slate-800 rounded-lg p-2 text-sm" />
          <input placeholder="Malayalam name" value={form.nameMl} onChange={e => setForm(f => ({...f, nameMl: e.target.value}))}
            className="bg-slate-800 rounded-lg p-2 text-sm" />
          <input placeholder="Latitude" value={form.lat} onChange={e => setForm(f => ({...f, lat: e.target.value}))}
            required type="number" step="any" className="bg-slate-800 rounded-lg p-2 text-sm" />
          <input placeholder="Longitude" value={form.lng} onChange={e => setForm(f => ({...f, lng: e.target.value}))}
            required type="number" step="any" className="bg-slate-800 rounded-lg p-2 text-sm" />
          <input placeholder="Geofence radius (m)" value={form.geofenceRadius} onChange={e => setForm(f => ({...f, geofenceRadius: e.target.value}))}
            type="number" className="bg-slate-800 rounded-lg p-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" checked={genTts} onChange={e => setGenTts(e.target.checked)} />
          Auto-generate Malayalam TTS audio
        </label>
        <button type="submit" className="bg-orange-500 px-4 py-2 rounded-lg text-sm font-semibold">
          Add Stop
        </button>
      </form>

      {/* Search */}
      <input
        placeholder="Search stops (English or Malayalam)…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm"
      />

      {/* Stops table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left py-2 pr-4">Name</th>
              <th className="text-left py-2 pr-4">Malayalam</th>
              <th className="text-left py-2 pr-4">GPS</th>
              <th className="text-left py-2 pr-4">Radius</th>
              <th className="text-left py-2">Audio</th>
            </tr>
          </thead>
          <tbody>
            {stops.map(s => (
              <tr key={s.id} className="border-b border-slate-800">
                <td className="py-2 pr-4">{s.name}</td>
                <td className="py-2 pr-4 font-sans">{s.nameMl || '—'}</td>
                <td className="py-2 pr-4 text-slate-400 text-xs">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</td>
                <td className="py-2 pr-4 text-slate-400">{s.geofenceRadius}m</td>
                <td className="py-2">
                  {s.audioUrl
                    ? <a href={s.audioUrl} target="_blank" className="text-orange-400 text-xs">▶ Play</a>
                    : <span className="text-slate-600 text-xs">None</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
