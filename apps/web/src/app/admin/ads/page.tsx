'use client';

import { useState, useEffect } from 'react';

interface Campaign {
  id: string; name: string; status: string;
  advertiserCpm: number; ownerCpm: number;
  totalBudget: number; spentAmount: number;
  targetType: string; ads: { id: string; format: string }[];
}

export default function AdsPage() {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm]           = useState({
    name: '', advertiserId: '', advertiserCpm: '20', ownerCpm: '12',
    totalBudget: '1000', targetType: 'all', startsAt: '', endsAt: '',
    timeFrom: '', timeTo: '',
  });
  const [tab, setTab] = useState<'campaigns' | 'create'>('campaigns');

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    const res  = await fetch('/api/campaigns', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) setCampaigns(data.data);
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/campaigns', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        advertiserCpm: parseFloat(form.advertiserCpm),
        ownerCpm:      parseFloat(form.ownerCpm),
        totalBudget:   parseFloat(form.totalBudget),
      }),
    });
    const data = await res.json();
    if (data.ok) { setTab('campaigns'); loadCampaigns(); }
    else alert(data.error);
  }

  const margin = (parseFloat(form.advertiserCpm) - parseFloat(form.ownerCpm)).toFixed(2);

  const statusColor: Record<string, string> = {
    active: 'badge-green', draft: 'badge-gold', paused: 'badge-gold',
    exhausted: 'badge-red', ended: 'badge-red',
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-kerala-900">Advertisements</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('campaigns')}
            className={tab === 'campaigns' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>
            Campaigns
          </button>
          <button onClick={() => setTab('create')}
            className={tab === 'create' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>
            + New Campaign
          </button>
        </div>
      </div>

      {tab === 'create' && (
        <form onSubmit={createCampaign} className="card space-y-4">
          <h2 className="font-bold text-kerala-700 text-sm uppercase tracking-wider">New Campaign</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Campaign Name *</label>
              <input className="input" placeholder="e.g. Onam 2025 Promo"
                value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Advertiser CPM (₹) *</label>
              <input className="input" type="number" step="0.01" min="1"
                value={form.advertiserCpm} onChange={e => setForm(f => ({...f, advertiserCpm: e.target.value}))} required />
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Owner CPM (₹) *</label>
              <input className="input" type="number" step="0.01" min="0"
                value={form.ownerCpm} onChange={e => setForm(f => ({...f, ownerCpm: e.target.value}))} required />
              <p className="text-xs text-kerala-400 mt-1">Platform margin: ₹{margin} / 1000 impressions</p>
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Total Budget (₹) *</label>
              <input className="input" type="number" step="0.01" min="1"
                value={form.totalBudget} onChange={e => setForm(f => ({...f, totalBudget: e.target.value}))} required />
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Targeting</label>
              <select className="input" value={form.targetType}
                onChange={e => setForm(f => ({...f, targetType: e.target.value}))}>
                <option value="all">All buses</option>
                <option value="route">Specific routes</option>
                <option value="district">By district</option>
                <option value="bus">Specific buses</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Start Date</label>
              <input className="input" type="date"
                value={form.startsAt} onChange={e => setForm(f => ({...f, startsAt: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">End Date</label>
              <input className="input" type="date"
                value={form.endsAt} onChange={e => setForm(f => ({...f, endsAt: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Time From (HH:MM)</label>
              <input className="input" type="time"
                value={form.timeFrom} onChange={e => setForm(f => ({...f, timeFrom: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs text-kerala-500 mb-1 font-semibold">Time To (HH:MM)</label>
              <input className="input" type="time"
                value={form.timeTo} onChange={e => setForm(f => ({...f, timeTo: e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Create Campaign</button>
            <button type="button" onClick={() => setTab('campaigns')} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {tab === 'campaigns' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-kerala-100">
            <h2 className="font-bold text-kerala-800">{campaigns.length} Campaigns</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Target</th>
                <th>Adv. CPM</th>
                <th>Owner CPM</th>
                <th>Budget</th>
                <th>Spent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td className="font-medium text-kerala-900">{c.name}</td>
                  <td><span className="badge-green">{c.targetType}</span></td>
                  <td className="font-mono text-kerala-700">₹{c.advertiserCpm}</td>
                  <td className="font-mono text-kerala-600">₹{c.ownerCpm}</td>
                  <td className="font-mono">₹{c.totalBudget}</td>
                  <td className="font-mono">
                    <span className={c.spentAmount / c.totalBudget > 0.8 ? 'text-red-500' : 'text-kerala-600'}>
                      ₹{c.spentAmount.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span className={statusColor[c.status] || 'badge-gold'}>{c.status}</span>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={7} className="text-center text-kerala-300 py-8">No campaigns yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
