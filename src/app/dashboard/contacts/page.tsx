'use client';

import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState(0);
  const [nameCol, setNameCol] = useState(-1);
  const [csvOptIn, setCsvOptIn] = useState(false);
  const [csvSegmentIds, setCsvSegmentIds] = useState<string[]>([]);
  const [csvTagsExtra, setCsvTagsExtra] = useState('');
  const [segments, setSegments] = useState<Array<{ id: string; name: string; tag: string; color: string | null; contactCount: number }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual add form
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualTags, setManualTags] = useState('');
  const [manualOptIn, setManualOptIn] = useState(false);

  useEffect(() => {
    loadContacts();
    loadSegments();
  }, []);

  async function loadSegments() {
    try {
      const res = await fetch('/api/segments');
      const data = await res.json();
      setSegments(data.segments || []);
    } catch {}
  }

  async function loadContacts() {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  function parseCSV(text: string): string[][] {
    return text.split('\n').map(row => {
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (const char of row) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
        else { current += char; }
      }
      cells.push(current.trim());
      return cells;
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      const rows = parseCSV(text).filter(r => r.some(c => c));
      if (rows.length < 2) { toast.error('CSV must have at least a header row and 1 data row'); return; }
      setHeaders(rows[0]);
      setCsvData(rows.slice(1));
      setShowImport(true);
      setShowManualAdd(false);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (csvData.length === 0) return;
    if (!csvOptIn) {
      toast.error('Please confirm that all imported contacts have opted in to WhatsApp messages.');
      return;
    }
    // Build the tag list: every selected segment contributes its tag,
    // plus any free-text tags the user typed in the "Extra tags" field.
    const segTagSet = new Set<string>();
    for (const sid of csvSegmentIds) {
      const seg = segments.find((s) => s.id === sid);
      if (seg) segTagSet.add(seg.tag);
    }
    const extraTags = csvTagsExtra
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const t of extraTags) segTagSet.add(t);
    const tagList = Array.from(segTagSet);

    setImporting(true);
    try {
      const toImport = csvData.map(row => ({
        phone: row[phoneCol]?.replace(/\D/g, '') || '',
        name: nameCol >= 0 ? row[nameCol] || undefined : undefined,
        optedIn: true,
        optedInSource: 'csv-import',
        tags: tagList.length > 0 ? tagList : undefined,
      })).filter(c => c.phone.length >= 9);

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: toImport }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Imported ${data.created} contacts!${data.skipped > 0 ? ` (${data.skipped} duplicates skipped)` : ''}${csvSegmentIds.length > 0 || csvTagsExtra ? ` Tagged with ${Array.from(new Set([...segments.filter((s) => csvSegmentIds.includes(s.id)).map((s) => s.tag), ...csvTagsExtra.split(',').map((t) => t.trim()).filter(Boolean)])).length} tag(s).` : ''}`);
        setShowImport(false);
        setCsvData([]);
        setHeaders([]);
        setCsvOptIn(false);
        setCsvSegmentIds([]);
        setCsvTagsExtra('');
        loadContacts();
      } else {
        toast.error(data.error || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!manualPhone || manualPhone.replace(/\D/g, '').length < 9) {
      toast.error('Please enter a valid phone number');
      return;
    }
    if (!manualOptIn) {
      toast.error('Please confirm that this contact has opted in to WhatsApp messages.');
      return;
    }
    setSavingManual(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [{
            phone: manualPhone.replace(/\D/g, ''),
            name: manualName || undefined,
            tags: manualTags.split(',').map(t => t.trim()).filter(Boolean),
            optedIn: true,
            optedInSource: 'manual-add',
          }]
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Contact added!');
        setManualName('');
        setManualPhone('');
        setManualTags('');
        setManualOptIn(false);
        setShowManualAdd(false);
        loadContacts();
      } else {
        toast.error(data.error || 'Failed to add contact');
      }
    } finally {
      setSavingManual(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' }).catch(() => {});
    setContacts(contacts.filter(c => c.id !== id));
    toast.success('Contact deleted');
  }

  function openManualAdd() {
    setShowManualAdd(true);
    setShowImport(false);
    setCsvData([]);
    setHeaders([]);
  }

  function openImport() {
    setShowImport(true);
    setShowManualAdd(false);
    fileRef.current?.click();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-slate">Contacts</h1>
          <p className="text-sm text-slate-light mt-0.5">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-slate text-sm font-medium px-4 py-2.5 rounded-btn cursor-pointer transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import CSV
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </label>
          <button
            onClick={openManualAdd}
            className="flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Manually
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-light">Loading...</div>
      ) : contacts.length === 0 ? (
        <div className="bg-surface rounded-card border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="font-heading text-xl text-slate mb-2">No contacts yet</h3>
          <p className="text-slate-light mb-6">Import a CSV or add contacts one by one to get started.</p>
          <div className="flex gap-3 justify-center">
            <label className="inline-block bg-gray-100 hover:bg-gray-200 text-slate font-semibold px-6 py-3 rounded-btn cursor-pointer transition-colors">
              Import CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </label>
            <button onClick={openManualAdd} className="inline-block bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors">
              Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Phone</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">WhatsApp</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Tags</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Added</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contacts.map((c: any) => {
                const tags = JSON.parse(c.tags || '[]');
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate">{c.name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate font-mono">{c.phone}</td>
                    <td className="px-6 py-4">
                      {c.optedIn ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Opted in
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Not opted in</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {tags.map((t: string) => (
                          <span key={t} className="text-xs bg-amber/10 text-amber px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-light">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleDelete(c.id)} className="text-slate-light hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Add Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading text-xl text-slate">Add Contact</h3>
              <button onClick={() => setShowManualAdd(false)} className="text-slate-light hover:text-slate">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleManualAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Phone *</label>
                <input
                  type="tel"
                  placeholder="e.g. 024 123 4567"
                  value={manualPhone}
                  onChange={e => setManualPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate mb-1.5">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP, Lagos, Braids"
                  value={manualTags}
                  onChange={e => setManualTags(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                />
              </div>
              <div className="bg-amber/5 border border-amber/10 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    id="manual-optin"
                    type="checkbox"
                    checked={manualOptIn}
                    onChange={e => setManualOptIn(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-amber border-gray-300 rounded focus:ring-amber"
                    required
                  />
                  <label htmlFor="manual-optin" className="text-sm text-slate">
                    <span className="font-medium">This contact has opted in to receive WhatsApp messages.</span>
                    <p className="text-slate-light text-xs mt-1">
                      By checking this box, you confirm this person has explicitly consented to receiving WhatsApp messages from your business. Required for compliance.
                    </p>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowManualAdd(false)} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={savingManual} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingManual ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {savingManual ? 'Saving...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-card w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-surface">
              <h3 className="font-heading text-xl text-slate">Import Contacts</h3>
              <button onClick={() => setShowImport(false)} className="text-slate-light hover:text-slate">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {csvData.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate mb-1">Phone column *</label>
                      <select value={phoneCol} onChange={e => setPhoneCol(Number(e.target.value))} className="w-full px-3 py-2 rounded-btn border border-gray-200 text-slate">
                        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate mb-1">Name column (optional)</label>
                      <select value={nameCol} onChange={e => setNameCol(Number(e.target.value))} className="w-full px-3 py-2 rounded-btn border border-gray-200 text-slate">
                        <option value={-1}>— None</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                    <span className="font-semibold text-green-700">{csvData.length} rows ready to import</span>
                  </div>
                  <div className="border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {headers.map((h, i) => <th key={i} className="px-3 py-2 text-left text-slate-light font-medium whitespace-nowrap border-r border-gray-100">{h || `Col ${i + 1}`}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            {row.map((cell, j) => <td key={j} className={`px-3 py-2 whitespace-nowrap border-r border-gray-50 ${j === phoneCol ? 'bg-amber/5 font-semibold' : ''}`}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvData.length > 5 && <div className="px-3 py-2 text-xs text-slate-light bg-gray-50">+ {csvData.length - 5} more rows</div>}
                  </div>
                  <div className="bg-amber/5 border border-amber/10 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <input
                        id="csv-optin"
                        type="checkbox"
                        checked={csvOptIn}
                        onChange={e => setCsvOptIn(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-amber border-gray-300 rounded focus:ring-amber"
                      />
                      <label htmlFor="csv-optin" className="text-sm text-slate">
                        <span className="font-medium">I confirm all imported contacts have opted in to WhatsApp messages.</span>
                        <p className="text-slate-light text-xs mt-1">
                          You must have explicit consent from every person in this list before sending them WhatsApp messages. Importing without consent violates WhatsApp's Terms of Service and may result in permanent account bans.
                        </p>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate mb-1.5">
                      Tag imported contacts with
                      <span className="text-slate-light font-normal ml-1">(multi-select)</span>
                    </label>
                    {segments.length === 0 ? (
                      <div className="text-xs text-slate-light p-3 bg-gray-50 rounded-btn border border-gray-200">
                        No segments yet. <a href="/dashboard/segments" className="text-amber hover:underline">Create one →</a> Tags can also be added later.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-btn p-2 bg-white">
                        {segments.map((s) => {
                          const selected = csvSegmentIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                                selected ? 'bg-amber/10' : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  setCsvSegmentIds((prev) =>
                                    prev.includes(s.id)
                                      ? prev.filter((x) => x !== s.id)
                                      : [...prev, s.id]
                                  );
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-amber focus:ring-amber"
                              />
                              {s.color && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: s.color }}
                                />
                              )}
                              <span className="text-sm text-slate flex-1">{s.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Extra tags (comma-separated, optional)"
                        value={csvTagsExtra}
                        onChange={(e) => setCsvTagsExtra(e.target.value)}
                        className="w-full px-3 py-2 rounded-btn border border-gray-200 text-slate text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setCsvData([]); setHeaders([]); setCsvOptIn(false); setCsvSegmentIds([]); setCsvTagsExtra(''); }} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Back</button>
                    <button onClick={handleImport} disabled={importing} className="flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                      {importing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      {importing ? `Importing ${csvData.length}...` : `Import ${csvData.length} Contacts`}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center hover:border-amber/50 transition-colors">
                    <div className="text-4xl mb-3">📁</div>
                    <div className="text-slate font-medium mb-1">Drop your CSV or Excel file here</div>
                    <div className="text-sm text-slate-light mb-4">CSV with headers: Name, Phone (required)</div>
                    <label className="inline-block bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-2.5 rounded-btn cursor-pointer transition-colors">
                      Browse Files
                      <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
