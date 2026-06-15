'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STAGES = [
  { key: 'SCOUTED',     label: 'Scouted',     color: 'bg-blue-50 text-blue-600 border-blue-200'  },
  { key: 'QUALIFIED',   label: 'Qualified',   color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { key: 'CONTACTED',   label: 'Contacted',   color: 'bg-amber-50 text-amber-600 border-amber-200'  },
  { key: 'PROPOSAL',    label: 'Proposal',    color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { key: 'NEGOTIATING', label: 'Negotiating', color: 'bg-pink-50 text-pink-600 border-pink-200'  },
  { key: 'CONVERTED',   label: 'Converted',   color: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'CLOSED',      label: 'Closed',      color: 'bg-gray-100 text-gray-500 border-gray-200'  },
];

const ACTIVITY_ICONS: Record<string, string> = {
  note: '📝', call: '📞', email: '📧', whatsapp: '💬',
  stage_change: '🔄', score_update: '📊', enrichment: '✨',
  sms: '💬', telegram: '✈️',
};

function formatDate(d: string) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(d));
}

function ScoreBadge({ score }: { score: number }) {
  if (!score) return <span className="text-xs text-gray-400">No score</span>;
  const cls = score >= 70 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500';
  return <span className={`text-xs font-mono font-semibold ${cls}`}>{score}/100</span>;
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pipeline' | 'table'>('pipeline');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [addingLead, setAddingLead] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', company: '', email: '' });
  const [scouting, setScouting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(stageFilter !== 'ALL' && { stage: stageFilter }),
        ...(search && { search }),
        page: String(page),
        limit: '50',
      });
      const r = await fetch(`/api/client-portal/leads?${params}`);
      if (!r.ok) throw new Error('fetch failed');
      const d = await r.json();
      setLeads(d.leads || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
      if (d.stageCounts) setStageCounts(d.stageCounts);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [stageFilter, search, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name.trim()) return;
    try {
      const r = await fetch('/api/client-portal/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });
      if (r.ok) { setNewLead({ name: '', phone: '', company: '', email: '' }); setAddingLead(false); fetchLeads(); }
    } catch {}
  };

  const handleScout = async () => {
    setScouting(true);
    try {
      const r = await fetch('/api/leads/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: 'car dealer', targetCustomer: 'fleet buyers' }),
      });
      const d = await r.json();
      alert(`Scouted! Qualified: ${d.summary?.qualified || 0}, Nurture: ${d.summary?.nurture || 0}`);
      fetchLeads();
    } catch (err) {
      alert('Scout failed: ' + String(err));
    } finally {
      setScouting(false);
    }
  };

  const pipelineLeads = STAGES.map(s => ({
    ...s,
    leads: leads.filter(l => l.stage === s.key),
  }));

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl text-slate-800">Lead Pipeline</h1>
          <p className="text-slate-400 text-sm mt-0.5">{total} total leads</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleScout}
            disabled={scouting}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {scouting ? '🔍 Scouting…' : '🤖 Auto-Scout Leads'}
          </button>
          <button
            onClick={() => setAddingLead(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Stage filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => { setStageFilter('ALL'); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            stageFilter === 'ALL'
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-500 border-gray-200 hover:border-slate-400'
          }`}
        >
          All ({total})
        </button>
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => { setStageFilter(s.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              stageFilter === s.key
                ? `${s.color.replace('bg-', 'bg-').replace('-50', '-100')} border-current`
                : 'bg-white text-slate-400 border-gray-200 hover:border-gray-300'
            }`}
          >
            {s.label} ({stageCounts[s.key] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <input
          type="search"
          placeholder="Search by name, company, phone…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-md px-4 py-2.5 pl-10 border border-gray-200 rounded-xl text-sm text-slate-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
        <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
      </div>

      {/* Pipeline view */}
      {!loading && view === 'pipeline' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {pipelineLeads.map(stage => (
              <div key={stage.key} className="w-64 flex-shrink-0">
                <div className={`text-xs font-semibold uppercase tracking-wide px-2 py-1.5 rounded-t-lg ${stage.color}`}>
                  {stage.label} <span className="opacity-70">({stage.leads.length})</span>
                </div>
                <div className="bg-gray-50 rounded-b-lg p-2 space-y-2 min-h-16">
                  {stage.leads.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-4">No leads</p>
                  )}
                  {stage.leads.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => router.push(`/client-portal/leads/${lead.id}`)}
                      className="w-full text-left bg-white rounded-lg p-3 border border-gray-100 hover:border-amber-300 hover:shadow-sm transition-all"
                    >
                      <div className="font-medium text-slate-800 text-sm truncate">{lead.name}</div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{lead.company || 'No company'}</div>
                      <div className="flex items-center justify-between mt-2">
                        <ScoreBadge score={lead.score} />
                        <span className="text-xs text-slate-300">{formatDate(lead.createdAt)}</span>
                      </div>
                      {lead.phone && (
                        <div className="text-xs text-slate-400 mt-1 truncate">{lead.phone}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table view */}
      {!loading && view === 'table' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 font-medium bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Outreach</th>
                    <th className="px-4 py-3">Contacted</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const stage = STAGES.find(s => s.key === lead.stage);
                    return (
                      <tr key={lead.id} className={`border-b border-gray-50 last:border-0 hover:bg-amber-50/20 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                          onClick={() => router.push(`/client-portal/leads/${lead.id}`)}>
                        <td className="px-4 py-3 font-medium text-slate-800">{lead.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{lead.company || '—'}</td>
                        <td className="px-4 py-3">
                          {stage && (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${stage.color}`}>
                              {stage.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3"><ScoreBadge score={lead.score} /></td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${
                            lead.outreachStatus === 'REPLIED' ? 'text-green-600' :
                            lead.outreachStatus === 'DELIVERED' ? 'text-blue-600' :
                            lead.outreachStatus === 'SENT' ? 'text-amber-600' :
                            lead.outreachStatus === 'FAILED' ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            {lead.outreachStatus || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{formatDate(lead.lastContactedAt)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{formatDate(lead.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-400 text-lg">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">‹ Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next ›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <div className="flex justify-center py-12 text-slate-400 text-sm">Loading…</div>}

      {/* Toggle view */}
      <div className="flex gap-2 mt-4">
        <button onClick={() => setView('pipeline')}
          className={`px-3 py-1.5 text-xs rounded-lg border ${view === 'pipeline' ? 'border-slate-800 bg-slate-800 text-white' : 'border-gray-200 text-slate-500 hover:bg-gray-50'}`}>
          Pipeline
        </button>
        <button onClick={() => setView('table')}
          className={`px-3 py-1.5 text-xs rounded-lg border ${view === 'table' ? 'border-slate-800 bg-slate-800 text-white' : 'border-gray-200 text-slate-500 hover:bg-gray-50'}`}>
          Table
        </button>
      </div>

      {/* Add Lead Modal */}
      {addingLead && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAddingLead(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-heading text-xl text-slate-800 mb-4">Add New Lead</h2>
            <form onSubmit={handleAddLead} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
                <input required value={newLead.name} onChange={e => setNewLead(l => ({ ...l, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Company or contact name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                <input value={newLead.phone} onChange={e => setNewLead(l => ({ ...l, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="+233…" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Company</label>
                <input value={newLead.company} onChange={e => setNewLead(l => ({ ...l, company: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" placeholder="Company name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                <input type="email" value={newLead.email} onChange={e => setNewLead(l => ({ ...l, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:amber-400" placeholder="email@company.com" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddingLead(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-slate-500 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">Save Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}