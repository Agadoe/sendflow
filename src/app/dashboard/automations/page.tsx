'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const TRIGGERS = [
  { value: 'contact_added', label: 'Contact Added' },
  { value: 'tag_applied', label: 'Tag Applied' },
  { value: 'tag_removed', label: 'Tag Removed' },
  { value: 'scheduled', label: 'Scheduled' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'delay', label: 'Delay' },
];

const CHANNELS = ['whatsapp', 'email', 'sms'];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger: 'contact_added',
  });

  const [actions, setActions] = useState<any[]>([
    { id: '1', type: 'send_sms', channel: 'whatsapp', template: '', delayMinutes: 0, sequenceOrder: 0 },
  ]);

  useEffect(() => {
    fetchAutomations();
  }, []);

  async function fetchAutomations() {
    try {
      const res = await fetch('/api/automations');
      const data = await res.json();
      setAutomations(data.automations || []);
    } catch {
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  }

  function addAction() {
    setActions(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type: 'send_sms',
        channel: 'whatsapp',
        template: '',
        delayMinutes: 0,
        sequenceOrder: prev.length,
      },
    ]);
  }

  function removeAction(id: string) {
    setActions(prev => prev.filter(a => a.id !== id));
  }

  function updateAction(id: string, field: string, value: any) {
    setActions(prev =>
      prev.map(a => (a.id === id ? { ...a, [field]: value } : a))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Automation name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        trigger: form.trigger,
        actions: actions.map((a, i) => ({ ...a, sequenceOrder: i })),
      };

      const url = editingId ? `/api/automations/${editingId}` : '/api/automations';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId ? 'Automation updated' : 'Automation created');
        setShowModal(false);
        setEditingId(null);
        setForm({ name: '', description: '', trigger: 'contact_added' });
        setActions([{ id: '1', type: 'send_sms', channel: 'whatsapp', template: '', delayMinutes: 0, sequenceOrder: 0 }]);
        fetchAutomations();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this automation?')) return;
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Automation deleted');
        fetchAutomations();
      } else {
        toast.error('Delete failed');
      }
    } catch {
      toast.error('Network error');
    }
  }

  async function handleRun(automationId: string) {
    toast.loading('Running automation...', { id: 'run-automation' });
    try {
      // Run for all contacts
      const res = await fetch(`/api/automations/${automationId}/run`, { method: 'POST' });
      const data = await res.json();
      toast.dismiss('run-automation');
      if (res.ok) {
        toast.success(`Automation triggered for ${data.contactsAffected || 0} contacts`);
      } else {
        toast.error(data.error || 'Run failed');
      }
    } catch {
      toast.dismiss('run-automation');
      toast.error('Network error');
    }
  }

  function openEdit(automation: any) {
    setEditingId(automation.id);
    setForm({ name: automation.name, description: automation.description || '', trigger: automation.trigger });
    let parsedActions = [];
    try { parsedActions = JSON.parse(automation.actions); } catch { parsedActions = []; }
    if (parsedActions.length === 0) {
      parsedActions = [{ id: '1', type: 'send_sms', channel: 'whatsapp', template: '', delayMinutes: 0, sequenceOrder: 0 }];
    } else {
      parsedActions = parsedActions.map((a: any, i: number) => ({ ...a, id: a.id || (i + 1).toString() }));
    }
    setActions(parsedActions);
    setShowModal(true);
  }

  function triggerLabel(trigger: string) {
    return TRIGGERS.find(t => t.value === trigger)?.label || trigger;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-heading text-slate">Automations</h1>
          <p className="text-sm text-slate-light mt-1">Automate your marketing with trigger-based action sequences</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm({ name: '', description: '', trigger: 'contact_added' });
            setActions([{ id: '1', type: 'send_sms', channel: 'whatsapp', template: '', delayMinutes: 0, sequenceOrder: 0 }]);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber text-white rounded-lg hover:bg-amber-dark transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Automation
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-amber border-t-transparent rounded-full" />
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-heading text-slate mb-2">No automations yet</h3>
          <p className="text-sm text-slate-light mb-6">Create your first automation to streamline your marketing</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-amber text-white rounded-lg hover:bg-amber-dark transition-colors text-sm font-medium"
          >
            Create your first automation
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wider">Automation</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wider">Trigger</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wider">Last Run</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-slate-light uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {automations.map((automation: any) => (
                <tr key={automation.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate">{automation.name}</div>
                    {automation.description && (
                      <div className="text-xs text-slate-light mt-0.5">{automation.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-light">
                      <svg className="w-3.5 h-3.5 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {triggerLabel(automation.trigger)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-pill text-xs font-medium ${
                      automation.isEnabled
                        ? 'bg-green-50 text-green-600'
                        : 'bg-gray-100 text-slate-light'
                    }`}>
                      {automation.isEnabled ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-light">
                    {formatDate(automation.lastTriggered)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRun(automation.id)}
                        className="p-2 text-slate-light hover:text-amber transition-colors"
                        title="Run now"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEdit(automation)}
                        className="p-2 text-slate-light hover:text-slate transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(automation.id)}
                        className="p-2 text-slate-light hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-heading text-slate">
                {editingId ? 'Edit Automation' : 'Create Automation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-light hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Automation Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Welcome sequence for new contacts"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Description <span className="text-slate-light font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of what this automation does"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber"
                />
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Trigger</label>
                <select
                  value={form.trigger}
                  onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber bg-white"
                >
                  {TRIGGERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate">Action Sequence</label>
                  <button
                    type="button"
                    onClick={addAction}
                    className="text-xs text-amber hover:text-amber-dark font-medium flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {actions.map((action, idx) => (
                    <div key={action.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="w-6 h-6 rounded-full bg-amber text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>
                        {idx < actions.length - 1 && (
                          <div className="w-px flex-1 h-4 bg-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-light mb-1">Type</label>
                          <select
                            value={action.type}
                            onChange={e => updateAction(action.id, 'type', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber/50 bg-white"
                          >
                            {ACTION_TYPES.map(at => (
                              <option key={at.value} value={at.value}>{at.label}</option>
                            ))}
                          </select>
                        </div>
                        {action.type === 'delay' ? (
                          <div>
                            <label className="block text-xs text-slate-light mb-1">Delay (minutes)</label>
                            <input
                              type="number"
                              min="0"
                              value={action.delayMinutes}
                              onChange={e => updateAction(action.id, 'delayMinutes', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber/50"
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs text-slate-light mb-1">Channel</label>
                              <select
                                value={action.channel}
                                onChange={e => updateAction(action.id, 'channel', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber/50 bg-white"
                              >
                                {CHANNELS.map(ch => (
                                  <option key={ch} value={ch}>{ch.charAt(0).toUpperCase() + ch.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-light mb-1">Message / Template</label>
                              <input
                                type="text"
                                value={action.template}
                                onChange={e => updateAction(action.id, 'template', e.target.value)}
                                placeholder="e.g. Hi {{name}}, welcome!"
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber/50"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      {actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="mt-5 p-1 text-slate-light hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-light hover:text-slate transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber text-white text-sm font-medium rounded-lg hover:bg-amber-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingId ? 'Update Automation' : 'Create Automation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
