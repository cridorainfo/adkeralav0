'use client';

import { useState, useEffect } from 'react';

interface Config  { defaultAdvertiserCpm: number; defaultOwnerCpm: number }
interface Earning { orgId: string; orgName: string; totalEarned: number; totalPaid: number; balance: number }

export default function RevenuePage() {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adkerala_token') : null;
  const [config, setConfig]     = useState<Config | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/revenue/config', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.ok && setConfig(d.data));
    fetch('/api/admin/revenue/earnings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.ok && setEarnings(d.data));
  }, [token]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    await fetch('/api/admin/revenue/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(config),
    });
    setSaving(false);
  }

  if (!config) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Revenue & Payouts</h1>

      {/* CPM Config */}
      <form onSubmit={saveConfig} className="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4 max-w-md">
        <h2 className="font-semibold text-slate-300">Default CPM Rates</h2>
        <p className="text-slate-500 text-xs">CPM = cost per 1,000 impressions (₹). Platform margin = Advertiser CPM − Owner CPM.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Advertiser CPM (₹)</label>
            <input type="number" step="0.01" value={config.defaultAdvertiserCpm}
              onChange={e => setConfig(c => c && ({ ...c, defaultAdvertiserCpm: parseFloat(e.target.value) }))}
              className="w-full mt-1 bg-slate-800 rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Owner CPM (₹)</label>
            <input type="number" step="0.01" value={config.defaultOwnerCpm}
              onChange={e => setConfig(c => c && ({ ...c, defaultOwnerCpm: parseFloat(e.target.value) }))}
              className="w-full mt-1 bg-slate-800 rounded-lg p-2 text-sm" />
          </div>
        </div>
        <p className="text-xs text-orange-400">
          Platform margin: ₹{(config.defaultAdvertiserCpm - config.defaultOwnerCpm).toFixed(2)} per 1000 impressions
        </p>
        <button type="submit" disabled={saving} className="bg-orange-500 px-4 py-2 rounded-lg text-sm font-semibold">
          {saving ? 'Saving…' : 'Save Rates'}
        </button>
      </form>

      {/* Owner earnings table */}
      <div>
        <h2 className="font-semibold text-slate-300 mb-3">Owner Earnings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left py-2 pr-4">Organisation</th>
                <th className="text-right py-2 pr-4">Total Earned</th>
                <th className="text-right py-2 pr-4">Total Paid</th>
                <th className="text-right py-2 pr-4">Balance</th>
                <th className="text-right py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map(e => (
                <tr key={e.orgId} className="border-b border-slate-800">
                  <td className="py-2 pr-4">{e.orgName}</td>
                  <td className="py-2 pr-4 text-right text-green-400">₹{e.totalEarned.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-slate-400">₹{e.totalPaid.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right font-bold">₹{e.balance.toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <button className="text-orange-400 text-xs hover:underline">Pay Out</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
