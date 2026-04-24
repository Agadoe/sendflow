'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function SmsPage() {
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/contacts').then(r => r.json()).catch(() => ({}));
    fetch('/api/campaigns').then(r => r.json()).then(d => setCampaigns(d.campaigns || [])).catch(() => ({}));
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    toast.loading('Sending SMS to all contacts...', { id: 'sms-send' });
    try {
      const contactRes = await fetch('/api/contacts');
      const contactData = await contactRes.json();
      const contacts = contactData.contacts || [];

      if (contacts.length === 0) {
        toast.dismiss('sms-send');
        toast.error('No contacts to send to. Add contacts first.');
        return;
      }

      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts, message }),
      });
      const data = await res.json();
      toast.dismiss('sms-send');
      if (res.ok) {
        toast.success(`SMS sent: ${data.sent}/${data.total} delivered`);
        setShowModal(false);
        setMessage('');
      } else {
        toast.error(data.error || 'Send failed');
      }
    } catch {
      toast.dismiss('sms-send');
      toast.error('Network error');
    } finally {
      setSending(false);
    }
  }

  const charLimit = 160;
  const charCount = message.length;
  const isOversize = charCount > charLimit;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-slate">SMS Marketing</h1>
          <p className="text-sm text-slate-light mt-0.5">Send text messages to your contacts</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Send SMS
        </button>
      </div>

      <div className="bg-surface rounded-card border border-gray-100 p-8 text-center">
        <div className="text-5xl mb-4">💬</div>
        <h3 className="font-heading text-xl text-slate mb-2">SMS Campaigns</h3>
        <p className="text-sm text-slate-light mb-6 max-w-sm mx-auto">Send SMS broadcasts to your contacts list. Add contacts first, then send your first SMS campaign.</p>
        <button onClick={() => setShowModal(true)} className="bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors">
          Send Your First SMS
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading text-xl text-slate">Send SMS</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-light hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSend} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Message</label>
                <textarea
                  placeholder="Hi {{name}}! Don't miss out on our latest deals..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  className={`w-full px-4 py-2.5 rounded-btn border text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none ${isOversize ? 'border-red-400' : 'border-gray-200'}`}
                />
                <div className={`text-xs mt-1 flex justify-between ${isOversize ? 'text-red-500' : 'text-slate-light'}`}>
                  <span>{charCount} / {charLimit} characters {isOversize ? `(${charCount - charLimit} over limit — will be split into ${Math.ceil(charCount / 160)} parts)` : ''}</span>
                </div>
              </div>
              <div className="bg-amber/5 border border-amber/10 rounded-lg px-4 py-3 text-sm text-slate">
                <span className="font-semibold">📋 Sending to all contacts in your list</span>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={sending || !message.trim()} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {sending ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
