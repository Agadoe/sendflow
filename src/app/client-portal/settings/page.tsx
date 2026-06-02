'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  useEffect(() => {
    fetch('/api/client-portal/settings')
      .then(r => r.json())
      .then(d => {
        if (d.user) setForm({ name: d.user.name, email: d.user.email, phone: d.user.phone || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/client-portal/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Profile updated successfully ✓');
      } else {
        setMessage(data.error || 'Update failed');
      }
    } catch {
      setMessage('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword.length < 8) {
      setPwMessage('New password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    setPwMessage('');
    try {
      const res = await fetch('/api/client-portal/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pwForm),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMessage('Password changed successfully ✓');
        setPwForm({ currentPassword: '', newPassword: '' });
      } else {
        setPwMessage(data.error || 'Failed to change password');
      }
    } catch {
      setPwMessage('Network error. Try again.');
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-light text-sm">Loading settings...</div>;
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-slate">Settings</h1>
        <p className="text-slate-light text-sm mt-1">Manage your profile and security</p>
      </div>

      {/* Profile form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold text-slate mb-4">Profile Information</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-light mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-btn text-sm text-slate focus:outline-none focus:ring-2 focus:ring-amber/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-light mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-btn text-sm text-slate focus:outline-none focus:ring-2 focus:ring-amber/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-light mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+233..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-btn text-sm text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
            />
          </div>
          {message && (
            <div className={`text-sm px-4 py-2.5 rounded-btn ${message.includes('✓') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {message}
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-amber text-white text-sm font-semibold rounded-btn hover:bg-amber-dark transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-semibold text-slate mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-light mb-1.5">Current Password</label>
            <input
              type="password"
              value={pwForm.currentPassword}
              onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-btn text-sm text-slate focus:outline-none focus:ring-2 focus:ring-amber/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-light mb-1.5">New Password</label>
            <input
              type="password"
              value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-btn text-sm text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
            />
          </div>
          {pwMessage && (
            <div className={`text-sm px-4 py-2.5 rounded-btn ${pwMessage.includes('✓') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {pwMessage}
            </div>
          )}
          <button
            type="submit"
            disabled={pwSaving}
            className="px-6 py-2.5 bg-amber text-white text-sm font-semibold rounded-btn hover:bg-amber-dark transition-colors disabled:opacity-60"
          >
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}