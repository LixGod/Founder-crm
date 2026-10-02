"use client";

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  XCircle, 
  Play, 
  Pause,
  Plus,
  Loader2,
  ChevronRight,
  MessageSquare,
  Layout,
  Settings,
  Mail,
  Phone,
  Linkedin,
  Save
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const AutomationHub = () => {
  const [jobs, setJobs] = useState([]);
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [editingSequence, setEditingSequence] = useState(null);

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchSequences();
    } else {
      fetchJobs();
    }
  }, [activeTab]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const query = supabase
        .from('automation_jobs')
        .select('*, leads(name, company, email)')
        .order('scheduled_for', { ascending: activeTab === 'upcoming' });

      if (activeTab === 'upcoming') {
        query.eq('status', 'pending');
      } else {
        query.neq('status', 'pending');
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('automation_sequences').select('*');
      if (error) throw error;
      setSequences(data || []);
      if (data?.length > 0 && !editingSequence) setEditingSequence(data[0]);
      else if (data?.length === 0) createDefaultSequence();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSequence = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const newSeq = {
      user_id: user.id,
      name: 'Default Campaign',
      starter_message: "Hi {{name}}, noticed you're doing great work at {{company}}. Would love to connect!",
      followup_message: "Just following up on my previous message. Any thoughts?",
      positive_reply_message: "That's great! When would be a good time to chat?",
      negative_reply_message: "Understood. Thanks for letting me know!",
      channels: ['email', 'whatsapp']
    };
    const { data, error } = await supabase.from('automation_sequences').insert([newSeq]).select();
    if (!error) setSequences(data);
    setEditingSequence(data[0]);
  };

  const saveSequence = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...editingSequence };
      if (!payload.user_id) payload.user_id = user.id;

      const { error, data } = await supabase.from('automation_sequences').upsert(payload).select();
      if (error) throw error;
      
      alert('Sequence saved!');
      await fetchSequences();
      if (data && data[0]) setEditingSequence(data[0]);
    } catch (err) {
      alert('Error saving sequence: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'failed': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'cancelled': return 'bg-slate-50 text-slate-400 border-slate-100';
      default: return 'bg-amber-50 text-amber-600 border-amber-100';
    }
  };

  return (
    <div className="p-8 h-full flex flex-col max-w-6xl mx-auto overflow-y-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500" /> AI Automation Hub
          </h1>
          <p className="text-slate-500 text-sm">Monitor and manage your multi-channel outreach sequences.</p>
        </div>
        
        <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          Engine Active
        </div>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('upcoming')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Upcoming Tasks
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Execution History
        </button>
        <button onClick={() => setActiveTab('templates')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'templates' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Campaign Sequences
        </button>
      </div>

      {activeTab === 'templates' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
          {/* Sequence Sidebar */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Your Campaigns</h3>
            {sequences.map(s => (
              <button key={s.id} onClick={() => setEditingSequence(s)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${editingSequence?.id === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'}`}>
                <div className="font-bold text-sm">{s.name}</div>
                <div className="text-[10px] opacity-60 mt-1 uppercase tracking-tighter">{s.channels.join(' + ')}</div>
              </button>
            ))}
            <button 
              onClick={() => {
                const newSeq = {
                  name: 'New Campaign Sequence',
                  starter_message: '',
                  followup_message: '',
                  positive_reply_message: '',
                  negative_reply_message: '',
                  channels: ['email'],
                  followup_delay_hours: 48
                };
                setEditingSequence(newSeq);
                // We don't save immediately, let user edit and click Save.
              }}
              className="w-full p-4 rounded-2xl border border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center justify-center gap-2 text-sm font-bold">
              <Plus className="w-4 h-4" /> New Sequence
            </button>
          </div>

          {/* Sequence Editor */}
          {editingSequence && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2 rounded-xl">
                      <Layout className="w-5 h-5 text-indigo-600" />
                    </div>
                    <input type="text" value={editingSequence.name} onChange={e => setEditingSequence({...editingSequence, name: e.target.value})}
                      className="text-lg font-bold text-slate-800 bg-transparent border-none focus:ring-0 w-64" />
                  </div>
                  <button onClick={saveSequence} disabled={loading}
                    className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-all">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                  </button>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-center gap-4">
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest shrink-0">Dynamic Variables:</div>
                  <div className="flex gap-2 flex-wrap">
                    {['{{name}}', '{{company}}', '{{role}}'].map(v => (
                      <code key={v} className="bg-white px-2 py-1 rounded-md border border-indigo-200 text-[10px] font-bold text-indigo-700">{v}</code>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Channels</label>
                    <div className="flex gap-2">
                      {['email', 'whatsapp', 'linkedin'].map(ch => (
                        <button key={ch} 
                          onClick={() => {
                            const newCh = editingSequence.channels.includes(ch) 
                              ? editingSequence.channels.filter(c => c !== ch)
                              : [...editingSequence.channels, ch];
                            setEditingSequence({...editingSequence, channels: newCh});
                          }}
                          className={`p-2 rounded-xl border transition-all ${editingSequence.channels.includes(ch) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                          {ch === 'email' && <Mail className="w-4 h-4" />}
                          {ch === 'whatsapp' && <Phone className="w-4 h-4" />}
                          {ch === 'linkedin' && <Linkedin className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Follow-up Delay (Hours)</label>
                    <input type="number" value={editingSequence.followup_delay_hours} onChange={e => setEditingSequence({...editingSequence, followup_delay_hours: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none" />
                  </div>
                </div>

                {/* Message Templates */}
                <div className="space-y-6">
                  {[
                    { key: 'starter_message', label: 'Starter Message', icon: Play, color: 'text-indigo-600' },
                    { key: 'followup_message', label: 'Follow-up Message', icon: Clock, color: 'text-amber-500' },
                    { key: 'positive_reply_message', label: 'Positive AI Response', icon: CheckCircle2, color: 'text-emerald-500' },
                    { key: 'negative_reply_message', label: 'Negative AI Response', icon: XCircle, color: 'text-rose-500' }
                  ].map(msg => (
                    <div key={msg.key} className="space-y-2">
                      <div className="flex items-center gap-2 px-2">
                        <msg.icon className={`${msg.color} w-3.5 h-3.5`} />
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{msg.label}</label>
                      </div>
                      <textarea value={editingSequence[msg.key]} onChange={e => setEditingSequence({...editingSequence, [msg.key]: e.target.value})}
                        rows="3" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/10 outline-none resize-none transition-all"
                        placeholder={`Write your ${msg.label.toLowerCase()}... Use {{name}} and {{company}} for personalization.`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto pr-2 pb-10">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
          ) : jobs.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center">
              <Clock className="w-12 h-12 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 italic">No {activeTab} automation tasks found.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${getStatusStyle(job.status)}`}>
                    {job.status === 'pending' ? <Clock className="w-5 h-5" /> : 
                     job.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                     <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-800">{job.leads?.name}</span>
                      <span className="text-[10px] font-medium text-slate-400">@ {job.leads?.company}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {job.job_type === 'follow_up' ? 'Follow-up Email' : 'Initial Outreach'}
                      </div>
                      <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(job.scheduled_for).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${getStatusStyle(job.status)}`}>
                    {job.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AutomationHub;
