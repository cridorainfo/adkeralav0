'use client';

import { useState, useEffect } from 'react';

interface Driver { id: string; name: string; email: string | null; phone: string | null; active: boolean }

export default function DriversPage() {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;
  const user  = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adkerala_user') || '{}') : {};

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm]       = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadDrivers(); }, []);

  async function loadDrivers() {
    const res  = await fetch(`/api/users?role=driver&orgId=${user.orgId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) setDrivers(data.data);
  }

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ ...form, role: 'driver', orgId: user.orgId }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) { setForm({ name: '', email: '', phone: '', password: '' }); loadDrivers(); }
    else alert(data.error);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-kerala-900">Drivers</h1>

      {/* Add driver form */}
      <form onSubmit={createDriver} className="card space-y-4">
        <h2 className="font-bold text-kerala-700 text-sm uppercase tracking-wider">Add Driver</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Full Name *</label>
            <input className="input" placeholder="Driver's full name"
              value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
          </div>
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Email</label>
            <input className="input" type="email" placeholder="driver@example.com"
              value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Phone</label>
            <input className="input" type="tel" placeholder="+91 98765 43210"
              value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs text-kerala-500 mb-1 font-semibold">Password *</label>
            <input className="input" type="password" placeholder="Set initial password"
              value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required />
          </div>
        </div>
        <p className="text-xs text-kerala-400">The driver will use their email and this password to log in to the Driver PWA.</p>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding…' : 'Add Driver'}
        </button>
      </form>

      {/* Drivers table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-kerala-100">
          <h2 className="font-bold text-kerala-800">{drivers.length} Drivers</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(d => (
              <tr key={d.id}>
                <td className="font-medium text-kerala-900">{d.name}</td>
                <td className="text-kerala-600 text-sm">{d.email || '—'}</td>
                <td className="text-kerala-600 text-sm">{d.phone || '—'}</td>
                <td>
                  <span className={d.active ? 'badge-green' : 'badge-red'}>
                    {d.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="text-xs text-kerala-500 hover:text-kerala-700 underline">Reset Password</button>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr><td colSpan={5} className="text-center text-kerala-300 py-8">No drivers added yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
