'use client';

import { useState, useEffect } from 'react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-600',
};

function formatDate(date: Date | string | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(date));
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-portal/campaigns')
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(d => setCampaigns(d.campaigns || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-slate">My Campaigns</h1>
        <p className="text-slate-light text-sm mt-1">View and track your messaging campaigns</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-light text-sm">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-light text-sm">No campaigns yet</p>
            <p className="text-xs text-slate-light mt-1">Campaigns created in SendFlow will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-light font-medium bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3">Campaign Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Contacts</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign, i) => (
                  <tr key={campaign.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-5 py-3.5 font-medium text-slate">{campaign.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[campaign.status] || STATUS_COLORS.DRAFT}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-light text-xs">{campaign._count?.messages ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-light">
                      {campaign.sentAt ? formatDate(campaign.sentAt) : campaign.scheduledAt ? `Scheduled: ${formatDate(campaign.scheduledAt)}` : formatDate(campaign.createdAt)}
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