'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const QUESTION_PRESETS = [
  { question: 'Your name', field: 'name', required: true },
  { question: 'Phone number', field: '_phone', required: true },
  { question: 'Email address', field: 'email', required: false },
  { question: 'Which service are you interested in?', field: 'service', required: false },
  { question: 'Any questions for us?', field: 'message', required: false },
];

export default function FormsPage() {
  const [forms, setForms] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'submissions'>('list');
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    prefillMsg: '',
    tagName: '',
    tagValue: '',
    questions: [] as any[],
  });

  useEffect(() => {
    loadForms();
  }, []);

  async function loadForms() {
    try {
      const res = await fetch('/api/forms');
      const data = await res.json();
      setForms(data.forms || []);
    } catch {
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  }

  async function loadSubmissions(formId: string) {
    const res = await fetch(`/api/forms/${formId}`);
    const data = await res.json();
    if (data.form) setSelectedForm(data.form);
  }

  function openEdit(f: any) {
    setEditingForm(f);
    let questions = [];
    try { questions = JSON.parse(f.questions || '[]'); } catch {}
    setForm({
      name: f.name,
      phone: f.phone,
      prefillMsg: f.prefillMsg || '',
      tagName: f.tagName || '',
      tagValue: f.tagValue || '',
      questions,
    });
    setShowModal(true);
  }

  function openCreate() {
    setEditingForm(null);
    setForm({ name: '', phone: '', prefillMsg: '', tagName: '', tagValue: '', questions: [] });
    setShowModal(true);
  }

  function addQuestion(preset?: any) {
    setForm(f => ({
      ...f,
      questions: [...f.questions, {
        question: preset?.question || 'New question',
        field: preset?.field || 'answer',
        required: preset?.required ?? false,
      }],
    }));
  }

  function removeQuestion(i: number) {
    setForm(f => ({ ...f, questions: f.questions.filter((_: any, idx: number) => idx !== i) }));
  }

  function updateQuestion(i: number, field: string, value: any) {
    setForm(f => ({
      ...f,
      questions: f.questions.map((q: any, idx: number) =>
        idx === i ? { ...q, [field]: value } : q
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSubmitting(true);
    try {
      const url = editingForm ? `/api/forms/${editingForm.id}` : '/api/forms';
      const method = editingForm ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editingForm ? 'Form updated' : 'Form created!');
        setShowModal(false);
        loadForms();
      } else {
        toast.error(data.error || 'Failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this form? This cannot be undone.')) return;
    await fetch(`/api/forms/${id}`, { method: 'DELETE' }).catch(() => {});
    toast.success('Form deleted');
    loadForms();
  }

  async function handleToggleActive(f: any) {
    await fetch(`/api/forms/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !f.isActive }),
    }).catch(() => {});
    loadForms();
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/f/${id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function formUrl(f: any) {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${f.id}`;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-slate">WhatsApp Forms</h1>
          <p className="text-sm text-slate-light mt-0.5">Create lead capture forms that open a WhatsApp chat</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Form
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-btn p-1 w-fit">
        {(['list', 'submissions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedForm(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-slate shadow-sm' : 'text-slate-light hover:text-slate'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-light">Loading...</div>
      ) : activeTab === 'list' ? (
        forms.length === 0 ? (
          <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="font-heading text-xl text-slate mb-2">No forms yet</h3>
            <p className="text-slate-light mb-6">Create a form and share the link in your ads to capture leads directly to WhatsApp.</p>
            <button onClick={openCreate} className="bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors">
              Create First Form
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((f: any) => (
              <div key={f.id} className="bg-surface rounded-card border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate">{f.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-slate-light'}`}>
                        {f.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs bg-gray-100 text-slate-light px-2 py-0.5 rounded-full">{f._count?.submissions || 0} submissions</span>
                    </div>
                    <div className="text-xs text-slate-light font-mono truncate max-w-sm">{formUrl(f)}</div>
                    {f.prefillMsg && <div className="text-sm text-slate-light mt-1 truncate">&ldquo;{f.prefillMsg}&rdquo;</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(f.id)}
                      className="flex items-center gap-1.5 text-xs text-slate-light hover:text-slate px-2 py-1.5 rounded-btn hover:bg-gray-100 transition-colors"
                      title="Copy link"
                    >
                      {copied === f.id ? (
                        <svg className="w-4 h-4 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                      <span>{copied === f.id ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button
                      onClick={() => { setActiveTab('submissions'); loadSubmissions(f.id); }}
                      className="p-1.5 text-slate-light hover:text-slate rounded-btn hover:bg-gray-100 transition-colors"
                      title="View submissions"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </button>
                    <button onClick={() => openEdit(f)} className="p-1.5 text-slate-light hover:text-slate rounded-btn hover:bg-gray-100 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleToggleActive(f)} className="p-1.5 text-slate-light hover:text-amber rounded-btn hover:bg-amber/10 transition-colors" title={f.isActive ? 'Deactivate' : 'Activate'}>
                      {f.isActive ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button onClick={() => handleDelete(f.id)} className="p-1.5 text-slate-light hover:text-red-500 rounded-btn hover:bg-red-50 transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div>
          {!selectedForm ? (
            <div className="text-center py-12 text-slate-light">Select a form to view its submissions</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-lg text-slate">{selectedForm.name} — Submissions</h3>
                  <p className="text-xs text-slate-light">{selectedForm._count?.submissions || selectedForm.submissions?.length || 0} total</p>
                </div>
                <button onClick={() => setSelectedForm(null)} className="text-sm text-slate-light hover:text-slate">← Back</button>
              </div>
              {(selectedForm.submissions || []).length === 0 ? (
                <div className="bg-surface rounded-card border border-gray-100 p-8 text-center text-slate-light text-sm">
                  No submissions yet. Share your form link to start collecting responses.
                </div>
              ) : (
                <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Phone</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Answers</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedForm.submissions.map((s: any) => {
                        let answers: any = {};
                        try { answers = JSON.parse(s.answers || '{}'); } catch {}
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4 text-sm font-mono text-slate">{s.phone}</td>
                            <td className="px-6 py-4 text-sm text-slate">
                              <div className="space-y-0.5">
                                {Object.entries(answers).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                                  <div key={k}><span className="text-slate-light">{k}:</span> <span className="font-medium">{String(v)}</span></div>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-light">{new Date(s.createdAt).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-surface">
              <h3 className="font-heading text-xl text-slate">{editingForm ? 'Edit Form' : 'New WhatsApp Form'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-light hover:text-slate">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Form Name *</label>
                <input type="text" placeholder="e.g. Easter Promo Lead Form" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Your WhatsApp Number *</label>
                <input type="text" placeholder="233244123456" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Opening Message</label>
                <input type="text" placeholder="Hi! I'm interested in..." value={form.prefillMsg} onChange={e => setForm({ ...form, prefillMsg: e.target.value })} className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40" />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-slate">Questions</div>
                    <div className="text-xs text-slate-light">Add questions to collect before opening WhatsApp</div>
                  </div>
                  <button type="button" onClick={() => addQuestion()} className="text-xs text-amber hover:text-amber-dark font-medium">+ Add</button>
                </div>

                {/* Quick add presets */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUESTION_PRESETS.map((p, i) => (
                    <button type="button" key={i} onClick={() => addQuestion(p)} className="text-xs bg-amber/10 text-amber px-2 py-1 rounded-full hover:bg-amber/20 transition-colors">
                      + {p.field}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {form.questions.map((q: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <input type="text" value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)} placeholder="Question text" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-amber/40" />
                          <div className="flex gap-2">
                            <select value={q.field} onChange={e => updateQuestion(i, 'field', e.target.value)} className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white">
                              <option value="name">name</option>
                              <option value="_phone">_phone</option>
                              <option value="email">email</option>
                              <option value="phone">phone</option>
                              <option value="service">service</option>
                              <option value="message">message</option>
                              <option value="custom">custom</option>
                            </select>
                            <select value={q.field} onChange={e => updateQuestion(i, 'field', e.target.value)} className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white">
                              <option value="name">Short text</option>
                              <option value="_phone">Phone</option>
                              <option value="email">Email</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs text-slate-light self-center">
                              <input type="checkbox" checked={q.required} onChange={e => updateQuestion(i, 'required', e.target.checked)} className="rounded" />
                              Required
                            </label>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeQuestion(i)} className="text-slate-light hover:text-red-500 mt-1 shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="text-sm font-medium text-slate mb-1.5">Auto-tag submissions</div>
                <div className="text-xs text-slate-light mb-3">Contacts from this form will be tagged for segmentation</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-light mb-1">Tag value</label>
                    <input type="text" placeholder="form-signup" value={form.tagValue} onChange={e => setForm({ ...form, tagValue: e.target.value })} className="w-full px-3 py-2 text-sm rounded-btn border border-gray-200 focus:outline-none focus:ring-1 focus:ring-amber/40" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingForm ? 'Update Form' : 'Create Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}