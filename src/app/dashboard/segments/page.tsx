'use client';

import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface Segment {
  id: string;
  name: string;
  tag: string;
  color: string | null;
  description: string | null;
  matchType: string;
  contactCount: number;
  createdAt: string;
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', tag: '', color: '#3B82F6', description: '' });

  useEffect(() => {
    loadSegments();
  }, []);

  async function loadSegments() {
    try {
      const res = await fetch('/api/segments');
      const data = await res.json();
      if (res.ok) {
        setSegments(data.segments || []);
      } else {
        toast.error(data.error || 'Failed to load segments');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.tag) {
      toast.error('Name and tag are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          tag: form.tag,
          color: form.color || undefined,
          description: form.description || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSegments([...segments, data.segment].sort((a, b) => a.name.localeCompare(b.name)));
        setShowCreate(false);
        setForm({ name: '', tag: '', color: '#3B82F6', description: '' });
        toast.success(`Segment "${data.segment.name}" created`);
      } else {
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete segment "${name}"? Contacts keep the tag — only the saved filter is removed.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/segments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSegments(segments.filter((s) => s.id !== id));
        toast.success('Segment deleted');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Network error');
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-slate">Segments</h1>
          <p className="text-sm text-slate-light mt-0.5">
            Saved tag-filters for targeting contacts in campaigns. {segments.length} segment
            {segments.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Segment
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-light">Loading…</div>
      ) : segments.length === 0 ? (
        <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">🏷️</div>
          <h3 className="font-heading text-xl text-slate mb-2">No segments yet</h3>
          <p className="text-slate-light mb-6 max-w-md mx-auto">
            Segments are saved tag-filters. Once you create a segment, you can target it in
            the campaign modal — multi-select to send to multiple segments at once.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors"
          >
            Create First Segment
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Segment</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Tag</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Contacts</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {segments.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {s.color && (
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                      )}
                      <div>
                        <div className="font-medium text-slate text-sm">{s.name}</div>
                        {s.description && (
                          <div className="text-xs text-slate-light mt-0.5 max-w-xs truncate">
                            {s.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs bg-gray-100 text-slate px-2 py-0.5 rounded font-mono">
                      {s.tag}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={s.contactCount > 0 ? 'text-slate font-medium' : 'text-slate-light'}>
                      {s.contactCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-light">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="text-slate-light hover:text-red-500 transition-colors"
                      title="Delete segment"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-card max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-heading text-xl text-slate">New Segment</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-light hover:text-slate"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Name *</label>
                <input
                  type="text"
                  placeholder="phones-segment"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40 font-mono text-sm"
                  required
                />
                <div className="text-xs text-slate-light mt-1">
                  Lowercase kebab-case. The display name and the tag usually match.
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Tag to match *</label>
                <input
                  type="text"
                  placeholder="phones-segment"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value.toLowerCase() })}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40 font-mono text-sm"
                  required
                />
                <div className="text-xs text-slate-light mt-1">
                  The tag string that will be matched against contact tags. Tip: keep this
                  the same as the name unless you have a reason to differ.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate mb-1.5">Color</label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full h-10 rounded-btn border border-gray-200 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1.5">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Auto-tagged on phones CSV import"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                    maxLength={280}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {creating && (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {creating ? 'Creating…' : 'Create Segment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
