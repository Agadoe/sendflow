'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  plan: string;
  createdAt: string;
  _count: {
    leads: number;
    campaigns: number;
    contacts: number;
  };
}

interface NewClient {
  name: string;
  email: string;
  phone: string;
  company: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newClient, setNewClient] = useState<NewClient>({ name: '', email: '', phone: '', company: '' });
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string; shareMessage: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push('/login'); return; }
        setClients(d.clients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setResult(null);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClient.name,
          email: newClient.email,
          phone: newClient.phone || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to create client');
        return;
      }

      setClients([data.client, ...clients]);
      setResult({ tempPassword: data.tempPassword, shareMessage: data.shareMessage });
      setNewClient({ name: '', email: '', phone: '', company: '' });
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this client account? This cannot be undone.')) return;
    setDeletingId(id);

    try {
      await fetch('/api/clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setClients(clients.filter(c => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-light">Loading clients...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-heading text-slate">Client Accounts</h1>
          <p className="text-sm text-slate-light mt-1">{clients.length} active client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setResult(null); }}
          className="px-5 py-2.5 bg-amber text-white rounded-xl font-medium hover:bg-amber/90 transition"
        >
          {showForm ? '✕ Cancel' : '+ Add Client'}
        </button>
      </div>

      {/* Add client form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="font-heading text-lg text-slate mb-4">New Client Account</h2>
          <form onSubmit={handleCreate} className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Kwame Asante"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-slate text-sm focus:border-amber focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1.5">Work Email *</label>
                <input
                  type="email"
                  required
                  value={newClient.email}
                  onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="kwame@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-slate text-sm focus:border-amber focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1.5">Phone (optional)</label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="+233 24 000 0000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-slate text-sm focus:border-amber focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1.5">Company</label>
                <input
                  type="text"
                  value={newClient.company}
                  onChange={e => setNewClient({ ...newClient, company: e.target.value })}
                  placeholder="Asante Logistics Ltd"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-slate text-sm focus:border-amber focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 bg-amber text-white rounded-xl font-medium hover:bg-amber/90 transition disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Account & Generate Password'}
            </button>
          </form>
        </div>
      )}

      {/* Temp password result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-green-800 mb-3">✅ Client account created!</h3>
          <div className="bg-white rounded-xl p-4 border border-green-200 mb-4">
            <p className="text-xs text-slate-light font-medium mb-2">SEND THESE DETAILS TO YOUR CLIENT:</p>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-light">Email:</span> <span className="font-mono font-semibold">{newClient.email || clients[0]?.email}</span></p>
              <p><span className="text-slate-light">Password:</span> <span className="font-mono font-semibold text-lg">{result.tempPassword}</span></p>
            </div>
          </div>
          <p className="text-xs text-green-700">
            Share the login link: <span className="font-mono">https://sendflow-two.vercel.app/client-portal</span>
          </p>
        </div>
      )}

      {/* Clients table */}
      {clients.length === 0 ? (
        <div className="text-center py-16 text-slate-light">
          <div className="text-4xl mb-4">👥</div>
          <p className="font-medium">No client accounts yet</p>
          <p className="text-sm mt-1">Click "Add Client" to create the first one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wide">Client</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wide">Leads</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wide hidden sm:table-cell">Campaigns</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wide hidden sm:table-cell">Contacts</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b border-gray-50 last:border-0 hover:bg-cream/30 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate">{client.name}</div>
                    <div className="text-xs text-slate-light">{client.email}</div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="text-sm text-slate">{client.phone || '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber/10 text-amber font-semibold text-sm">
                      {client._count.leads}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center hidden sm:table-cell">
                    <span className="text-sm text-slate-light">{client._count.campaigns}</span>
                  </td>
                  <td className="px-6 py-4 text-center hidden sm:table-cell">
                    <span className="text-sm text-slate-light">{client._count.contacts}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(client.id)}
                      disabled={deletingId === client.id}
                      className="text-xs text-red-400 hover:text-red-600 font-medium transition disabled:opacity-40"
                    >
                      {deletingId === client.id ? 'Deleting...' : 'Delete'}
                    </button>
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