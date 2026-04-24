'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function EmailPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [audiences, setAudiences] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ campaignName: '', subject: '', content: '', audienceId: '' });
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/email/campaigns').then(r => r.json()).catch(() => ({})),
      fetch('/api/email/audiences').then(r => r.json()).catch(() => ({})),
    ]).then(([cData, aData]) => {
      setCampaigns(cData.campaigns || []);
      setAudiences(aData.audiences || []);
      setLoading(false);
    });
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.campaignName || !form.subject || !form.content || !form.audienceId) return;
    setSending(true);
    toast.loading('Sending email campaign...', { id: 'email-send' });
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      toast.dismiss('email-send');
      if (res.ok) {
        toast.success('Email campaign sent!');
        setShowModal(false);
        setForm({ campaignName: '', subject: '', content: '', audienceId: '' });
        const refreshed = await fetch('/api/email/campaigns').then(r => r.json());
        setCampaigns(refreshed.campaigns || []);
      } else {
        toast.error(data.error || 'Send failed');
      }
    } catch {
      toast.dismiss('email-send');
      toast.error('Network error');
    } finally {
      setSending(false);
    }
  }

  const statusColor = (s: string) => {
    if (s === 'sent') return 'bg-blue-100 text-blue-700';
    if (s === 'sending') return 'bg-amber/10 text-amber';
    if (s === 'save') return 'bg-gray-100 text-slate-light';
    return 'bg-gray-100 text-slate-light';
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-slate">Email Marketing</h1>
          <p className="text-sm text-slate-light mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Create Email Campaign
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-light">Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h3 className="font-heading text-xl text-slate mb-2">No email campaigns yet</h3>
          <p className="text-sm text-slate-light mb-6 max-w-sm mx-auto">Create your first email campaign and reach your customers inbox.</p>
          <button onClick={() => setShowModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-btn transition-colors">
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Campaign</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Subject</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Opens</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate">{c.settings?.title || c.title || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-light">{c.settings?.subject_line || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(c.status)}`}>{c.status || 'draft'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate">{c.report_summary?.opens ? `${Math.round(c.report_summary.open_rate * 100)}%` : '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate">{c.report_summary?.clicks ? `${Math.round(c.report_summary.click_rate * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading text-xl text-slate">New Email Campaign</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-light hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSend} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Easter Sale Announcement"
                  value={form.campaignName}
                  onChange={e => setForm({ ...form, campaignName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Subject Line *</label>
                <input
                  type="text"
                  placeholder="e.g. You won't believe our Easter deals 🎉"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Audience *</label>
                <select
                  value={form.audienceId}
                  onChange={e => setForm({ ...form, audienceId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate"
                  required
                >
                  <option value="">Select an audience...</option>
                  {audiences.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.stats?.member_count} contacts)</option>
                  ))}
                </select>
                {audiences.length === 0 && (
                  <p className="text-xs text-slate-light mt-1">No Mailchimp audiences found. Add MAILCHIMP_API_KEY to .env.local</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Email Content (HTML) *</label>
                <textarea
                  placeholder="<p>Hi {{first_name}},</p>&#10;<p>Check out our latest offers...</p>"
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none font-mono text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={sending} className="flex-1 py-2.5 rounded-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {sending ? 'Sending...' : 'Send Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
