'use client';

import { useState, useEffect } from 'react';

interface Stop   { id: string; name: string; nameMl: string }
interface Route  { id: string; name: string; nameMl: string; district: { name: string }; stops: { stop: Stop; order: number }[]; active: boolean }
interface District { id: string; name: string; nameMl: string }

export default function RoutesPage() {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;

  const [routes, setRoutes]       = useState<Route[]>([]);
  const [stops, setStops]         = useState<Stop[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [stopQ, setStopQ]         = useState('');
  const [selectedStops, setSelectedStops] = useState<Stop[]>([]);
  const [form, setForm]           = useState({ name: '', nameMl: '', districtId: '' });

  useEffect(() => {
    loadRoutes();
    loadDistricts();
  }, []);

  useEffect(() => {
    if (stopQ.length < 1) return;
    const orgId = JSON.parse(sessionStorage.getItem('adkerala_user') || '{}').orgId;
    fetch(`/api/stops?orgId=${orgId}&q=${encodeURIComponent(stopQ)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => d.ok && setStops(d.data));
  }, [stopQ]);

  async function loadRoutes() {
    const res  = await fetch('/api/routes', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) setRoutes(data.data);
  }

  async function loadDistricts() {
    const res  = await fetch('/api/districts');
    const data = await res.json();
    if (data.ok) setDistricts(data.data);
  }

  async function createRoute(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStops.length < 2) return alert('Select at least 2 stops');
    const orgId = JSON.parse(sessionStorage.getItem('adkerala_user') || '{}').orgId;
    const res  = await fetch('/api/routes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ ...form, orgId, stopIds: selectedStops.map(s => s.id) }),
    });
    const data = await res.json();
    if (data.ok) { setForm({ name: '', nameMl: '', districtId: '' }); setSelectedStops([]); loadRoutes(); }
    else alert(data.error);
  }

  const addStop = (s: Stop) => { if (!selectedStops.find(x => x.id === s.id)) setSelectedStops(p => [...p, s]); setStopQ(''); setStops([]); };
  const removeStop = (id: string) => setSelectedStops(p => p.filter(s => s.id !== id));
  const moveStop = (i: number, dir: -1 | 1) => {
    const arr = [...selectedStops];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSelectedStops(arr);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-kerala-900">Routes</h1>

      {/* Create route form */}
      <form onSubmit={createRoute} className="card space-y-4">
        <h2 className="font-bold text-kerala-700 text-sm uppercase tracking-wider">Create New Route</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Route Name (English)</label>
            <input className="input" placeholder="e.g. Thiruvananthapuram – Kollam"
              value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
          </div>
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Route Name (Malayalam)</label>
            <input className="input" placeholder="e.g. തിരുവനന്തപുരം – കൊല്ലം"
              value={form.nameMl} onChange={e => setForm(f => ({...f, nameMl: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">District</label>
            <select className="input" value={form.districtId}
              onChange={e => setForm(f => ({...f, districtId: e.target.value}))} required>
              <option value="">Select district…</option>
              {districts.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.nameMl}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stop selector */}
        <div>
          <label className="block text-xs text-kerala-500 mb-1 font-semibold">Add Stops (search)</label>
          <input className="input" placeholder="Type stop name in English or Malayalam…"
            value={stopQ} onChange={e => setStopQ(e.target.value)} />
          {stops.length > 0 && (
            <div className="mt-1 border border-kerala-200 rounded-lg bg-white shadow-sm max-h-36 overflow-y-auto">
              {stops.map(s => (
                <button key={s.id} type="button" onClick={() => addStop(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-kerala-50 text-sm border-b border-kerala-50 last:border-0">
                  <span className="font-medium text-kerala-800">{s.name}</span>
                  {s.nameMl && <span className="ml-2 text-kerala-500">{s.nameMl}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected stops order */}
        {selectedStops.length > 0 && (
          <div>
            <label className="block text-xs text-kerala-500 mb-2 font-semibold">
              Stop Order ({selectedStops.length} stops)
            </label>
            <div className="space-y-1.5">
              {selectedStops.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 bg-kerala-50 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-kerala-400 w-5">{i + 1}</span>
                  <span className="flex-1 text-sm text-kerala-800">{s.name}
                    {s.nameMl && <span className="ml-2 text-kerala-400 text-xs">{s.nameMl}</span>}
                  </span>
                  <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0}
                    className="text-kerala-400 hover:text-kerala-700 disabled:opacity-30 px-1">↑</button>
                  <button type="button" onClick={() => moveStop(i, 1)} disabled={i === selectedStops.length - 1}
                    className="text-kerala-400 hover:text-kerala-700 disabled:opacity-30 px-1">↓</button>
                  <button type="button" onClick={() => removeStop(s.id)}
                    className="text-red-400 hover:text-red-600 px-1 text-xs">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary">Create Route</button>
      </form>

      {/* Routes table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-kerala-100">
          <h2 className="font-bold text-kerala-800">{routes.length} Routes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Malayalam</th>
                <th>District</th>
                <th>Stops</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td className="font-medium text-kerala-900">{r.name}</td>
                  <td className="text-kerala-600">{r.nameMl || '—'}</td>
                  <td className="text-kerala-500">{r.district?.name}</td>
                  <td>{r.stops?.length ?? 0}</td>
                  <td>
                    <span className={r.active ? 'badge-green' : 'badge-red'}>
                      {r.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {routes.length === 0 && (
                <tr><td colSpan={5} className="text-center text-kerala-300 py-8">No routes yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
