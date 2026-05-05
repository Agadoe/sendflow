'use client';

import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  businessType: string | null;
  wantsCall: boolean;
  createdAt: string;
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'calls'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    setLoading(true);
    try {
      const res = await fetch('/api/waitlist');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      toast.error('Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }

  const filtered = entries.filter(e => {
    const matchesFilter = filter === 'calls' ? e.wantsCall : true;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.phone || '').includes(q) ||
      (e.businessType || '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const callLeads = entries.filter(e => e.wantsCall);
  const total = entries.length;

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.id)));
    }
  }

  function exportCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Business Type', 'Wants Call', 'Signed Up'];
    const rows = filtered.map(e => [
      e.name,
      e.email,
      e.phone || '',
      e.businessType || '',
      e.wantsCall ? 'YES' : 'NO',
      new Date(e.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sendflow-waitlist-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} entries`);
  }

  function copySelectedPhones() {
    const phones = filtered
      .filter(e => selected.has(e.id) && e.phone)
      .map(e => e.phone)
      .join(', ');
    if (!phones) {
      toast.error('No phone numbers selected');
      return;
    }
    navigator.clipboard.writeText(phones);
    toast.success('Phone numbers copied to clipboard');
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl text-slate">Waitlist</h1>
          <p className="text-slate-light text-sm mt-1">
            {total} total · {callLeads.length} want a call
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-slate text-white text-sm font-medium rounded-btn hover:bg-slate-dark transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={fetchEntries}
            className="px-4 py-2 border border-gray-200 text-slate text-sm font-medium rounded-btn hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Signups" value={total} />
        <StatCard label="Want Onboarding Call" value={callLeads.length} accent />
        <StatCard label="No Phone" value={entries.filter(e => !e.phone).length} muted />
        <StatCard
          label="Selected"
          value={selected.size}
          muted={selected.size === 0}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by name, email, phone, business..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2 pl-9 border border-gray-200 rounded-btn text-sm text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-btn transition-colors ${filter === 'all' ? 'bg-slate text-white' : 'border border-gray-200 text-slate hover:bg-gray-50'}`}
          >
            All ({total})
          </button>
          <button
            onClick={() => setFilter('calls')}
            className={`px-4 py-2 text-sm font-medium rounded-btn transition-colors ${filter === 'calls' ? 'bg-amber text-white' : 'border border-gray-200 text-slate hover:bg-gray-50'}`}
          >
            Wants Call ({callLeads.length})
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-amber/10 rounded-btn border border-amber/20">
          <span className="text-sm text-slate font-medium">{selected.size} selected</span>
          <button
            onClick={copySelectedPhones}
            className="px-3 py-1.5 bg-amber text-white text-xs font-medium rounded-btn hover:bg-amber-dark transition-colors"
          >
            Copy Phones
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 border border-gray-200 text-slate text-xs font-medium rounded-btn hover:bg-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-light">
          <div className="text-4xl mb-3">📋</div>
          <p>No entries found</p>
        </div>
      ) : (
        <div className="bg-white rounded-card border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-slate-light w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-gray-300 text-amber focus:ring-amber"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-light">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-light">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-light">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-slate-light">Business</th>
                <th className="text-left px-4 py-3 font-medium text-slate-light">Call?</th>
                <th className="text-left px-4 py-3 font-medium text-slate-light">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i === filtered.length - 1 ? 'border-0' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                      className="w-4 h-4 rounded border-gray-300 text-amber focus:ring-amber"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate">{entry.name}</td>
                  <td className="px-4 py-3 text-slate-light">
                    <a href={`mailto:${entry.email}`} className="hover:text-amber transition-colors">
                      {entry.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-light font-mono text-xs">
                    {entry.phone || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-light text-xs">
                    {entry.businessType || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {entry.wantsCall ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-light text-xs">
                    {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, muted }: { label: string; value: number; accent?: boolean; muted?: boolean }) {
  return (
    <div className="bg-white rounded-card border border-gray-100 px-4 py-3">
      <div className={`font-heading text-2xl ${accent ? 'text-amber' : muted ? 'text-slate-light' : 'text-slate'}`}>
        {value}
      </div>
      <div className="text-xs text-slate-light mt-0.5">{label}</div>
    </div>
  );
}
