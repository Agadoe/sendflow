'use client';

import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const STAGES = [
  { id: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  { id: 'CONTACTED', label: 'Contacted', color: 'bg-amber/10 text-amber', border: 'border-amber/20' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
  { id: 'CONVERTED', label: 'Converted', color: 'bg-green-100 text-green-700', border: 'border-green-200' },
  { id: 'LOST', label: 'Lost', color: 'bg-red-50 text-red-400', border: 'border-red-100' },
];

const SOURCES = [
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'website', label: 'Website' },
  { id: 'referral', label: 'Referral' },
  { id: 'cold_outreach', label: 'Cold Outreach' },
  { id: 'other', label: 'Other' },
];

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: string;
  source: string | null;
  notes: string;
  nextFollowUp: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { activities: number };
}

interface Activity {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  user: { name: string };
}

const STAGE_ICONS: Record<string, string> = {
  NEW: '🆕',
  CONTACTED: '📞',
  QUALIFIED: '✅',
  CONVERTED: '💰',
  LOST: '❌',
};

const ACTIVITY_ICONS: Record<string, string> = {
  note: '📝',
  call: '📞',
  email: '📧',
  whatsapp: '💬',
  stage_change: '🔄',
};

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  // Add lead form state
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: 'waitlist', notes: '' });
  const [saving, setSaving] = useState(false);

  // Activity form
  const [activityType, setActivityType] = useState('note');
  const [activityContent, setActivityContent] = useState('');

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data.leads || []);
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowAddModal(false);
        setForm({ name: '', email: '', phone: '', company: '', source: 'waitlist', notes: '' });
        fetchLeads();
        toast.success('Lead added');
      } else {
        toast.error('Failed to add lead');
      }
    } finally {
      setSaving(false);
    }
  }

  async function openLead(lead: Lead) {
    setSelectedLead(lead);
    const res = await fetch(`/api/leads/${lead.id}`);
    const data = await res.json();
    setActivities(data.lead?.activities || []);
  }

  async function changeStage(leadId: string, newStage: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    });
    // Log stage change as activity
    await fetch(`/api/leads/${leadId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'stage_change', content: `Moved to ${STAGES.find(s => s.id === newStage)?.label}` }),
    });
    fetchLeads();
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, stage: newStage } : null);
    }
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!activityContent.trim() || !selectedLead) return;
    const res = await fetch(`/api/leads/${selectedLead.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: activityType, content: activityContent }),
    });
    if (res.ok) {
      const data = await res.json();
      setActivities(prev => [data.activity, ...prev]);
      setActivityContent('');
      fetchLeads();
    }
  }

  function openWhatsApp(phone: string | null) {
    if (!phone) { toast.error('No phone number'); return; }
    const clean = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl text-slate">Pipeline</h1>
          <p className="text-slate-light text-sm mt-1">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded-btn hover:bg-amber-dark transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Lead
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {STAGES.map(stage => (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-72 flex flex-col rounded-card border ${stage.border} bg-gray-50/50`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (dragging) { changeStage(dragging, stage.id); setDragging(null); }
              }}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate">{stage.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stage.color}`}>
                    {leads.filter(l => l.stage === stage.id).length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {leads
                  .filter(l => l.stage === stage.id)
                  .map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragging(lead.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => openLead(lead)}
                      className={`bg-white rounded-lg border border-gray-100 p-3 cursor-pointer hover:border-amber/30 hover:shadow-sm transition-all ${dragging === lead.id ? 'opacity-50' : ''}`}
                    >
                      <div className="font-medium text-sm text-slate mb-1">{lead.name}</div>
                      {lead.company && <div className="text-xs text-slate-light mb-1">{lead.company}</div>}
                      <div className="flex items-center gap-2 text-xs text-slate-light">
                        {lead.phone && (
                          <button
                            onClick={e => { e.stopPropagation(); openWhatsApp(lead.phone); }}
                            className="flex items-center gap-1 hover:text-green-600 transition-colors"
                          >
                            📞 {lead.phone}
                          </button>
                        )}
                        {lead.email && <span>📧</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{timeAgo(lead.updatedAt)}</span>
                        {lead._count.activities > 0 && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {lead._count.activities} log{lead._count.activities !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                {leads.filter(l => l.stage === stage.id).length === 0 && (
                  <div className="text-center py-8 text-gray-300 text-sm">Drop leads here</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead Detail Slide-over */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedLead(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative w-full max-w-md bg-white shadow-xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Detail header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{STAGE_ICONS[selectedLead.stage]}</span>
                    <h2 className="font-heading text-xl text-slate">{selectedLead.name}</h2>
                  </div>
                  {selectedLead.company && <p className="text-sm text-slate-light">{selectedLead.company}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {selectedLead.phone && (
                      <button
                        onClick={() => openWhatsApp(selectedLead.phone)}
                        className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        📞 {selectedLead.phone}
                      </button>
                    )}
                    {selectedLead.email && (
                      <a href={`mailto:${selectedLead.email}`} className="text-sm text-slate-light hover:text-amber">
                        📧 {selectedLead.email}
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-slate transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stage selector */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => changeStage(selectedLead.id, s.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${selectedLead.stage === s.id ? `${s.color} border-current` : 'border-gray-200 text-slate-light hover:border-gray-300'}`}
                  >
                    {STAGE_ICONS[s.id]} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-slate-light uppercase tracking-wider mb-2">Notes</h3>
              <textarea
                defaultValue={selectedLead.notes}
                placeholder="Add notes about this lead..."
                className="w-full text-sm text-slate border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                rows={3}
                onBlur={async e => {
                  if (e.target.value !== selectedLead.notes) {
                    await fetch(`/api/leads/${selectedLead.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ notes: e.target.value }),
                    });
                    setSelectedLead(prev => prev ? { ...prev, notes: e.target.value } : null);
                  }
                }}
              />
            </div>

            {/* Activity timeline */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <h3 className="text-xs font-semibold text-slate-light uppercase tracking-wider mb-3">Activity</h3>

              {/* Add activity form */}
              <form onSubmit={addActivity} className="mb-4 space-y-2">
                <div className="flex gap-2">
                  {['note', 'call', 'email', 'whatsapp'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActivityType(t)}
                      className={`text-xs px-2 py-1 rounded-md border font-medium capitalize ${activityType === t ? 'bg-amber/10 border-amber/30 text-amber' : 'border-gray-200 text-slate-light hover:border-gray-300'}`}
                    >
                      {ACTIVITY_ICONS[t]} {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={activityContent}
                    onChange={e => setActivityContent(e.target.value)}
                    placeholder="What happened?"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                    rows={2}
                  />
                  <button
                    type="submit"
                    disabled={!activityContent.trim()}
                    className="px-3 bg-amber text-white rounded-lg hover:bg-amber-dark disabled:opacity-40 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Activity list */}
              <div className="space-y-3">
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3">
                    <span className="text-base shrink-0">{ACTIVITY_ICONS[a.type] || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate">{a.content}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{a.user?.name} · {timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-sm text-gray-300 text-center py-4">No activity yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-heading text-lg text-slate">Add New Lead</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-slate">✕</button>
            </div>
            <form onSubmit={addLead} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1">Full Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40" placeholder="e.g. Esther Mensah" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-light mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40" placeholder="esther@gmail.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-light mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40" placeholder="0241234567" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1">Company</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40" placeholder="Esther's Hair Salon" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1">Source</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40">
                  {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none" rows={2} placeholder="Any context about this lead..." />
              </div>
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-amber text-white font-semibold rounded-btn hover:bg-amber-dark disabled:opacity-60">
                {saving ? 'Adding...' : 'Add Lead'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
