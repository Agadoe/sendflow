'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface Plan {
  name: string;
  code: string;
  amountKobo: number;
  features: string[];
  popular?: boolean;
}

export default function SubscribePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; plan: string } | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchUser();
  }, []);

  async function fetchPlans() {
    const res = await fetch('/api/paystack/plans');
    const data = await res.json();
    setPlans(data.plans || []);
  }

  async function fetchUser() {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) setUser(data.user);
  }

  async function handleSubscribe(planCode: string) {
    if (!user) {
      toast.error('Please log in to subscribe');
      router.push('/login?redirect=/subscribe');
      return;
    }
    setLoading(planCode);
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');
      // Redirect to Paystack hosted checkout
      window.location.href = data.authorizationUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      toast.error(msg);
      setLoading(null);
    }
  }

  function ghs(kobo: number) {
    return `GHS ${(kobo / 100).toLocaleString()}`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 py-16 px-4">
      <Toaster position="top-center" />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-heading text-slate mb-4">
            Choose your plan
          </h1>
          <p className="text-lg text-slate-light max-w-2xl mx-auto">
            All plans include unlimited WhatsApp campaigns, drip sequences,
            and our dashboard. Pay monthly, cancel anytime.
          </p>
          {user && (
            <p className="mt-4 text-sm text-slate-light">
              Logged in as <strong>{user.email}</strong> · Current plan:{' '}
              <strong>{user.plan}</strong>
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const isCurrent = user?.plan === plan.code;
            return (
              <div
                key={plan.code}
                className={`relative rounded-2xl p-8 ${
                  plan.popular
                    ? 'bg-amber/5 border-2 border-amber shadow-xl'
                    : 'bg-white border border-slate-200'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber text-white text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                )}
                <h3 className="text-2xl font-bold text-slate mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate">
                    {ghs(plan.amountKobo)}
                  </span>
                  <span className="text-slate-light">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate">
                      <span className="text-amber mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.code)}
                  disabled={loading === plan.code || isCurrent}
                  className={`w-full py-3 rounded-btn font-medium transition ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-amber text-white hover:bg-amber-600'
                      : 'bg-slate text-white hover:bg-slate-700'
                  }`}
                >
                  {isCurrent
                    ? 'Current plan'
                    : loading === plan.code
                    ? 'Redirecting...'
                    : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center mt-10 text-sm text-slate-light">
          Secure payment via Paystack. Cards, Mobile Money, and bank transfer accepted.
        </p>
      </div>
    </div>
  );
}
