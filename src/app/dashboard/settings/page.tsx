'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: '', phone: '', prefillMsg: '', utmSource: '', utmMedium: '', utmCampaign: '' });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('links');

  // Team state
  const [members, setMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'EDITOR' });
  const [inviting, setInviting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'team') loadTeam();
    if (activeTab === 'apikeys') loadKeys();
  }, [activeTab]);

  async function loadTeam() {
    setTeamLoading(true);
    try {
      const res = await fetch('/api/settings/team');
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
        setIsOwner(data.isOwner || false);
      }
    } catch {} finally { setTeamLoading(false); }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.email) return;
    setInviting(true);
    try {
      const res = await fetch('/api/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.member) {
          setMembers([...members, data.member]);
        } else if (data.invite) {
          toast.success(`Invite link generated for ${inviteForm.email}`);
        }
        setShowInviteModal(false);
        setInviteForm({ email: '', role: 'EDITOR' });
      } else {
        toast.error(data.error || 'Failed');
      }
    } finally { setInviting(false); }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this team member?')) return;
    const res = await fetch(`/api/settings/team/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      setMembers(members.filter(m => m.id !== userId));
      toast.success('Member removed');
    }
  }

  async function handleChangeRole(userId: string, role: string) {
    const res = await fetch(`/api/settings/team/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setMembers(members.map(m => m.id === userId ? { ...m, role } : m));
      toast.success('Role updated');
    }
  }

  const roleBadgeColor = (role: string) => {
    if (role === 'OWNER' || role === 'ADMIN') return 'bg-purple-50 text-purple-700';
    if (role === 'EDITOR') return 'bg-blue-50 text-blue-600';
    return 'bg-gray-100 text-slate-light';
  };

  // API Keys functions
  async function loadKeys() {
    setKeysLoading(true);
    try {
      const res = await fetch('/api/keys');
      const data = await res.json();
      if (res.ok) setApiKeys(data.keys || []);
    } catch {} finally { setKeysLoading(false); }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName) return;
    setGeneratingKey(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedKey(data.key);
        setApiKeys([{ id: data.id, key: data.key, createdAt: data.createdAt, name: newKeyName }, ...apiKeys]);
        setNewKeyName('');
      } else {
        toast.error(data.error || 'Failed to create key');
      }
    } finally { setGeneratingKey(false); }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm('Delete this API key? Any integrations using it will stop working.')) return;
    const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setApiKeys(apiKeys.filter(k => k.id !== id));
      toast.success('API key deleted');
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function loadLinks() {
    try {
      const res = await fetch('/api/links');
      const data = await res.json();
      if (data.links) setLinks(data.links);
    } catch {}
  }

  function buildWaLink(phone: string, msg: string) {
    const clean = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(msg);
    return `https://wa.me/${clean}?text=${encoded}`;
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkForm.name || !linkForm.phone) return;
    setCreating(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkForm),
      });
      const data = await res.json();
      if (res.ok) {
        setLinks([data.link, ...links]);
        setShowLinkModal(false);
        setLinkForm({ name: '', phone: '', prefillMsg: '', utmSource: '', utmMedium: '', utmCampaign: '' });
        toast.success('Link created!');
      } else {
        toast.error(data.error || 'Failed');
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteLink(id: string) {
    if (!confirm('Delete this link?')) return;
    await fetch(`/api/links/${id}`, { method: 'DELETE' }).catch(() => {});
    setLinks(links.filter(l => l.id !== id));
    toast.success('Link deleted');
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(link);
    setTimeout(() => setCopied(null), 2000);
  }

  const waLink = (l: any) => {
    const base = `https://wa.me/${l.phone.replace(/\D/g, '')}?text=${encodeURIComponent(l.prefillMsg || '')}`;
    const params = new URLSearchParams();
    if (l.utmSource) params.set('utm_source', l.utmSource);
    if (l.utmMedium) params.set('utm_medium', l.utmMedium);
    if (l.utmCampaign) params.set('utm_campaign', l.utmCampaign);
    const qs = params.toString();
    return qs ? `${base}&${qs}` : base;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-slate">Settings</h1>
        <p className="text-sm text-slate-light mt-0.5">Manage your WhatsApp links, team, and account</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-btn p-1 w-fit">
        {['links', 'team', 'apikeys'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-slate shadow-sm' : 'text-slate-light hover:text-slate'
            }`}
          >
            {tab === 'links' ? 'Click-to-WhatsApp' : tab === 'team' ? 'Team Members' : 'API Keys'}
          </button>
        ))}
      </div>

      {/* Click-to-WhatsApp Tab */}
      {activeTab === 'links' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg text-slate">Click-to-WhatsApp Links</h2>
              <p className="text-xs text-slate-light mt-0.5">Share these links in ads, on your website, or on social media</p>
            </div>
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Link
            </button>
          </div>

          {links.length === 0 ? (
            <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
              <div className="text-5xl mb-4">🔗</div>
              <h3 className="font-heading text-xl text-slate mb-2">No links yet</h3>
              <p className="text-slate-light mb-6">Create your first click-to-WhatsApp link for your ads and website.</p>
              <button onClick={() => setShowLinkModal(true)} className="bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors">
                Create First Link
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((l: any) => (
                <div key={l.id} className="bg-surface rounded-card border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate">{l.name}</span>
                        <span className="text-xs bg-gray-100 text-slate-light px-2 py-0.5 rounded-full font-mono">{l.phone}</span>
                      </div>
                      {l.prefillMsg && <div className="text-sm text-slate-light mb-2 truncate">&ldquo;{l.prefillMsg}&rdquo;</div>}
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-50 text-slate-light px-2 py-1 rounded border border-gray-100 truncate max-w-md">{waLink(l)}</code>
                        <button
                          onClick={() => copyLink(waLink(l))}
                          className="text-slate-light hover:text-slate transition-colors shrink-0"
                          title="Copy link"
                        >
                          {copied === waLink(l) ? (
                            <svg className="w-4 h-4 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {(l.utmSource || l.utmMedium || l.utmCampaign) && (
                        <div className="flex gap-1 mt-2">
                          {l.utmSource && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">src: {l.utmSource}</span>}
                          {l.utmMedium && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">med: {l.utmMedium}</span>}
                          {l.utmCampaign && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">cmp: {l.utmCampaign}</span>}
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleDeleteLink(l.id)} className="text-slate-light hover:text-red-500 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Team Members Tab */}
      {activeTab === 'team' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg text-slate">Team Members</h2>
              <p className="text-xs text-slate-light mt-0.5">Manage who has access to your account</p>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite Member
              </button>
            )}
          </div>

          {!isOwner && (
            <div className="bg-amber/10 border border-amber/20 rounded-lg px-4 py-3 text-sm text-amber">
              Only the account owner can manage team members.
            </div>
          )}

          {teamLoading ? (
            <div className="text-center py-12 text-slate-light">Loading...</div>
          ) : members.length === 0 ? (
            <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-slate-light">No team members yet. Invite someone to collaborate.</p>
            </div>
          ) : (
            <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Joined</th>
                    {isOwner && <th className="px-6 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate">{m.name}</div>
                        <div className="text-xs text-slate-light">{m.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        {isOwner && m.role !== 'OWNER' ? (
                          <select
                            value={m.role}
                            onChange={e => handleChangeRole(m.id, e.target.value)}
                            className="text-xs px-2 py-1 rounded border border-gray-200 text-slate focus:outline-none focus:ring-2 focus:ring-amber/40"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="EDITOR">Editor</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadgeColor(m.role)}`}>
                            {m.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-light">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Pending invite'}
                      </td>
                      {isOwner && (
                        <td className="px-6 py-4">
                          {m.role !== 'OWNER' && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="text-slate-light hover:text-red-500 transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Role permission guide */}
          <div className="bg-gray-50 rounded-card border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-slate-light uppercase tracking-wider mb-3">Role Permissions</h4>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-purple-700 mb-1">Admin</div>
                <div className="text-slate-light">Manage team, billing & settings</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-blue-600 mb-1">Editor</div>
                <div className="text-slate-light">Create & send campaigns, manage contacts</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-slate-light mb-1">Viewer</div>
                <div className="text-slate-light">View reports and dashboards only</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading text-xl text-slate">New Click-to-WhatsApp Link</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-slate-light hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateLink} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Link Name *</label>
                <input type="text" placeholder="e.g. Facebook Ad - Easter Promo" value={linkForm.name} onChange={e => setLinkForm({ ...linkForm, name: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">WhatsApp Number *</label>
                <input type="text" placeholder="e.g. 233244123456" value={linkForm.phone} onChange={e => setLinkForm({ ...linkForm, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Pre-filled Message</label>
                <input type="text" placeholder="e.g. Hi! I saw your ad and I'm interested" value={linkForm.prefillMsg} onChange={e => setLinkForm({ ...linkForm, prefillMsg: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-semibold text-slate-light uppercase tracking-wider mb-3">UTM Parameters (optional)</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-light mb-1">Source</label>
                    <input type="text" placeholder="facebook" value={linkForm.utmSource} onChange={e => setLinkForm({ ...linkForm, utmSource: e.target.value })} className="w-full px-3 py-2 rounded-btn border border-gray-200 text-slate text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-light mb-1">Medium</label>
                    <input type="text" placeholder="ctr_wa" value={linkForm.utmMedium} onChange={e => setLinkForm({ ...linkForm, utmMedium: e.target.value })} className="w-full px-3 py-2 rounded-btn border border-gray-200 text-slate text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-light mb-1">Campaign</label>
                    <input type="text" placeholder="easter_25" value={linkForm.utmCampaign} onChange={e => setLinkForm({ ...linkForm, utmCampaign: e.target.value })} className="w-full px-3 py-2 rounded-btn border border-gray-200 text-slate text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowLinkModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {creating ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {creating ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* API Keys Tab */}
      {activeTab === 'apikeys' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg text-slate">API Keys</h2>
              <p className="text-xs text-slate-light mt-0.5">Use these keys to connect n8n, Zapier, or custom scripts to SendFlow</p>
            </div>
            <button
              onClick={() => { setShowKeyModal(true); setGeneratedKey(null); }}
              className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate Key
            </button>
          </div>

          <div className="bg-amber/10 border border-amber/20 rounded-lg px-4 py-3 text-sm text-amber">
            <strong>Heads up:</strong> Contacts pushed via API start as <strong>cold leads</strong> (opted out). You must get explicit consent before messaging them on WhatsApp.
          </div>

          {keysLoading ? (
            <div className="text-center py-12 text-slate-light">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3">🔑</div>
              <h3 className="font-heading text-xl text-slate mb-2">No API keys yet</h3>
              <p className="text-slate-light mb-6">Generate your first key to connect n8n lead discovery.</p>
              <button onClick={() => { setShowKeyModal(true); setGeneratedKey(null); }} className="bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors">
                Generate First Key
              </button>
            </div>
          ) : (
            <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Key</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Created</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Last Used</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {apiKeys.map((k: any) => (
                    <tr key={k.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium text-slate">{k.name || 'API Key'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-50 text-slate-light px-2 py-1 rounded border border-gray-100 font-mono">{k.key?.slice(0, 12)}...{k.key?.slice(-4)}</code>
                          <button
                            onClick={() => copyKey(k.key)}
                            className="text-slate-light hover:text-slate transition-colors"
                            title="Copy full key"
                          >
                            {copiedKey === k.key ? (
                              <svg className="w-4 h-4 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-light">{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-light">{k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          className="text-slate-light hover:text-red-500 transition-colors"
                          title="Delete"
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

          <div className="bg-gray-50 rounded-card border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-slate-light uppercase tracking-wider mb-3">Integration Guide</h4>
            <div className="space-y-3 text-sm text-slate-light">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-slate mb-1">n8n Webhook URL</div>
                <code className="text-xs bg-gray-50 px-2 py-1 rounded font-mono text-amber">https://sendflow-two.vercel.app/api/webhooks/n8n/leads</code>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-slate mb-1">Headers</div>
                <code className="text-xs bg-gray-50 px-2 py-1 rounded font-mono text-amber">X-Sendflow-Key: sf_your_key_here</code>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-slate mb-1">Payload</div>
                <pre className="text-xs bg-gray-50 px-2 py-1 rounded font-mono overflow-x-auto">{JSON.stringify({ leads: [{ phone: '0241234567', name: 'Business Name', industry: 'logistics' }] }, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading text-xl text-slate">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-light hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Email Address *</label>
                <input type="email" placeholder="colleague@company.com" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate focus:outline-none focus:ring-2 focus:ring-amber/40">
                  <option value="ADMIN">Admin — full access</option>
                  <option value="EDITOR">Editor — create & send</option>
                  <option value="VIEWER">Viewer — read only</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={inviting} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {inviting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading text-xl text-slate">Generate API Key</h3>
              <button onClick={() => { setShowKeyModal(false); setGeneratedKey(null); }} className="text-slate-light hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {!generatedKey ? (
              <form onSubmit={handleCreateKey} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate mb-1.5">Key Name *</label>
                  <input type="text" placeholder="e.g. n8n Lead Discovery" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowKeyModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                  <button type="submit" disabled={generatingKey} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {generatingKey ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                    {generatingKey ? 'Generating...' : 'Generate Key'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-green">Key generated successfully!</span>
                  </div>
                  <p className="text-sm text-green-700 mb-3">Copy it now — you won't be able to see it again.</p>
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-green-200 p-3">
                    <code className="text-sm font-mono text-slate flex-1 break-all">{generatedKey}</code>
                    <button
                      onClick={() => copyKey(generatedKey)}
                      className="shrink-0 text-green hover:text-green-700 transition-colors"
                    >
                      {copiedKey === generatedKey ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setShowKeyModal(false); setGeneratedKey(null); }}
                  className="w-full py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}