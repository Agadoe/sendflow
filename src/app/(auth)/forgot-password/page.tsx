'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
          </div>
          <h1 className="font-heading text-2xl text-slate">Reset your password</h1>
          <p className="text-slate-light text-sm mt-1">
            {sent ? "Check your inbox" : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-slate text-sm">
                If <strong>{email}</strong> has an account, we sent a password reset link.
                It expires in <strong>1 hour</strong>.
              </p>
              <p className="text-slate-light text-xs">
                Didn't get it? Check your spam folder, or{' '}
                <button
                  type="button"
                  className="text-amber hover:underline"
                  onClick={() => { setSent(false); }}
                >
                  try again
                </button>.
              </p>
              <div className="pt-2">
                <Link href="/login" className="text-amber font-medium text-sm hover:underline">
                  ← Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-light mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full px-4 py-3 border border-gray-200 rounded-btn text-sm text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-btn">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-amber text-white font-semibold rounded-btn hover:bg-amber-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Send reset link'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-slate-light text-sm hover:underline">
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}