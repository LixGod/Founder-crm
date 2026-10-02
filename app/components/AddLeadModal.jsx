"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AddLeadModal = ({ isOpen, onClose, onLeadAdded, stages, editLead = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
    stage_id: '',
    linkedin_url: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editLead) {
      setFormData({
        name: editLead.name || '',
        email: editLead.email || '',
        phone: editLead.phone || '',
        company: editLead.company || '',
        notes: editLead.context?.notes || '',
        stage_id: editLead.stage_id || '',
        linkedin_url: editLead.linkedin_url || ''
      });
    } else {
      setFormData({ name: '', email: '', phone: '', company: '', notes: '', stage_id: '', linkedin_url: '' });
    }
  }, [editLead, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let result;
      if (editLead) {
        result = await supabase
          .from('leads')
          .update({
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
            linkedin_url: formData.linkedin_url || null,
            company: formData.company,
            stage_id: formData.stage_id || stages[0]?.id,
            context: { ...editLead.context, notes: formData.notes }
          })
          .eq('id', editLead.id)
          .select();
      } else {
        result = await supabase
          .from('leads')
          .insert([{
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
            linkedin_url: formData.linkedin_url || null,
            company: formData.company,
            stage_id: formData.stage_id || stages[0]?.id,
            user_id: user.id,
            context: { notes: formData.notes }
          }])
          .select();
      }

      if (result.error) throw result.error;

      onLeadAdded(result.data[0]);
      onClose();
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">{editLead ? 'Edit Prospect' : 'Add New Lead'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
              <input required type="text" value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
              <input required type="email" value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="john@company.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company</label>
              <input required type="text" value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="Acme Corp" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</label>
              <input type="tel" value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="+91..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">LinkedIn Profile URL</label>
            <input type="url" value={formData.linkedin_url}
              onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="https://linkedin.com/in/..." />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stage</label>
            <select value={formData.stage_id}
              onChange={(e) => setFormData({...formData, stage_id: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none">
              <option value="">Select Stage</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Background Notes</label>
            <textarea value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
              placeholder="Briefly describe the context..." rows="3" />
          </div>

          <button disabled={loading}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-100 mt-4">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> {editLead ? 'Update Lead' : 'Create Lead'}</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddLeadModal;
