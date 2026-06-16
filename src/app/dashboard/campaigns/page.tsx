'use client';

import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', content: '', scheduledAt: '', recurrence: '' });
  const [creating, setCreating] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState<string | null>(null);
  const [sendProgress, setSendProgress] = useState<Record<string, { sent: number; total: number }>>({});
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
        setForm({ name: '', content: '', scheduledAt: '', recurrence: '' });
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
    toast.loading('Sending messages…', { id: `sending-${campaignId}` });

    let done = false;
    let attempts = 0;
    const maxAttempts = 200; // safety net (~15-20 min at 5s intervals)

    while (!done && attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch('/api/campaigns/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId, batchSize: 3 }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.dismiss(`sending-${campaignId}`);
          toast.error(data.error || 'Send failed');
          setSendingCampaign(null);
          return;
        }

        setSendProgress(prev => ({
          ...prev,
          [campaignId]: { sent: data.total - data.remaining, total: data.total }
        }));

        // Update toast with progress
        toast.loading(
          `Sending… ${data.total - data.remaining}/${data.total} messages`,
          { id: `sending-${campaignId}` }
        );

        if (data.done) {
          done = true;
          toast.dismiss(`sending-${campaignId}`);
          toast.success(`Campaign sent! ${data.sent} delivered, ${data.failed || 0} failed, ${data.skipped || 0} skipped.`);
          // Refresh campaigns
          const updated = await fetch('/api/campaigns').then(r => r.json());
          setCampaigns(updated.campaigns || []);
        } else {
          // Wait 5–8 seconds before next batch (keeps request short, avoids timeout)
          const pause = 5000 + Math.floor(Math.random() * 3000);
          await new Promise(r => setTimeout(r, pause));
        }
      } catch {
        toast.dismiss(`sending-${campaignId}`);
        toast.error('Network error — campaign may still be sending in background. Refresh to check status.');
        setSendingCampaign(null);
        return;
      }
    }

    setSendingCampaign(null);
    if (!done) {
      toast.dismiss(`sending-${campaignId}`);
      toast('Campaign send reached max attempts. Check campaigns page for final status.', { icon: '⏱️' });
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
              {campaigns.map((c: any) => {
                const progress = sendProgress[c.id];
                const isSending = sendingCampaign === c.id;
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate text-sm">{c.name}</div>
                      <div className="text-xs text-slate-light mt-0.5 truncate max-w-xs">{c.content}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
                      {isSending && progress && (
                        <div className="mt-1.5 w-32 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.round((progress.sent / progress.total) * 100)}%` }}
                          />
                        </div>
                      )}
                      {isSending && progress && (
                        <div className="text-[10px] text-slate-light mt-0.5">{progress.sent}/{progress.total}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate">{c._count?.messages || 0}</td>
                    <td className="px-6 py-4 text-xs text-slate-light">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {c.status === 'DRAFT' && (
                          <button
                            onClick={() => handleSend(c.id)}
                            disabled={isSending}
                            className="flex items-center gap-1.5 text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-btn font-medium transition-colors disabled:opacity-60"
                          >
                            {isSending ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending…
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
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/campaigns/${c.id}/duplicate`, { method: 'POST' });
                            const data = await res.json();
                            if (res.ok) {
                              setCampaigns([data.campaign, ...campaigns]);
                              toast.success('Campaign duplicated!');
                            } else {
                              toast.error(data.error || 'Failed to duplicate');
                            }
                          }}
                          className="flex items-center gap-1.5 text-sm text-slate-light hover:text-slate px-2 py-1.5 rounded-btn hover:bg-gray-100 transition-colors"
                          title="Duplicate"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {c.status === 'SENT' && (
                            <span className="text-xs text-green-600 font-medium">✓ Sent</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Toaster position="top-right" />

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
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Repeat (optional)</label>
                <select
                  value={form.recurrence || ''}
                  onChange={e => setForm({ ...form, recurrence: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate focus:outline-none focus:ring-2 focus:ring-amber/40"
                >
                  <option value="">Don't repeat</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
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
