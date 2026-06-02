'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  QUALIFIED: 'bg-green-100 text-green-700',
  NURTURE: 'bg-yellow-100 text-yellow-700',
  CLOSED: 'bg-red-100 text-red-600',
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(date));
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/client-portal/leads')
      .then(r => r.ok ? r.json() : { leads: [] })
      .then(d => setLeads(d.leads || []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l => {
    const matchStage = stageFilter === 'ALL' || l.stage === stageFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || l.name.toLowerCase().includes(q) || (l.company || '').toLowerCase().includes(q);
    return matchStage && matchSearch;
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-slate">My Leads</h1>
        <p className="text-slate-light text-sm mt-1">Manage and track your sales leads</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          placeholder="Search by name or company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2.5 border border-gray-200 rounded-btn text-sm text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-btn text-sm text-slate bg-white focus:outline-none focus:ring-2 focus:ring-amber/40"
        >
          <option value="ALL">All Stages</option>
          <option value="NEW">New</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="NURTURE">Nurture</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-light text-sm">Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-light text-sm">No leads found</p>
            <p className="text-xs text-slate-light mt-1">
              {search || stageFilter !== 'ALL' ? 'Try adjusting your filters' : 'Leads will appear here when added'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-light font-medium bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr key={lead.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-5 py-3.5 font-medium text-slate">{lead.name}</td>
                    <td className="px-5 py-3.5 text-slate-light text-xs">{lead.company || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[lead.stage] || STAGE_COLORS.NEW}`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-light text-xs">{lead.source || '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-light">{formatDate(lead.createdAt)}</td>
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