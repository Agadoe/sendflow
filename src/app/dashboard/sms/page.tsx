'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

type Segment = { id: string; name: string; tag: string; count?: number };
type SmsConfig = { configured: boolean; provider: string; senderId: string; rateGhs: number };
type Campaign = {
  id: string; name: string; content: string; status: string; channel: string;
  scheduledAt: string | null; sentAt: string | null; _count: { messages: number };
};

export default function SmsPage() {
  const [showModal, setShowModal] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [config, setConfig] = useState<SmsConfig | null>(null);
  const [busy, setBusy] = useState<string>('');

  // form
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');

  // live preview
  const [recipients, setRecipients] = useState(0);
  const [optedIn, setOptedIn] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  // test sms
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('');

  const loadAll = useCallback(() => {
    fetch('/api/segments').then((r) => r.json()).then((d) => setSegments(d.segments || [])).catch(() => {});
    fetch('/api/sms', { method: 'GET' }).then((r) => r.json()).then(setConfig).catch(() => {});
    fetch('/api/campaigns').then((r) => r.json()).then((d) => {
      // Only SMS-channel campaigns belong on this page.
      setCampaigns((d.campaigns || []).filter((c: Campaign) => c.channel === 'sms'));
    }).catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Live-resolve selected segments → recipient + opted-in counts for the
  // cost/consent preview. Mirrors the WhatsApp campaigns modal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (segmentIds.length === 0) { setRecipients(0); setOptedIn(0); return; }
      setPreviewing(true);
      try {
        const res = await fetch('/api/segments/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentIds }),
        });
        const d = await res.json();
        if (!cancelled) { setRecipients(d.count || 0); setOptedIn(d.optedInCount || 0); }
      } catch { /* ignore — preview is best-effort */ } finally {
        if (!cancelled) setPreviewing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [segmentIds]);

  const toggleSegment = (id: string) =>
    setSegmentIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const charCount = message.length;
  const segmentsCount = Math.max(1, Math.ceil(charCount / 160));
  const estCost = config ? Math.round(optedIn * config.rateGhs * 100) / 100 : 0;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    if (segmentIds.length === 0) { toast.error('Select at least one segment.'); return; }
    if (optedIn === 0) { toast.error('None of the selected contacts have opted in — nothing will send.'); return; }
    setBusy('create');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, content: message, segmentIds,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          channel: 'sms',
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(scheduledAt ? 'SMS campaign scheduled' : 'SMS campaign created');
        setShowModal(false);
        setName(''); setMessage(''); setSegmentIds([]); setScheduledAt('');
        loadAll();
      } else {
        toast.error(d.error || 'Create failed');
      }
    } catch { toast.error('Network error'); } finally { setBusy(''); }
  }

  async function handleSendNow(c: Campaign) {
    if (!confirm(`Send "${c.name}" now to its recipients via SMS? This costs real messages.`)) return;
    setBusy(c.id);
    toast.loading('Sending SMS campaign…', { id: `send-${c.id}` });
    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: c.id }),
      });
      const d = await res.json();
      toast.dismiss(`send-${c.id}`);
      if (res.ok) toast.success(`Sent ${d.sent ?? 0} SMS (skipped ${d.skipped ?? 0}, failed ${d.failed ?? 0})`);
      else toast.error(d.error || 'Send failed');
      loadAll();
    } catch { toast.dismiss(`send-${c.id}`); toast.error('Network error'); } finally { setBusy(''); }
  }

  async function handleTestSms(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim() || !testMsg.trim()) return;
    setBusy('test');
    toast.loading('Sending test SMS…', { id: 'test-sms' });
    try {
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMsg }),
      });
      const d = await res.json();
      toast.dismiss('test-sms');
      if (res.ok) { toast.success('Test SMS sent'); setTestPhone(''); setTestMsg(''); }
      else toast.error(d.error || 'Test failed');
    } catch { toast.dismiss('test-sms'); toast.error('Network error'); } finally { setBusy(''); }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-slate', SCHEDULED: 'bg-blue-100 text-blue-700',
      SENDING: 'bg-amber/20 text-amber', SENT: 'bg-green-100 text-green-700',
      FAILED: 'bg-red-100 text-red-700',
    };
    return map[s] || 'bg-gray-100 text-slate';
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-slate">SMS Marketing</h1>
          <p className="text-sm text-slate-light mt-0.5">
            Send bulk SMS campaigns to opted-in contacts via {config?.provider || 'Arkesel'}.
            {config && (
              <span className={config.configured ? 'text-green-600' : 'text-red-500'}>
                {' '}· {config.configured ? 'Gateway configured' : 'Gateway NOT configured — set SMS_API_KEY'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
        >
          New SMS Campaign
        </button>
      </div>

      {/* Test SMS — verify the provider key end-to-end with one message */}
      <div className="bg-surface rounded-card border border-gray-100 p-5">
        <h3 className="font-heading text-lg text-slate mb-3">Send a test SMS</h3>
        <form onSubmit={handleTestSms} className="flex flex-col sm:flex-row gap-2">
          <input
            placeholder="+233 55 123 4567"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="px-3 py-2 rounded-btn border border-gray-200 text-sm w-full sm:w-48"
          />
          <input
            placeholder="Test message"
            value={testMsg}
            onChange={(e) => setTestMsg(e.target.value)}
            className="px-3 py-2 rounded-btn border border-gray-200 text-sm flex-1"
          />
          <button
            type="submit"
            disabled={busy === 'test' || !testPhone.trim() || !testMsg.trim()}
            className="px-4 py-2 rounded-btn bg-slate text-white text-sm font-medium disabled:opacity-60"
          >
            {busy === 'test' ? 'Sending…' : 'Send test'}
          </button>
        </form>
      </div>

      {/* Campaign list */}
      <div className="bg-surface rounded-card border border-gray-100 p-5">
        <h3 className="font-heading text-lg text-slate mb-3">SMS Campaigns</h3>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-light text-center py-8">
            No SMS campaigns yet. Create one to send a bulk SMS broadcast.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {campaigns.map((c) => (
              <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate truncate">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(c.status)}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-slate-light truncate mt-0.5">
                    {c._count.messages} recipients
                    {c.scheduledAt && ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}`}
                  </div>
                </div>
                {(c.status === 'DRAFT') && (
                  <button
                    onClick={() => handleSendNow(c)}
                    disabled={busy === c.id}
                    className="px-3 py-1.5 rounded-btn bg-amber hover:bg-amber-dark text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {busy === c.id ? 'Sending…' : 'Send now'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New campaign modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-surface">
              <h3 className="font-heading text-xl text-slate">New SMS Campaign</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-light hover:text-slate">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Campaign name</label>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Malejor SMS promo"
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Message</label>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Hi {{name}}! Don't miss out…"
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-sm resize-none"
                />
                <div className="text-xs text-slate-light mt-1">
                  {charCount} chars · {segmentsCount} SMS segment{segmentsCount === 1 ? '' : 's'} per recipient
                  {charCount > 160 && ' (over 160 will be split)'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Segments</label>
                {segments.length === 0 ? (
                  <p className="text-xs text-slate-light">No segments yet. Create segments on the Segments page first.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {segments.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-slate cursor-pointer">
                        <input
                          type="checkbox" checked={segmentIds.includes(s.id)}
                          onChange={() => toggleSegment(s.id)}
                        />
                        <span>{s.name}</span>
                        {s.count !== undefined && <span className="text-xs text-slate-light">({s.count})</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Schedule (optional)</label>
                <input
                  type="datetime-local" value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="px-4 py-2.5 rounded-btn border border-gray-200 text-sm"
                />
              </div>

              {/* Cost + consent preview */}
              {segmentIds.length > 0 && (
                <div className="bg-amber/5 border border-amber/10 rounded-lg px-4 py-3 text-sm text-slate space-y-1">
                  <div className="flex justify-between">
                    <span>Recipients in segments</span>
                    <span className="font-medium">{previewing ? '…' : recipients}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opted in (will receive)</span>
                    <span className="font-medium text-green-700">{previewing ? '…' : optedIn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Skipped (not opted in)</span>
                    <span className="font-medium text-slate-light">{previewing ? '…' : recipients - optedIn}</span>
                  </div>
                  {config && config.rateGhs > 0 && (
                    <div className="flex justify-between border-t border-amber/10 pt-1 mt-1">
                      <span>Estimated cost</span>
                      <span className="font-bold">GHS {estCost.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === 'create' || !name.trim() || !message.trim() || segmentIds.length === 0}
                  className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold disabled:opacity-60"
                >
                  {busy === 'create' ? 'Creating…' : scheduledAt ? 'Schedule' : 'Create campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}