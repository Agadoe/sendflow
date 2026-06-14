'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

const STAGES = [
  { key: 'SCOUTED',     label: 'Scouted',     color: 'bg-blue-50 text-blue-600'    },
  { key: 'QUALIFIED',   label: 'Qualified',   color: 'bg-purple-50 text-purple-600' },
  { key: 'CONTACTED',   label: 'Contacted',   color: 'bg-amber-50 text-amber-600'   },
  { key: 'PROPOSAL',    label: 'Proposal',    color: 'bg-orange-50 text-orange-600' },
  { key: 'NEGOTIATING', label: 'Negotiating', color: 'bg-pink-50 text-pink-600'    },
  { key: 'CONVERTED',   label: 'Converted',   color: 'bg-green-50 text-green-700'  },
  { key: 'CLOSED',      label: 'Closed',      color: 'bg-gray-100 text-gray-500'   },
];

const OUTREACH_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-gray-100 text-gray-500',
  SENT:      'bg-amber-50 text-amber-600',
  DELIVERED: 'bg-blue-50 text-blue-600',
  READ:      'bg-purple-50 text-purple-600',
  REPLIED:   'bg-green-50 text-green-700',
  FAILED:    'bg-red-50 text-red-500',
  BOUNCED:   'bg-red-50 text-red-500',
};

const ACTIVITY_ICONS: Record<string, string> = {
  note: '📝', call: '📞', email: '📧', whatsapp: '💬',
  stage_change: '🔄', score_update: '📊', enrichment: '✨',
  sms: '💬', telegram: '✈️',
};

