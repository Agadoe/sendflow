'use client';

import { useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import toast, { Toaster } from 'react-hot-toast';

interface InboundEmail {
  id: string;
  uid: number;
  fromAddress: string;
  fromName: string | null;
  toAddress: string;
  subject: string | null;
  snippet: string;
  receivedAt: string | null;
  sentAt: string | null;
  read: boolean;
  readAt: string | null;
  attachments: string | null;
  matchedContactId: string | null;
  fetchedAt: string;
}

interface FullEmail extends InboundEmail {
  cc: string | null;
  textBody: string | null;
  htmlBody: string | null;
  messageId: string | null;
}

interface FetchResult {
  ok: boolean;
  scanned: number;
  inserted: number;
  errors: number;
  durationMs: number;
  error?: string;
}

export default function InboxPage() {
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<FullEmail | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastFetch, setLastFetch] = useState<FetchResult | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'unread') params.set('unread', 'true');
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setEmails(data.emails || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      toast.error('Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [filter, q]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  async function openEmail(id: string) {
    setSelectedLoading(true);
    try {
      const res = await fetch(`/api/inbox/${id}`);
      if (!res.ok) throw new Error('open failed');
      const data = await res.json();
      setSelected(data.email);
      // Optimistic update in the list
      setEmails((cur) =>
        cur.map((e) => (e.id === id ? { ...e, read: true, readAt: new Date().toISOString() } : e))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to open email');
    } finally {
      setSelectedLoading(false);
    }
  }

  async function refreshFromServer() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/inbox?fetch=1');
      if (!res.ok) throw new Error('fetch trigger failed');
      const data = await res.json();
      setLastFetch(data.fetchResult || null);
      if (data.fetchResult?.inserted > 0) {
        toast.success(`Fetched ${data.fetchResult.inserted} new message(s)`);
      } else if (data.fetchResult?.error) {
        toast.error(`IMAP error: ${data.fetchResult.error.slice(0, 80)}`);
      } else {
        toast.success('Mailbox up to date');
      }
      await fetchList();
    } catch (e) {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleRead(id: string, currentRead: boolean) {
    try {
      await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read: !currentRead }),
      });
      setEmails((cur) =>
        cur.map((e) =>
          e.id === id
            ? { ...e, read: !currentRead, readAt: !currentRead ? new Date().toISOString() : null }
            : e
        )
      );
      if (currentRead) setUnreadCount((c) => c + 1);
      else setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to update');
    }
  }

  async function deleteEmail(id: string) {
    if (!confirm('Delete this email from the inbox?')) return;
    try {
      await fetch(`/api/inbox?id=${id}`, { method: 'DELETE' });
      setEmails((cur) => cur.filter((e) => e.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function displayAddress(email: InboundEmail): string {
    if (email.fromName) return `${email.fromName} <${email.fromAddress}>`;
    return email.fromAddress;
  }

  function parseAttachments(s: string | null): Array<{ filename: string; contentType: string; size: number | null }> {
    if (!s) return [];
    try {
      return JSON.parse(s);
    } catch {
      return [];
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading text-slate">Inbox</h1>
          <p className="text-sm text-slate-light mt-1">
            {unreadCount > 0 ? `${unreadCount} unread of ${total}` : `${total} total`} •{' '}
            <span className="text-slate">sendflow@baahe.org</span>
            {lastFetch && (
              <span className="ml-2 text-xs">
                • last fetch: {lastFetch.inserted} new in {Math.round(lastFetch.durationMs)}ms
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshFromServer}
            disabled={refreshing}
            className="px-4 py-2 rounded-btn text-sm bg-gold text-white hover:bg-gold-dark disabled:opacity-50"
          >
            {refreshing ? 'Fetching…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search subject, sender, snippet…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 px-4 py-2 rounded-btn text-sm border border-cream-dark focus:outline-none focus:border-gold"
        />
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-btn text-sm ${
            filter === 'all' ? 'bg-slate text-cream' : 'bg-cream text-slate hover:bg-cream-dark'
          }`}
        >
          All ({total})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-btn text-sm ${
            filter === 'unread' ? 'bg-slate text-cream' : 'bg-cream text-slate hover:bg-cream-dark'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-12 text-slate-light">Loading…</div>
          ) : emails.length === 0 ? (
            <div className="bg-white border border-cream-dark rounded-card p-12 text-center">
              <p className="text-slate-light mb-2">Inbox is empty.</p>
              <p className="text-xs text-slate-light">
                Send an email to <code className="bg-cream px-1 rounded">sendflow@baahe.org</code> and click
                Refresh, or wait for the 2-minute cron.
              </p>
            </div>
          ) : (
            emails.map((e) => (
              <button
                key={e.id}
                onClick={() => openEmail(e.id)}
                className={`w-full text-left p-4 rounded-card border transition ${
                  e.read
                    ? 'bg-white border-cream-dark hover:border-gold/40'
                    : 'bg-cream border-gold/30 hover:border-gold'
                } ${selected?.id === e.id ? 'ring-2 ring-gold' : ''}`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className={`text-sm truncate ${e.read ? 'text-slate' : 'font-semibold text-slate'}`}>
                    {displayAddress(e)}
                  </span>
                  <span className="text-xs text-slate-light ml-2 shrink-0">{formatDate(e.receivedAt)}</span>
                </div>
                <div className={`text-sm mb-1 truncate ${e.read ? 'text-slate-light' : 'text-slate font-medium'}`}>
                  {e.subject || '(no subject)'}
                </div>
                <div className="text-xs text-slate-light truncate">{e.snippet}</div>
                {parseAttachments(e.attachments).length > 0 && (
                  <div className="text-xs text-slate-light mt-1">
                    📎 {parseAttachments(e.attachments).length} attachment(s)
                  </div>
                )}
                {e.matchedContactId && (
                  <div className="text-xs text-gold mt-1">↔ linked to contact form submission</div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="bg-white border border-cream-dark rounded-card p-6 min-h-[400px] sticky top-6 self-start">
          {!selected ? (
            <div className="text-center py-12 text-slate-light">
              Select a message to read.
            </div>
          ) : selectedLoading ? (
            <div className="text-center py-12 text-slate-light">Loading…</div>
          ) : (
            <div>
              <div className="border-b border-cream-dark pb-3 mb-4">
                <h2 className="text-lg font-semibold text-slate mb-2">
                  {selected.subject || '(no subject)'}
                </h2>
                <div className="text-sm text-slate-light space-y-1">
                  <div>
                    <strong className="text-slate">From:</strong> {displayAddress(selected)}
                  </div>
                  <div>
                    <strong className="text-slate">To:</strong> {selected.toAddress}
                  </div>
                  {selected.cc && (
                    <div>
                      <strong className="text-slate">CC:</strong> {selected.cc}
                    </div>
                  )}
                  <div>
                    <strong className="text-slate">Received:</strong>{' '}
                    {selected.receivedAt
                      ? new Date(selected.receivedAt).toLocaleString('en-GB', {
                          timeZone: 'Africa/Accra',
                        }) + ' GMT'
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="prose prose-sm max-w-none text-slate">
                {selected.htmlBody ? (
                  <div
                    className="email-html"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selected.htmlBody) }}
                  />
                ) : selected.textBody ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{selected.textBody}</pre>
                ) : (
                  <p className="text-slate-light italic">No body content.</p>
                )}
              </div>

              {parseAttachments(selected.attachments).length > 0 && (
                <div className="mt-4 pt-4 border-t border-cream-dark">
                  <p className="text-xs text-slate-light mb-2">Attachments:</p>
                  <ul className="space-y-1">
                    {parseAttachments(selected.attachments).map((a, i) => (
                      <li key={i} className="text-xs text-slate">
                        📎 {a.filename} <span className="text-slate-light">({a.contentType})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-light mt-2 italic">
                    Attachment download is not yet implemented. Reply via Gmail for now.
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-2 pt-4 border-t border-cream-dark">
                <button
                  onClick={() => toggleRead(selected.id, selected.read)}
                  className="px-3 py-1.5 rounded-btn text-xs bg-cream hover:bg-cream-dark text-slate"
                >
                  Mark as {selected.read ? 'unread' : 'read'}
                </button>
                <a
                  href={`mailto:${selected.fromAddress}?subject=Re: ${encodeURIComponent(selected.subject || '')}`}
                  className="px-3 py-1.5 rounded-btn text-xs bg-gold text-white hover:bg-gold-dark"
                >
                  Reply via Gmail
                </a>
                <button
                  onClick={() => deleteEmail(selected.id)}
                  className="px-3 py-1.5 rounded-btn text-xs bg-red-50 text-red-700 hover:bg-red-100 ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .email-html img { max-width: 100%; height: auto; }
        .email-html a { color: #C8922A; }
      `}</style>
    </div>
  );
}
