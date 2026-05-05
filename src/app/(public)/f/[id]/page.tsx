'use client';

import { useState, useEffect } from 'react';

export default function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [waUrl, setWaUrl] = useState('');
  const [formId, setFormId] = useState<string>('');
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    params.then(p => {
      setFormId(p.id);
      fetch(`/api/forms/${p.id}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) { setError(d.error); }
          else {
            setForm(d.form);
            const qs = new URLSearchParams(window.location.search);
            if (qs.get('filled') === '1') setSubmitted(true);
          }
        })
        .catch(() => setError('Failed to load form'))
        .finally(() => setLoading(false));
    });
  }, []);

  function updateAnswer(field: string, value: string) {
    setAnswers(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: answers._phone, answers }),
      });
      const data = await res.json();
      if (res.ok) {
        setWaUrl(data.waUrl);
        setSubmitted(true);
      } else {
        setError(data.error || 'Submission failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#E8961C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-serif text-[#2D3748] mb-2">Form not found</h1>
          <p className="text-[#718096] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted && waUrl) {
    return (
      <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-[#E8961C]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#E8961C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-serif text-[#2D3748] mb-2">You&apos;re all set!</h2>
          <p className="text-[#718096] text-sm mb-6">Tap the button below to open WhatsApp and start chatting.</p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
            Open WhatsApp
          </a>
          <p className="text-xs text-[#718096] mt-4">Your answers have been saved. No need to repeat yourself!</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  let questions: any[] = [];
  try { questions = JSON.parse(form.questions || '[]'); } catch {}

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      {/* Header */}
      <div className="bg-[#E8961C] text-white px-6 py-8">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 opacity-80" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
            <span className="text-sm font-medium opacity-90">via SendFlow</span>
          </div>
          <h1 className="text-2xl font-serif">{form.name}</h1>
          {form.prefillMsg && (
            <p className="text-sm opacity-80 mt-2 leading-relaxed">&ldquo;{form.prefillMsg}&rdquo;</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {questions.length > 0 && (
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-[#E8961C] transition-all duration-300"
            style={{ width: `${((step) / questions.length) * 100}%` }}
          />
        </div>
      )}

      {/* Form */}
      <div className="max-w-sm mx-auto px-6 py-8">
        <form onSubmit={handleSubmit}>
          {questions.length === 0 ? (
            // Phone-only mode (quick click-to-WhatsApp)
            <div className="space-y-4">
              <p className="text-[#2D3748] text-sm">Just tap the button below to start a WhatsApp chat with us!</p>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                </svg>
                {submitting ? 'Opening...' : 'Chat on WhatsApp'}
              </button>
            </div>
          ) : (
            <>
              {/* Progress indicator */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs text-[#718096] font-medium">
                  Step {step + 1} of {questions.length}
                </span>
                <button type="button" onClick={() => setStep(questions.length)} className="text-xs text-[#E8961C] font-medium hover:underline">
                  Skip all
                </button>
              </div>

              {step < questions.length ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-base font-serif text-[#2D3748] mb-3">
                      {questions[step].question}
                      {questions[step].required && <span className="text-[#E8961C] ml-1">*</span>}
                    </label>
                    <input
                      key={step}
                      type={questions[step].field === 'email' ? 'email' : questions[step].field === 'phone' ? 'tel' : 'text'}
                      value={answers[questions[step].field] || ''}
                      onChange={e => updateAnswer(questions[step].field, e.target.value)}
                      placeholder={`Your ${questions[step].field}`}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[#2D3748] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8961C]/40 text-base"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3">
                    {step > 0 && (
                      <button type="button" onClick={handleBack} className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#2D3748] font-medium transition-colors text-sm">
                        ← Back
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 bg-[#E8961C] hover:bg-[#C4770F] text-white font-semibold py-3 rounded-xl transition-colors text-base"
                    >
                      {step === questions.length - 1 ? 'Continue to WhatsApp →' : 'Next →'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-[#2D3748]">
                    <strong>Review your answers:</strong>
                    <div className="mt-2 space-y-1">
                      {questions.map((q: any, i: number) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-[#718096] shrink-0">{q.question}:</span>
                          <span className="font-medium">{answers[q.field] || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 text-base"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                    </svg>
                    {submitting ? 'Opening...' : 'Open WhatsApp & Send'}
                  </button>
                  <button type="button" onClick={() => setStep(0)} className="w-full text-center text-sm text-[#718096] hover:text-[#2D3748] transition-colors py-2">
                    ← Edit answers
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>
          )}
        </form>

        <p className="text-center text-xs text-[#718096] mt-8">
          Powered by <span className="font-medium text-[#E8961C]">SendFlow</span>
        </p>
      </div>
    </div>
  );
}