function timeAgo(d: string) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [outboundMessages, setOutboundMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'outreach' | 'edit'>('timeline');
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const fetchLead = useCallback(async () => {
    const [leadRes, actsRes] = await Promise.all([
      fetch(`/api/client-portal/leads/${id}`),
      fetch(`/api/client-portal/leads/${id}/activities`),
    ]);
    if (leadRes.ok) {
      const d = await leadRes.json();
      setLead(d.lead);
      setEditData(d.lead);
    }
    if (actsRes.ok) {
      const d = await actsRes.json();
      setActivities(d.activities || []);
      setOutboundMessages(d.outboundMessages || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await fetch(`/api/client-portal/leads/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: noteType, content: newNote }),
      });
      setNewNote('');
      setAddingNote(false);
      fetchLead();
    } finally {
      setSavingNote(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await fetch(`/api/client-portal/leads/${id}/enrich`, { method: 'POST' });
      fetchLead();
    } finally {
      setEnriching(false);
    }
  };

  const handleStageChange = async (newStage: string) => {
    setUpdatingStage(true);
    try {
      await fetch(`/api/client-portal/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      fetchLead();
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleSaveEdit = async () => {
    await fetch(`/api/client-portal/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    setActiveTab('timeline');
    fetchLead();
  };

  if (loading) return <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>;
  if (!lead)   return <div className="p-8 text-center text-red-400 text-sm">Lead not found</div>;

  const stage = STAGES.find(s => s.key === lead.stage) || STAGES[0];
  const scoreBreakdown = lead.scoreBreakdown || {};

  return (
    <div className="p-6 min-h-screen max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1">
        ‹ Back to Leads
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl text-slate-800">{lead.name}</h1>
            {lead.company && <p className="text-slate-400 text-sm mt-0.5">{lead.company}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${stage.color}`}>{stage.label}</span>
              {lead.outreachStatus && (
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${OUTREACH_STATUS_COLORS[lead.outreachStatus] || 'bg-gray-100 text-gray-500'}`}>
                  💬 {lead.outreachStatus}
                </span>
              )}
              {lead.score > 0 && (
                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  📊 {lead.score}/100
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleEnrich} disabled={enriching}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-slate-500 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-50">
              {enriching ? '✨ Enriching…' : '✨ Enrich'}
            </button>
            <button onClick={() => setActiveTab('edit')}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-slate-500 hover:bg-gray-50">
              Edit
            </button>
          </div>
        </div>

        {/* Score breakdown */}
        {lead.score > 0 && Object.keys(scoreBreakdown).length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Profile', key: 'profile' },
              { label: 'Affluence', key: 'affluence' },
              { label: 'Contact', key: 'contact' },
              { label: 'Intent', key: 'intent' },
            ].map(({ label, key }) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">{label}</div>
                <div className="text-lg font-bold text-slate-700">{scoreBreakdown[key] || 0}/30</div>
              </div>
            ))}
          </div>
        )}

        {/* Contact info row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Phone', value: lead.phone, icon: '📱' },
            { label: 'Email', value: lead.email, icon: '📧' },
            { label: 'Next Follow-up', value: lead.nextFollowUp ? formatDate(lead.nextFollowUp) : 'Not set', icon: '📅' },
            { label: 'Last Contacted', value: lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : 'Never', icon: '🕐' },
            { label: 'Outreach Touches', value: lead.contactCount || 0, icon: '🔢' },
            { label: 'Deal Value', value: lead.dealValue ? `GH₵ ${lead.dealValue.toLocaleString()}` : 'Not set', icon: '💰' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-sm">{icon}</span>
              <div>
                <div className="text-xs text-slate-400">{label}</div>
                <div className="text-sm font-medium text-slate-700">{value || '—'}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Enrichment data */}
        {(lead.jobTitle || lead.industry || lead.linkedinUrl || lead.website) && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Job Title', value: lead.jobTitle },
              { label: 'Industry', value: lead.industry },
              { label: 'LinkedIn', value: lead.linkedinUrl },
              { label: 'Website', value: lead.website },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <div className="text-xs text-slate-400">{label}</div>
                <div className="text-xs font-medium text-slate-600 truncate">{label === 'LinkedIn' || label === 'Website'
                  ? <a href={value as string} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">{value}</a>
                  : value}
                </div>
              </div>
            ) : null)}
          </div>
        )}

        {/* Tags */}
        {lead.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {(lead.tags as string[]).map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full border border-amber-200">{tag}</span>
            ))}
          </div>
        )}

        {/* Stage change */}
        <div className="mt-4">
          <div className="text-xs text-slate-400 mb-2">Move to stage:</div>
          <div className="flex flex-wrap gap-2">
            {STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => handleStageChange(s.key)}
                disabled={updatingStage || s.key === lead.stage}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 ${
                  s.key === lead.stage
                    ? `${s.color} border-current`
                    : 'border-gray-200 text-slate-400 hover:border-gray-400 hover:text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-4">
        {(['timeline', 'outreach', 'edit'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {tab === 'timeline' ? '📋 Timeline' : tab === 'outreach' ? '💬 Outreach Log' : '✏️ Edit'}
          </button>
        ))}
      </div>

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <div>
          {/* Add activity */}
          {!addingNote ? (
            <button onClick={() => setAddingNote(true)}
              className="w-full mb-4 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-slate-400 hover:border-amber-400 hover:text-amber-600 transition-colors">
              + Log activity — note, call, WhatsApp…
            </button>
          ) : (
            <form onSubmit={handleAddActivity} className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <div className="flex gap-2 mb-3">
                {['note', 'call', 'whatsapp', 'email'].map(t => (
                  <button type="button" key={t} onClick={() => setNoteType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border ${noteType === t ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-gray-200 text-slate-400'}`}>
                    {ACTIVITY_ICONS[t]} {t}
                  </button>
                ))}
              </div>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                rows={3}
                placeholder="What happened? Call notes, meeting summary, follow-up needed…"
                autoFocus
              />
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => { setAddingNote(false); setNewNote(''); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-slate-400 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingNote || !newNote.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                  {savingNote ? 'Saving…' : 'Save Activity'}
                </button>
              </div>
            </form>
          )}

          {/* Activity feed */}
          <div className="space-y-3">
            {activities.length === 0 && (
              <div className="text-center py-8 text-slate-300 text-sm">No activities yet</div>
            )}
            {activities.map(act => (
              <div key={act.id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3">
                <span className="text-xl flex-shrink-0">{ACTIVITY_ICONS[act.type] || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase">{act.type}</span>
                    <span className="text-xs text-slate-300">{timeAgo(act.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{act.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outreach tab */}
      {activeTab === 'outreach' && (
        <div>
          {outboundMessages.length === 0 ? (
            <div className="text-center py-8 text-slate-300 text-sm">No outreach messages sent yet</div>
          ) : (
            <div className="space-y-3">
              {outboundMessages.map(msg => (
                <div key={msg.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{msg.channel === 'whatsapp' ? '💬' : msg.channel === 'email' ? '📧' : '💬'}</span>
                      <span className="text-xs font-semibold text-slate-400 uppercase">{msg.channel}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${OUTREACH_STATUS_COLORS[msg.status] || 'bg-gray-100 text-gray-500'}`}>
                        {msg.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-300">{formatDate(msg.sentAt || msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 bg-gray-50 rounded-lg p-3">{msg.content}</p>
                  {msg.failureReason && (
                    <p className="text-xs text-red-400 mt-2">❌ {msg.failureReason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit tab */}
      {activeTab === 'edit' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-heading text-lg text-slate-800 mb-4">Edit Lead Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'company', label: 'Company', type: 'text' },
              { key: 'phone', label: 'Phone', type: 'tel' },
              { key: 'email', label: 'Email', type: 'email' },
              { key: 'jobTitle', label: 'Job Title', type: 'text' },
              { key: 'industry', label: 'Industry', type: 'text' },
              { key: 'linkedinUrl', label: 'LinkedIn URL', type: 'url' },
              { key: 'website', label: 'Website', type: 'url' },
              { key: 'dealValue', label: 'Deal Value (GH₵)', type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
                <input
                  type={type}
                  value={(editData[key] || '') as string}
                  onChange={e => setEditData((d: any) => ({ ...d, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Next Follow-up</label>
              <input
                type="date"
                value={editData.nextFollowUp ? String(editData.nextFollowUp).slice(0, 10) : ''}
                onChange={e => setEditData((d: any) => ({ ...d, nextFollowUp: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setActiveTab('timeline')}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-slate-500 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSaveEdit}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}