"use client";

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CSVImport = ({ stages, onImportComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname');
    const emailIdx = headers.findIndex(h => h === 'email' || h === 'email address');
    const companyIdx = headers.findIndex(h => h === 'company' || h === 'organization' || h === 'org');
    const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'mobile' || h === 'tel');

    if (nameIdx === -1 || emailIdx === -1) return [];

    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
      return {
        name: cols[nameIdx] || '',
        email: cols[emailIdx] || '',
        company: companyIdx >= 0 ? cols[companyIdx] : '',
        phone: phoneIdx >= 0 ? cols[phoneIdx] : '',
      };
    }).filter(r => r.name && r.email);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setPreview(parsed.slice(0, 5));
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const parsed = parseCSV(ev.target.result);
        if (parsed.length === 0) { alert('No valid leads found. CSV needs name and email columns.'); setLoading(false); return; }

        const rows = parsed.map(p => ({
          name: p.name,
          email: p.email,
          company: p.company,
          phone: p.phone || null,
          stage_id: stages[0]?.id,
          user_id: user.id,
          source_channel: 'csv'
        }));

        const { error } = await supabase.from('leads').insert(rows);
        if (error) throw error;

        onImportComplete();
        setIsOpen(false);
        setFile(null);
        setPreview([]);
      };
      reader.readAsText(file);
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-2">
        <Upload className="w-4 h-4" /> Import CSV
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Bulk Import Leads</h2>
          <button onClick={() => { setIsOpen(false); setFile(null); setPreview([]); }} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/50 transition-all cursor-pointer group"
          onClick={() => document.getElementById('csv-input').click()}>
          <input type="file" id="csv-input" className="hidden" accept=".csv" onChange={handleFileChange} />
          <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <FileText className="text-indigo-600 w-8 h-8" />
          </div>
          <p className="font-bold text-slate-800">{file ? file.name : 'Upload your .csv file'}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Requires: name, email columns</p>
        </div>

        {preview.length > 0 && (
          <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Preview ({preview.length} of {file?.name})</p>
            {preview.map((p, i) => (
              <div key={i} className="text-xs text-slate-600 py-1 border-b border-slate-100 last:border-0">
                {p.name} — {p.email} {p.company && `(${p.company})`}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button disabled={loading || !file} onClick={handleImport}
            className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Import Leads'}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-3 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
          <CheckCircle2 className="text-emerald-500 w-5 h-5 shrink-0" />
          <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
            CSV must have <strong>name</strong> and <strong>email</strong> columns. Optional: company, phone.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CSVImport;
