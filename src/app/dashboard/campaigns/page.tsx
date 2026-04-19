'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', content: '', scheduledAt: '' });
  const [creating, setCreating] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState<string | null>(null);
  const [contactIds, setContactIds] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(d => setCampaigns(d.campaigns || [])).catch(() => {});
    fetch('/api/contacts').then(r => r.json()).then(d => setContactIds(d.contacts?.map((c: any) => c.id) || [])).catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.content) return;
    setCreating(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contactIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaigns([data.campaign, ...campaigns]);
        setShowModal(false);
        setForm({ name: '', content: '', scheduledAt: '' });
        toast.success('Campaign created!');
      } else {
        toast.error(data.error || 'Failed');
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(campaignId: string) {
    setSendingCampaign(campaignId);
    toast.loading('Sending messages... this may take a while', { id: 'sending' });
    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      toast.dismiss('sending');
      if (res.ok) {
        toast.success(`Sent: ${data.sent}/${data.total} messages delivered`);
        // Refresh campaigns
        const updated = await fetch('/api/campaigns').then(r => r.json());
        setCampaigns(updated.campaigns || []);
      } else {
        toast.error(data.error || 'Send failed');
      }
    } catch {
      toast.dismiss('sending');
      toast.error('Network error');
    } finally {
      setSendingCampaign(null);
    }
  }

  const statusColor = (s: string) => {
    if (s === 'SENT') return 'bg-green-100 text-green-700';
    if (s === 'SENDING') return 'bg-amber/10 text-amber';
    if (s === 'SCHEDULED') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-slate-light';
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-slate">Campaigns</h1>
          <p className="text-sm text-slate-light mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} created</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">📨</div>
          <h3 className="font-heading text-xl text-slate mb-2">No campaigns yet</h3>
          <p className="text-slate-light mb-6 max-w-sm mx-auto">Create your first campaign and start reaching your customers on WhatsApp.</p>
          <button onClick={() => setShowModal(true)} className="bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors">
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Campaign</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Messages</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate text-sm">{c.name}</div>
                    <div className="text-xs text-slate-light mt-0.5 truncate max-w-xs">{c.content}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate">{c._count?.messages || 0}</td>
                  <td className="px-6 py-4 text-xs text-slate-light">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {c.status === 'DRAFT' && (
                      <button
                        onClick={() => handleSend(c.id)}
                        disabled={sendingCampaign === c.id}
                        className="flex items-center gap-1.5 text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-btn font-medium transition-colors disabled:opacity-60"
                      >
                        {sendingCampaign === c.id ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Send
                          </>
                        )}
                      </button>
                    )}
                    {c.status === 'SENT' && (
                      <span className="text-xs text-green-600 font-medium">✓ Sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading text-xl text-slate">New Campaign</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-light hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Easter Promo - 20% off braids"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Message *</label>
                <textarea
                  placeholder="Hi {{name}}! Don't forget to claim your discount today..."
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                  required
                />
                <div className="text-xs text-slate-light mt-1">Tip: Use {"{{name}}"} for personalized messages. Unicode and emoji supported! 💇‍♀️</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate focus:outline-none focus:ring-2 focus:ring-amber/40"
                />
              </div>
              <div className="bg-amber/5 border border-amber/10 rounded-lg px-4 py-3 text-sm text-slate">
                <span className="font-semibold">📋 Ready to send to {contactIds.length} contacts</span>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {creating ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {creating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}