'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const [stats, setStats] = useState({ total: 0, delivered: 0, failed: 0, rate: 0 });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => {
        if (d.stats) setStats(d.stats);
        if (d.campaigns) setCampaigns(d.campaigns);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl text-slate">Analytics</h1>
        <p className="text-sm text-slate-light mt-0.5">Track how your campaigns are performing</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <div className="text-3xl font-heading text-slate">{stats.total}</div>
          <div className="text-sm text-slate-light mt-1">Total Sent</div>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <div className="text-3xl font-heading text-green">{stats.delivered}</div>
          <div className="text-sm text-slate-light mt-1">Delivered</div>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <div className="text-3xl font-heading text-red">{stats.failed}</div>
          <div className="text-sm text-slate-light mt-1">Failed</div>
        </div>
        <div className="bg-surface rounded-card border border-gray-100 p-5">
          <div className="text-3xl font-heading text-amber">{stats.rate}%</div>
          <div className="text-sm text-slate-light mt-1">Delivery Rate</div>
        </div>
      </div>

      {/* Per-campaign breakdown */}
      <div>
        <h2 className="font-heading text-lg text-slate mb-3">By Campaign</h2>
        {campaigns.length === 0 ? (
          <div className="bg-surface rounded-card border border-gray-100 p-8 text-center text-slate-light">
            No campaign data yet
          </div>
        ) : (
          <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Campaign</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Sent</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Delivered</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Failed</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 text-sm font-medium text-slate">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-slate">{c.sent || 0}</td>
                    <td className="px-6 py-4 text-sm text-green">{c.delivered || 0}</td>
                    <td className="px-6 py-4 text-sm text-red">{c.failed || 0}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`font-medium ${c.rate >= 90 ? 'text-green' : c.rate >= 70 ? 'text-amber' : 'text-red'}`}>
                        {c.rate || 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}