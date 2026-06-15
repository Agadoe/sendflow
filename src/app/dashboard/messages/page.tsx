'use client';

import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  ip: string | null;
  userAgent: string | null;
  read: boolean;
  readAt: string | null;
  readBy: string | null;
  emailSent: boolean;
  emailError: string | null;
  createdAt: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchMessages();
  }, [filter]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const url = filter === 'unread' ? '/api/contact?unread=true' : '/api/contact';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMessages(data.messages || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function toggleRead(msg: ContactMessage) {
    try {
      const res = await fetch('/api/contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, read: !msg.read }),
      });
      if (!res.ok) throw new Error('Failed');
      // Update local state
      setMessages(prev =>
        prev.map(m => (m.id === msg.id ? { ...m, read: !m.read, readAt: !m.read ? new Date().toISOString() : null } : m))
      );
      setUnreadCount(c => c + (!msg.read ? -1 : 1));
      if (selected?.id === msg.id) {
        setSelected(s => (s ? { ...s, read: !s.read } : s));
      }
    } catch {
      toast.error('Failed to update');
    }
  }

  async function deleteMessage(msg: ContactMessage) {
    if (!confirm(`Delete message from ${msg.name}?`)) return;
    try {
      const res = await fetch(`/api/contact?id=${msg.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      if (!msg.read) setUnreadCount(c => c - 1);
      if (selected?.id === msg.id) setSelected(null);
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function resendEmail(msg: ContactMessage) {
    toast.loading('Resending notification...', { id: 'resend' });
    try {
      // For now, just re-create with same content via a side-effect endpoint.
      // Simpler: copy the message content to a fresh "POST /api/contact" with the same fields.
      // This requires the user's email; for now, we just notify Don to check the row.
      // TODO: add /api/contact/resend that re-fires SMTP only.
      toast.error('Resend endpoint not yet built — check the row for emailError', { id: 'resend' });
    } catch {
      toast.error('Failed', { id: 'resend' });
    }
  }

  function relativeTime(iso: string) {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster position="top-center" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading text-slate">Contact Messages</h1>
          <p className="text-sm text-slate-light mt-1">
            {total} total · {unreadCount} unread
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-btn text-sm ${
              filter === 'all' ? 'bg-slate text-white' : 'bg-white border border-slate-200 text-slate'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-btn text-sm ${
              filter === 'unread' ? 'bg-amber text-white' : 'bg-white border border-slate-200 text-slate'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-12 text-slate-light">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-slate-light">
              {filter === 'unread' ? 'No unread messages' : 'No messages yet'}
            </div>
          ) : (
            messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => {
                  setSelected(msg);
                  if (!msg.read) toggleRead(msg);
                }}
                className={`w-full text-left p-4 rounded-card border transition ${
                  selected?.id === msg.id
                    ? 'border-amber bg-amber/5'
                    : msg.read
                    ? 'bg-white border-slate-200'
                    : 'bg-white border-l-4 border-l-amber border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-slate truncate ${msg.read ? '' : 'font-bold'}`}>
                        {msg.name}
                      </span>
                      {!msg.read && (
                        <span className="bg-amber text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          NEW
                        </span>
                      )}
                      {!msg.emailSent && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-medium px-1.5 py-0.5 rounded" title={msg.emailError || ''}>
                          ✉ FAILED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-light truncate">{msg.subject || msg.message.slice(0, 60)}</p>
                  </div>
                  <span className="text-xs text-slate-light whitespace-nowrap">
                    {relativeTime(msg.createdAt)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="lg:sticky lg:top-6">
          {selected ? (
            <div className="bg-white border border-slate-200 rounded-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-heading text-slate">{selected.name}</h2>
                  <p className="text-sm text-slate-light">
                    {new Date(selected.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Accra' })} GMT
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleRead(selected)}
                    className="text-xs px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50"
                  >
                    {selected.read ? 'Mark unread' : 'Mark read'}
                  </button>
                  <button
                    onClick={() => deleteMessage(selected)}
                    className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <dl className="space-y-2 text-sm border-t border-slate-200 pt-4">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-light">Email</dt>
                  <dd className="col-span-2">
                    <a href={`mailto:${selected.email}`} className="text-amber hover:underline">
                      {selected.email}
                    </a>
                  </dd>
                </div>
                {selected.phone && (
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-slate-light">Phone</dt>
                    <dd className="col-span-2 text-slate">
                      <a href={`https://wa.me/${selected.phone.replace(/[^\d+]/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {selected.phone} <span className="text-xs text-slate-light">(WhatsApp)</span>
                      </a>
                    </dd>
                  </div>
                )}
                {selected.subject && (
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-slate-light">Subject</dt>
                    <dd className="col-span-2 text-slate">{selected.subject}</dd>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-light">IP</dt>
                  <dd className="col-span-2 text-slate font-mono text-xs">{selected.ip || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-light">Email sent</dt>
                  <dd className="col-span-2">
                    {selected.emailSent ? (
                      <span className="text-green-700">✓ Yes</span>
                    ) : (
                      <span className="text-red-700">✕ Failed</span>
                    )}
                    {selected.emailError && (
                      <div className="text-xs text-red-600 mt-1 font-mono">{selected.emailError}</div>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-light uppercase mb-2">Message</p>
                <p className="text-slate whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-card p-12 text-center text-slate-light">
              Select a message to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
