'use client';

import { useState, useEffect } from 'react';

interface Bus { id: string; numberPlate: string; name: string | null; status: string; displayToken?: string }
interface District { id: string; name: string; nameMl: string }

export default function BusesPage() {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;
  const user  = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adkerala_user') || '{}') : {};

  const [buses, setBuses]         = useState<Bus[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [form, setForm]           = useState({ numberPlate: '', name: '', districtId: '' });
  const [newToken, setNewToken]   = useState<{ plate: string; token: string } | null>(null);

  useEffect(() => {
    loadBuses();
    fetch('/api/districts').then(r => r.json()).then(d => d.ok && setDistricts(d.data));
  }, []);

  async function loadBuses() {
    const res  = await fetch(`/api/buses?orgId=${user.orgId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) setBuses(data.data);
  }

  async function addBus(e: React.FormEvent) {
    e.preventDefault();
    const res  = await fetch('/api/buses', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ ...form, orgId: user.orgId }),
    });
    const data = await res.json();
    if (data.ok) {
      setNewToken({ plate: data.data.numberPlate, token: data.data.displayToken });
      setForm({ numberPlate: '', name: '', districtId: '' });
      loadBuses();
    } else alert(data.error);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-kerala-900">Buses</h1>

      {/* New display token banner */}
      {newToken && (
        <div className="card border-gold-400 bg-yellow-50">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-kerala-800 mb-1">✅ Bus added: {newToken.plate}</p>
              <p className="text-xs text-kerala-600 mb-2">Copy this display token now — it won't be shown again.</p>
              <code className="block bg-kerala-50 border border-kerala-200 text-kerala-800 font-mono text-sm px-3 py-2 rounded-lg break-all">
                {newToken.token}
              </code>
            </div>
            <button onClick={() => setNewToken(null)} className="text-kerala-400 hover:text-kerala-700 ml-4">✕</button>
          </div>
        </div>
      )}

      {/* Add bus form */}
      <form onSubmit={addBus} className="card space-y-4">
        <h2 className="font-bold text-kerala-700 text-sm uppercase tracking-wider">Add Bus</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Number Plate *</label>
            <input className="input font-mono uppercase" placeholder="KL-01-AB-1234"
              value={form.numberPlate} onChange={e => setForm(f => ({...f, numberPlate: e.target.value}))} required />
          </div>
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Bus Name (optional)</label>
            <input className="input" placeholder="e.g. Intercity Express"
              value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">District</label>
            <select className="input" value={form.districtId}
              onChange={e => setForm(f => ({...f, districtId: e.target.value}))}>
              <option value="">Select…</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary">Add Bus</button>
      </form>

      {/* Buses table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-kerala-100">
          <h2 className="font-bold text-kerala-800">{buses.length} Buses registered</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Number Plate</th>
              <th>Name</th>
              <th>Status</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {buses.map(b => (
              <tr key={b.id}>
                <td className="font-mono font-bold text-kerala-800">{b.numberPlate}</td>
                <td className="text-kerala-600">{b.name || '—'}</td>
                <td>
                  <span className={b.status === 'active' ? 'badge-green' : 'badge-red'}>{b.status}</span>
                </td>
                <td className="text-kerala-400 text-xs">—</td>
              </tr>
            ))}
            {buses.length === 0 && (
              <tr><td colSpan={4} className="text-center text-kerala-300 py-8">No buses added yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
