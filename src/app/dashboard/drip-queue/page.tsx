'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function DripQueuePage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'sent' | 'failed'>('pending');

  useEffect(() => {
    loadMessages();
  }, [tab]);

  async function loadMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/drip?status=${tab}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this scheduled message?')) return;
    await fetch(`/api/drip/${id}`, { method: 'DELETE' }).catch(() => {});
    toast.success('Cancelled');
    loadMessages();
  }

  const statusColor = (s: string) => {
    if (s === 'SENT') return 'bg-green-50 text-green-600';
    if (s === 'FAILED') return 'bg-red-50 text-red-500';
    return 'bg-amber/10 text-amber';
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-slate">Drip Queue</h1>
        <p className="text-sm text-slate-light mt-0.5">Scheduled messages waiting to be sent</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-btn p-1 w-fit">
        {(['pending', 'sent', 'failed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              tab === t ? 'bg-white text-slate shadow-sm' : 'text-slate-light hover:text-slate'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-light">Loading...</div>
      ) : messages.length === 0 ? (
        <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">📬</div>
          <p className="text-slate-light">
            {tab === 'pending' ? 'No messages waiting in queue' : `No ${tab} messages`}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Contact</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Message</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Channel</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Scheduled</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {messages.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-slate">{m.contact?.name || '—'}</div>
                    <div className="text-xs text-slate-light font-mono">{m.contact?.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate max-w-xs truncate">{m.template}</td>
                  <td className="px-6 py-4 text-xs text-slate-light capitalize">{m.channel}</td>
                  <td className="px-6 py-4 text-xs text-slate-light">
                    {m.scheduledFor ? new Date(m.scheduledFor).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(m.status)}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {m.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(m.id)}
                        className="text-slate-light hover:text-red-500 transition-colors"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
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