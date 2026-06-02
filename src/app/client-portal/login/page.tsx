'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientLoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [trialMsg, setTrialMsg] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/client-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push('/client-portal');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/client-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, company, phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setTrialMsg(data.trialMessage || 'Trial started! Redirecting to your dashboard...');
      setTimeout(() => {
        router.push('/client-portal');
        router.refresh();
      }, 1500);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isSignup ? 'Start Your Free Trial' : 'Client Portal'}
          </h1>
          <p className="text-white/40 text-sm mt-2">
            {isSignup
              ? '14 days free. No credit card required.'
              : 'Sign in to your KGC client dashboard'}
          </p>
        </div>

        {/* Trial success banner */}
        {trialMsg && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6 text-green-400 text-sm text-center">
            ✅ {trialMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {isSignup ? (
            /* SIGNUP FORM */
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Kwame Asante"
                  className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber outline-none text-white placeholder-white/20"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="kwame@company.com"
                  className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber outline-none text-white placeholder-white/20"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Password * (min. 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber outline-none text-white placeholder-white/20"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="Asante Logistics Ltd"
                  className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber outline-none text-white placeholder-white/20"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+233 24 000 0000"
                  className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber outline-none text-white placeholder-white/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-amber hover:bg-amber/90 text-black font-semibold rounded-xl transition disabled:opacity-50"
              >
                {loading ? 'Setting up your trial...' : '🚀 Start 14-Day Free Trial'}
              </button>
            </form>
          ) : (
            /* LOGIN FORM */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="kwame@company.com"
                  className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber outline-none text-white placeholder-white/20"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-amber outline-none text-white placeholder-white/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-amber hover:bg-amber/90 text-black font-semibold rounded-xl transition disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Toggle */}
          <div className="text-center mt-6">
            {isSignup ? (
              <p className="text-white/40 text-sm">
                Already have an account?{' '}
                <button
                  onClick={() => { setIsSignup(false); setError(''); setTrialMsg(''); }}
                  className="text-amber hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p className="text-white/40 text-sm">
                No account yet?{' '}
                <button
                  onClick={() => { setIsSignup(true); setError(''); setTrialMsg(''); }}
                  className="text-amber hover:underline font-medium"
                >
                  Start free trial
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Back to main site */}
        <div className="text-center mt-6">
          <a href="/" className="text-white/20 hover:text-white/40 text-xs transition">
            ← Back to kgc-site.vercel.app
          </a>
        </div>
      </div>
    </div>
  );
}