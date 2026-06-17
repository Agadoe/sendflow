'use client';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setSent(false);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          phone: data.get('phone'),
          subject: data.get('subject'),
          message: data.get('message'),
        }),
      });

      if (res.ok) {
        toast.success('Message sent! We\'ll reply within 1 business day.');
        setSent(true);
        form.reset();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to send. Try again or email us directly.');
      }
    } catch {
      toast.error('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <Toaster position="bottom-right" />

      {/* Nav */}
      <nav className="bg-surface border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.1 0-4.102-.545-5.81-1.485L2.19 18.1l-.495-1.71 1.665-4.37A9.94 9.94 0 0112 2c5.523 0 10 4.477 10 10s-4.477 10-10 10z"/>
              </svg>
            </div>
            <span className="font-heading text-lg text-slate">SendFlow</span>
          </a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="font-heading text-4xl text-slate mb-2">Get in touch</h1>
          <p className="text-slate-light">We reply within 1 business day. For urgent issues, email us directly.</p>
        </div>

        {/* Contact cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="bg-surface rounded-card border border-gray-100 p-5">
            <div className="w-10 h-10 rounded-full bg-amber/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-xs text-slate-light uppercase tracking-wider font-semibold mb-1">Email</div>
            <a href="mailto:sendflow@sendflow.baahe.org" className="text-slate font-medium hover:text-amber transition-colors">sendflow@sendflow.baahe.org</a>
            <div className="text-xs text-slate-light mt-1">Best for general enquiries &amp; billing</div>
          </div>

          <div className="bg-surface rounded-card border border-gray-100 p-5">
            <div className="w-10 h-10 rounded-full bg-amber/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div className="text-xs text-slate-light uppercase tracking-wider font-semibold mb-1">Phone / WhatsApp</div>
            <a href="tel:+233540497649" className="text-slate font-medium hover:text-amber transition-colors">+233 54 049 7649</a>
            <div className="text-xs text-slate-light mt-1">Mon–Fri, 9am–5pm GMT</div>
          </div>

          <div className="bg-surface rounded-card border border-gray-100 p-5">
            <div className="w-10 h-10 rounded-full bg-amber/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-xs text-slate-light uppercase tracking-wider font-semibold mb-1">Response time</div>
            <div className="text-slate font-medium">Within 1 business day</div>
            <div className="text-xs text-slate-light mt-1">Usually much faster</div>
          </div>

          <div className="bg-surface rounded-card border border-gray-100 p-5">
            <div className="w-10 h-10 rounded-full bg-amber/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-xs text-slate-light uppercase tracking-wider font-semibold mb-1">Location</div>
            <div className="text-slate font-medium">Accra, Ghana</div>
            <div className="text-xs text-slate-light mt-1">Serving businesses across Ghana</div>
          </div>
        </div>

        {/* Contact form */}
        <div className="bg-surface rounded-card border border-gray-100 p-6">
          <h2 className="font-heading text-xl text-slate mb-5">Send us a message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
              <label className="block text-sm font-medium text-slate mb-1.5">Your name *</label>
              <input name="name" type="text" placeholder="Akua Mensah" required className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" />
              </div>
              <div>
              <label className="block text-sm font-medium text-slate mb-1.5">Email address *</label>
              <input name="email" type="email" placeholder="akua@business.com" required className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
              <label className="block text-sm font-medium text-slate mb-1.5">Phone (optional)</label>
              <input name="phone" type="tel" placeholder="+233 24 000 0000" className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" />
              </div>
              <div>
              <label className="block text-sm font-medium text-slate mb-1.5">Subject *</label>
              <select name="subject" required className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate focus:outline-none focus:ring-2 focus:ring-amber/40">
                <option value="">Select a topic</option>
                <option value="billing">Billing &amp; Payments</option>
                <option value="technical">Technical Issue</option>
                <option value="sales">Pricing &amp; Plans</option>
                <option value="onboarding">Getting Started</option>
                <option value="partnership">Partnership</option>
                <option value="other">Other</option>
              </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate mb-1.5">Message *</label>
              <textarea name="message" rows={5} placeholder="Tell us what's on your mind..." required className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none" />
            </div>
            {sent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Message sent successfully!</p>
                  <p className="text-xs text-green-600 mt-0.5">We&apos;ll reply within 1 business day. Keep an eye on your inbox.</p>
                </div>
              </div>
            )}
            <button type="submit" disabled={submitting} className="w-full py-3 bg-amber hover:bg-amber-dark text-white font-semibold rounded-btn transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : 'Send Message'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate text-gray-400 py-6 px-6 mt-8">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber flex items-center justify-center text-white text-xs font-bold">S</div>
            <span className="text-white font-heading">SendFlow</span>
          </div>
          <div className="flex gap-4">
            <a href="/policy" className="text-gray-400 hover:text-white transition-colors">Privacy &amp; Refund Policy</a>
            <a href="/contact" className="text-gray-400 hover:text-white transition-colors">Contact</a>
          </div>
          <div>© 2026 SendFlow. Built for African businesses 🇬🇭</div>
        </div>
      </footer>
    </div>
  );
}