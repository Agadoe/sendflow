'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState(0);
  const [nameCol, setNameCol] = useState(-1);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadContacts();
  }, []);

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
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (csvData.length === 0) return;
    setImporting(true);
    try {
      const toImport = csvData.map(row => ({
        phone: row[phoneCol]?.replace(/\D/g, '') || '',
        name: nameCol >= 0 ? row[nameCol] || undefined : undefined,
      })).filter(c => c.phone.length >= 9);

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: toImport }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Imported ${data.count} contacts!`);
        setShowImport(false);
        loadContacts();
      } else {
        toast.error(data.error || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' }).catch(() => {});
    setContacts(contacts.filter(c => c.id !== id));
    toast.success('Contact deleted');
  }

  return (
    <div className="max-w-4xl space-y-6">
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
            onClick={() => setShowImport(true)}
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
          <label className="inline-block bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn cursor-pointer transition-colors">
            Import CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </label>
        </div>
      ) : (
        <div className="bg-surface rounded-card border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider">Phone</th>
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
                  <div className="flex gap-3">
                    <button onClick={() => { setCsvData([]); setHeaders([]); }} className="flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors">Back</button>
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