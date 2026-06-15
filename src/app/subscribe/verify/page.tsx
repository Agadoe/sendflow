'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your payment...');
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      setMessage('No payment reference found in URL');
      return;
    }
    verifyPayment();
  }, [reference]);

  async function verifyPayment() {
    try {
      const res = await fetch(`/api/paystack/verify/${reference}`);
      const data = await res.json();
      if (data.status === 'success') {
        setStatus('success');
        setMessage('Payment successful! Your plan will activate within a few seconds.');
        setPlan(data.plan);
        setTimeout(() => router.push('/dashboard'), 4000);
      } else if (data.status === 'pending') {
        setStatus('pending');
        setMessage(data.message || 'Payment is still processing');
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Toaster position="top-center" />
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-slate mb-2">Verifying payment</h1>
            <p className="text-slate-light">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-slate mb-2">Payment successful!</h1>
            <p className="text-slate-light mb-6">{message}</p>
            {plan && (
              <p className="text-sm text-slate mb-6">
                Plan: <strong>{plan}</strong>
              </p>
            )}
            <Link
              href="/dashboard"
              className="inline-block bg-amber text-white px-6 py-3 rounded-btn font-medium hover:bg-amber-600"
            >
              Go to dashboard
            </Link>
          </>
        )}
        {status === 'pending' && (
          <>
            <div className="w-16 h-16 bg-amber/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⏱</span>
            </div>
            <h1 className="text-2xl font-bold text-slate mb-2">Payment pending</h1>
            <p className="text-slate-light mb-6">{message}</p>
            <Link
              href="/subscribe"
              className="text-amber hover:underline"
            >
              Back to plans
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">✕</span>
            </div>
            <h1 className="text-2xl font-bold text-slate mb-2">Verification failed</h1>
            <p className="text-slate-light mb-6">{message}</p>
            <Link
              href="/subscribe"
              className="inline-block bg-amber text-white px-6 py-3 rounded-btn font-medium hover:bg-amber-600"
            >
              Try again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
