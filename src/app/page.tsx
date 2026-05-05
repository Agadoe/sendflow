'use client';

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const businessTypes = [
  'Salon / Beauty',
  'Restaurant / Food',
  'Retail Shop',
  'Fashion / Boutique',
  'Network Marketing',
  'Church / Religious',
  'School / Education',
  'Event Planning',
  'Real Estate',
  'Other',
];

export default function HomePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [wantsCall, setWantsCall] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, businessType, wantsCall }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        toast.error('Something went wrong. Try again.');
      }
    } catch {
      toast.error('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const plans = [
    {
      name: 'Free',
      price: 0,
      messages: 50,
      contacts: 100,
      users: 1,
      color: 'slate',
      desc: 'For trying out SendFlow',
      features: ['50 messages/month', '100 contacts', 'Single user', 'Email support'],
    },
    {
      name: 'Starter',
      price: 29,
      messages: 500,
      contacts: 2000,
      users: 2,
      color: 'amber',
      desc: 'For small shops getting started',
      popular: true,
      features: ['500 messages/month', '2,000 contacts', '2 users', 'Delivery reports', 'CSV import', 'Email support'],
    },
    {
      name: 'Growth',
      price: 79,
      messages: 3000,
      contacts: 10000,
      users: 5,
      color: 'slate',
      desc: 'For growing businesses',
      features: ['3,000 messages/month', '10,000 contacts', '5 users', 'Delivery reports', 'CSV import', 'Media messages', 'Priority support'],
    },
    {
      name: 'Pro',
      price: 199,
      messages: 20000,
      contacts: -1,
      users: 99,
      color: 'slate',
      desc: 'For serious marketers',
      features: ['20,000 messages/month', 'Unlimited contacts', 'Unlimited users', 'Delivery reports', 'API access', 'Dedicated support'],
    },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <Toaster position="bottom-right" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-cream/90 backdrop-blur-md border-b border-amber/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.1 0-4.102-.545-5.81-1.485L2.19 18.1l-.495-1.71 1.665-4.37A9.94 9.94 0 0112 2c5.523 0 10 4.477 10 10s-4.477 10-10 10z"/>
              </svg>
            </div>
            <span className="font-heading text-xl text-slate">SendFlow</span>
          </div>
          <a href="#pricing" className="text-sm font-medium text-slate hover:text-amber transition-colors">
            View Pricing
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative kente-pattern py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber/10 text-amber px-4 py-1.5 rounded-pill text-sm font-medium mb-6 animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
            Now in early access — Join 200+ businesses
          </div>
          <h1 className="font-heading text-5xl md:text-6xl text-slate leading-tight mb-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
            Send Bulk WhatsApp Messages
            <br />
            <span className="text-amber">From $29/month</span>
          </h1>
          <p className="text-lg text-slate-light md:text-xl max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '160ms' }}>
            Reach thousands of customers instantly. Reliable delivery. Real-time reports.
            The affordable marketing tool African businesses have been waiting for.
          </p>

          {!submitted ? (
            <form onSubmit={handleWaitlist} className="max-w-md mx-auto flex flex-col gap-3 animate-fade-up" style={{ animationDelay: '240ms' }}>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                  required
                />
                <input
                  type="email"
                  placeholder="Business email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                  required
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                />
                <select
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-btn border border-gray-200 text-slate-light focus:outline-none focus:ring-2 focus:ring-amber/40"
                >
                  <option value="">Business type</option>
                  {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="wantsCall"
                  checked={wantsCall}
                  onChange={e => setWantsCall(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-amber focus:ring-amber"
                />
                <label htmlFor="wantsCall" className="text-sm text-slate-light cursor-pointer">
                  Yes, I'd like a free onboarding call when SendFlow launches
                </label>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-amber hover:bg-amber-dark text-white font-semibold rounded-btn transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Join the Waitlist — Free'}
              </button>
            </form>
          ) : (
            <div className="max-w-md mx-auto bg-surface rounded-card p-8 shadow-lg border border-amber/20 animate-fade-up">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="font-heading text-2xl text-slate mb-2">You&apos;re on the list!</h3>
              <p className="text-slate-light">
                We&apos;ll email <strong>{email}</strong> when we launch.<br />
                Get 1 month free when we open doors.
              </p>
            </div>
          )}
        </div>

        {/* WhatsApp message preview mockup */}
        <div className="max-w-lg mx-auto mt-16 animate-fade-up" style={{ animationDelay: '320ms' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-4 max-w-sm mx-auto border border-gray-100">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">SF</div>
              <div>
                <div className="font-semibold text-sm text-slate">SendFlow Business</div>
                <div className="text-xs text-gray-400">online</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="message-bubble">
                <span className="text-sm">Hi Esther! Don't forget — 20% off all braids today only. Walk-ins welcome 💇‍♀️</span>
              </div>
              <div className="message-bubble">
                <span className="text-sm">Show this message to claim your discount. See you soon! ✨</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm12.19 8.81c-.15.41-.75.73-.93.8-.18.06-.42.12-.78-.12-.26-.17-.48-.42-.67-.66-.16-.22-.32-.42-.53-.46-.14-.03-.26-.03-.37.03-.11.06-.18.16-.18.29 0 .13.23.3.4.5.22.25.36.38.39.52.03.14 0 .26-.1.37-.1.1-.17.18-.27.29-.08.08-.17.17-.23.26-.08.1-.14.21-.12.33.02.12.09.25.19.35.1.1.21.22.31.32.1.1.14.19.1.29-.03.1-.13.21-.27.36-.14.14-.27.28-.36.41s-.1.3.01.5c.08.15.43.63 1.18 1.09.61.37 1.14.59 1.31.65.18.07.27.05.37-.14.1-.18.34-.56.4-.75.06-.19.12-.16.37-.27.24-.11.42-.11.57-.07.15.05.31.04.45-.03.14-.07.29-.16.43-.25.15-.09.3-.19.43-.21.14-.03.25 0 .33.12.08.11.16.29.11.42z"/>
                </svg>
              </div>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-green-500"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Delivered
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="bg-surface border-y border-gray-100 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 text-center">
          {[
            { num: '200+', label: 'Businesses on waitlist' },
            { num: '50K+', label: 'Messages ready to send' },
            { num: '3', label: 'Countries at launch' },
            { num: '99.9%', label: 'Uptime target' },
          ].map(({ num, label }) => (
            <div key={label}>
              <div className="font-heading text-2xl text-amber">{num}</div>
              <div className="text-xs text-slate-light mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6 bg-surface">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-amber font-semibold text-sm uppercase tracking-wider mb-4">The Problem</div>
            <h2 className="font-heading text-4xl text-slate mb-6">Your customers are on WhatsApp. You&apos;re texting one by one.</h2>
            <p className="text-slate-light leading-relaxed mb-6">
              Every day you copy-paste messages to dozens of customers. It takes hours. Messages get missed. There&apos;s no system, no tracking, no way to know who actually received your promotions.
            </p>
            <p className="text-slate-light leading-relaxed">
              Meanwhile, big tools like WATI charge <strong className="text-slate">$120+/month</strong> — way too expensive for most African businesses.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { emoji: '😩', text: 'Sending promotions one by one takes hours' },
              { emoji: '📵', text: 'No way to track who received your message' },
              { emoji: '💸', text: 'Enterprise tools cost $120+ per month' },
              { emoji: '📋', text: 'Contacts scattered across phone, paper, memory' },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-start gap-4 p-4 bg-cream rounded-card border border-amber/5">
                <span className="text-2xl">{emoji}</span>
                <span className="text-slate font-medium pt-1">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-20 px-6 kente-pattern">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-amber font-semibold text-sm uppercase tracking-wider mb-4">How It Works</div>
            <h2 className="font-heading text-4xl text-slate">Three steps to reach everyone</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Import your contacts', desc: 'Upload a CSV or Excel file. We\'ll auto-detect columns for names and phone numbers. Organize with tags.', icon: '📁' },
              { step: '02', title: 'Compose your message', desc: 'Write your promotion, add an image or document, preview exactly how it looks on WhatsApp.', icon: '✍️' },
              { step: '03', title: 'Send or schedule', desc: 'Send immediately or pick a time. Watch delivery reports come in real-time as customers receive your message.', icon: '🚀' },
            ].map(({ step, title, desc, icon }) => (
              <div key={step} className="bg-surface rounded-card p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className="text-4xl mb-4">{icon}</div>
                <div className="font-mono text-xs text-amber mb-3 font-semibold">{step}</div>
                <h3 className="font-heading text-xl text-slate mb-3">{title}</h3>
                <p className="text-slate-light text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-surface border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-amber font-semibold text-sm uppercase tracking-wider mb-4">Features</div>
            <h2 className="font-heading text-4xl text-slate">Everything you need to market smarter</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Bulk Message Broadcast', desc: 'Send to 10 or 10,000 contacts with one click. No rate limiting headaches.', icon: '📨' },
              { title: 'Media Attachments', desc: 'Include images, PDFs, or documents. Perfect for catalogs, menus, or flyers.', icon: '🖼️' },
              { title: 'Delivery Reports', desc: 'See exactly who received your message, who opened it, and who didn\'t.', icon: '📊' },
              { title: 'Schedule Messages', desc: 'Write your promotions at night, schedule for 8am, and watch them go out automatically.', icon: '⏰' },
              { title: 'CSV Import', desc: 'Upload your contact list in seconds. Auto-detect headers. Map columns visually.', icon: '📋' },
              { title: 'Multiple WhatsApp Numbers', desc: 'Manage several businesses or brands from one dashboard.', icon: '📱' },
            ].map(({ title, desc, icon }) => (
              <div key={title} className="p-6 bg-cream rounded-card border border-amber/5 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-semibold text-slate mb-2">{title}</h3>
                <p className="text-sm text-slate-light leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 kente-pattern">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-amber font-semibold text-sm uppercase tracking-wider mb-4">Pricing</div>
            <h2 className="font-heading text-4xl text-slate mb-4">Simple pricing. No surprises.</h2>
            <p className="text-slate-light">Start free. Scale as you grow.</p>

            {/* Billing toggle */}
            <div className="mt-6 inline-flex items-center gap-3 bg-surface rounded-pill p-1 border border-gray-200">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-4 py-1.5 rounded-pill text-sm font-medium transition-all ${billing === 'monthly' ? 'bg-amber text-white' : 'text-slate-light hover:text-slate'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('annual')}
                className={`px-4 py-1.5 rounded-pill text-sm font-medium transition-all flex items-center gap-1.5 ${billing === 'annual' ? 'bg-amber text-white' : 'text-slate-light hover:text-slate'}`}
              >
                Annual
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">-20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map(plan => {
              const price = billing === 'annual' ? Math.round(plan.price * 0.8 * 12) : plan.price;
              const period = billing === 'annual' ? '/year' : '/mo';
              return (
                <div key={plan.name} className={`bg-surface rounded-card p-6 shadow-sm border ${plan.popular ? 'border-amber ring-2 ring-amber/20' : 'border-gray-100'} relative`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className={`text-lg font-heading text-slate mb-1`}>{plan.name}</div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-heading text-4xl text-slate">${price}</span>
                    {plan.price > 0 && <span className="text-slate-light text-sm">{period}</span>}
                  </div>
                  {billing === 'annual' && plan.price > 0 && (
                    <div className="text-xs text-slate-light mb-3">${plan.price}/mo billed annually</div>
                  )}
                  <p className="text-sm text-slate-light mb-4">{plan.desc}</p>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="text-sm text-slate flex items-start gap-2">
                        <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#waitlist"
                    className={`block text-center py-2.5 rounded-btn text-sm font-semibold transition-all ${plan.popular ? 'bg-amber hover:bg-amber-dark text-white' : 'bg-gray-100 hover:bg-gray-200 text-slate'}`}
                  >
                    {plan.price === 0 ? 'Start Free' : 'Get Started'}
                  </a>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-slate-light mt-6">
            All plans include 24/7 monitoring. No credit card required for free plan.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-surface border-t border-gray-100">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-amber font-semibold text-sm uppercase tracking-wider mb-4">FAQ</div>
            <h2 className="font-heading text-4xl text-slate">Questions answered</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'Will my WhatsApp account get banned?', a: 'We use official WhatsApp Business API connections — the same way WATI and YCloud work. Your number stays safe. We monitor connection health and alert you to any issues.' },
              { q: 'What if I don\'t have a WhatsApp number yet?', a: 'You can use any personal WhatsApp number to start. We\'ll guide you through connecting it in under 5 minutes.' },
              { q: 'How does payment work?', a: 'For MVP, we\'ll accept MTN Mobile Money and bank transfers. Card payments via Paystack are coming in Phase 2.' },
              { q: 'Can I import contacts without a CSV?', a: 'Yes. You can add contacts manually one by one, or copy-paste a list of phone numbers.' },
              { q: 'What happens if I exceed my message limit?', a: 'You\'ll get an alert when you reach 80% of your limit. Extra messages are available at $0.03 each.' },
            ].map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="waitlist" className="py-20 px-6 bg-slate text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-4xl mb-4">Ready to reach your customers?</h2>
          <p className="text-gray-400 mb-8">Join 200+ African businesses already on the waitlist. Get 1 month free at launch.</p>
          <a href="#waitlist-top" className="inline-block bg-amber hover:bg-amber-dark text-white font-semibold px-8 py-4 rounded-btn text-lg transition-all">
            Join the Waitlist — Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate text-gray-400 py-8 px-6 border-t border-gray-700">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-amber flex items-center justify-center text-white text-xs font-bold">S</div>
            <span className="text-white font-heading">SendFlow</span>
          </div>
          <div className="text-sm">© 2026 SendFlow. Built for African businesses 🇬🇭</div>
        </div>
      </footer>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
        <span className="font-medium text-slate text-sm">{q}</span>
        <svg className={`w-4 h-4 text-slate-light shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-4 text-sm text-slate-light leading-relaxed border-t border-gray-100 pt-3">{a}</div>}
    </div>
  );
}
