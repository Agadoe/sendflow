'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('No reset token in URL. Please request a new password reset.');
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. The link may have expired.');
        return;
      }

      setDone(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-5xl">🔓</div>
          <h1 className="font-heading text-2xl text-slate">Password updated</h1>
          <p className="text-slate-light text-sm">Your password has been changed. You can now sign in.</p>
          <Link href="/login" className="inline-block mt-2 px-6 py-3 bg-amber text-white font-semibold rounded-btn hover:bg-amber-dark transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <h1 className="font-heading text-2xl text-slate">Set a new password</h1>
          <p className="text-slate-light text-sm mt-1">Choose something memorable and secure</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {error && !token ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-btn">
                {error}
              </div>
              <div className="text-center">
                <Link href="/forgot-password" className="text-amber text-sm hover:underline">
                  Request a new reset link
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-light mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-btn text-sm text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-light mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-btn text-sm text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                />
              </div>

              {error && token && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-btn">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-3 bg-amber text-white font-semibold rounded-btn hover:bg-amber-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Update password'}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link href="/login" className="text-slate-light text-sm hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}