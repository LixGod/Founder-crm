"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Mail, Clock, MessageSquare, Loader2, Globe, Upload, X, Zap, Calendar, Linkedin, Phone, Search, Users, Layout, CheckSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AddLeadModal from './AddLeadModal';
import LeadScraper from './LeadScraper';
import CSVImport from './CSVImport';
import UnifiedInbox from './UnifiedInbox';

const KanbanBoard = () => {
  const [columns, setColumns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeads, setSelectedLeads] = useState([]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('public-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLeads(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
          setSelectedLead(prev => prev?.id === payload.new.id ? payload.new : prev);
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let { data: stages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('order_index');

      if (stagesError) throw stagesError;

      // Filter duplicates by name and ensure Lead exists
      const uniqueStages = [];
      const stageNames = new Set();
      
      let hasLead = false;
      for (const s of (stages || [])) {
        if (!stageNames.has(s.name)) {
          if (s.name.toLowerCase() === 'lead') hasLead = true;
          stageNames.add(s.name);
          uniqueStages.push(s);
        }
      }

      if (uniqueStages.length === 0 || !hasLead) {
        if (!hasLead && uniqueStages.length > 0) {
           const leadStage = { name: 'Lead', order_index: -1, user_id: user.id };
           const { data: insertedLead } = await supabase.from('pipeline_stages').insert([leadStage]).select();
           if (insertedLead?.[0]) {
             uniqueStages.unshift(insertedLead[0]);
             stageNames.add('Lead');
           }
        } else if (uniqueStages.length === 0) {
          const defaultStages = [
            { name: 'Lead', order_index: 0, user_id: user.id },
            { name: 'Contacted', order_index: 1, user_id: user.id },
            { name: 'Proposal', order_index: 2, user_id: user.id },
            { name: 'Negotiation', order_index: 3, user_id: user.id },
            { name: 'Won', order_index: 4, user_id: user.id },
          ];
          const { data: newStages, error: seedError } = await supabase
            .from('pipeline_stages').insert(defaultStages).select();
          if (seedError) throw seedError;
          uniqueStages.push(...(newStages || []));
        }
      }

      // Sort by order_index
      uniqueStages.sort((a, b) => a.order_index - b.order_index);

      setColumns(uniqueStages);

      const { data: leadsData, error: leadsError } = await supabase.from('leads').select('*');
      if (leadsError) throw leadsError;
      setLeads(leadsData || []);
    } catch (error) {
      console.error('CRM Error:', error.message);
    } finally {
      setLoading(false);
    }
  };


  const stageColors = {
    'Lead': 'bg-blue-500', 'Contacted': 'bg-amber-500', 'Proposal': 'bg-emerald-500',
    'Negotiation': 'bg-purple-500', 'Won': 'bg-indigo-600'
  };

  const handleMoveLeads = async (targetStageId) => {
    if (selectedLeads.length === 0) return;
    
    setLeads(prev => prev.map(l => selectedLeads.includes(l.id) ? { ...l, stage_id: targetStageId } : l));
    const { error } = await supabase.from('leads').update({ stage_id: targetStageId }).in('id', selectedLeads);
    
    if (error) {
      alert("Error moving leads: " + error.message);
      fetchData(); // Rollback
    } else {
      setSelectedLeads([]);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Pipeline Stacks */}
        <div className="flex-1 overflow-x-auto">
          <div className="p-12 h-full flex items-center justify-start lg:justify-center gap-12 min-w-max">
            {columns.map((column) => {
              const columnLeads = leads.filter(l => l.stage_id === column.id);
              return (
                <div key={column.id} onClick={() => setExpandedStage(column)}
                  className="w-64 h-96 flex-shrink-0 relative group cursor-pointer">
                  {/* Visual Stack of Cards */}
                  <div className="absolute inset-0 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 translate-x-3 translate-y-3 opacity-30 group-hover:translate-x-4 group-hover:translate-y-4 transition-all"></div>
                  <div className="absolute inset-0 bg-white rounded-[2.5rem] shadow-md border border-slate-100 translate-x-1.5 translate-y-1.5 opacity-60 group-hover:translate-x-2 group-hover:translate-y-2 transition-all"></div>
                  <div className="absolute inset-0 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center gap-4 transition-all group-hover:-translate-y-2 group-hover:border-indigo-400">
                    <div className={`w-12 h-12 rounded-2xl ${stageColors[column.name] || 'bg-slate-400'} flex items-center justify-center shadow-lg`}>
                      <Layout className="text-white w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-1">{column.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{columnLeads.length} Total Leads</p>
                    </div>
                    {columnLeads.length > 0 && (
                      <div className="mt-4 flex -space-x-2">
                        {columnLeads.slice(0, 3).map((l, i) => (
                          <div key={i} className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white uppercase">
                            {l.name?.charAt(0)}
                          </div>
                        ))}
                        {columnLeads.length > 3 && (
                          <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">
                            +{columnLeads.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expanded Stage Explorer */}
      {expandedStage && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => { setExpandedStage(null); setSelectedLeads([]); setSearchQuery(''); }} />
          <div className="relative bg-white w-full max-w-6xl h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${stageColors[expandedStage.name] || 'bg-slate-400'} flex items-center justify-center`}>
                  <Layout className="text-white w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{expandedStage.name}</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage leads in this stage</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 flex-1 max-w-xl mx-12">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder={`Search in ${expandedStage.name}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedLeads.length > 0 && (
                  <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{selectedLeads.length} Selected</span>
                    <div className="w-px h-4 bg-indigo-200 mx-2" />
                    <select 
                      onChange={(e) => handleMoveLeads(e.target.value)}
                      className="bg-transparent text-[10px] font-black text-indigo-600 uppercase tracking-widest outline-none cursor-pointer"
                      value=""
                    >
                      <option value="" disabled>Move To...</option>
                      {columns.filter(c => c.id !== expandedStage.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button onClick={() => { setExpandedStage(null); setSelectedLeads([]); }} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Leads Horizontal List */}
            <div className="flex-1 overflow-x-auto p-8 bg-slate-50/50">
              <div className="flex gap-6 h-full pb-6">
                {leads
                  .filter(l => l.stage_id === expandedStage.id)
                  .filter(l => l.name?.toLowerCase().includes(searchQuery.toLowerCase()) || l.company?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((lead) => (
                    <div key={lead.id} onClick={() => {
                      if (selectedLeads.includes(lead.id)) {
                        setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                      } else {
                        setSelectedLeads([...selectedLeads, lead.id]);
                      }
                    }}
                    className={`w-72 h-full flex-shrink-0 bg-white p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer flex flex-col ${selectedLeads.includes(lead.id) ? 'border-indigo-600 ring-8 ring-indigo-500/5 shadow-2xl -translate-y-4' : 'border-slate-100 hover:border-indigo-300 hover:-translate-y-2'}`}>
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                          {lead.name?.charAt(0)}
                        </div>
                        {selectedLeads.includes(lead.id) && <CheckSquare className="w-5 h-5 text-indigo-600" />}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-base mb-1">{lead.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{lead.company}</p>
                        
                        <div className="space-y-2">
                          {lead.email && <div className="flex items-center gap-2 text-xs text-slate-500"><Mail className="w-3.5 h-3.5 text-indigo-400" /> <span className="truncate">{lead.email}</span></div>}
                          {lead.phone && <div className="flex items-center gap-2 text-xs text-slate-500"><Phone className="w-3.5 h-3.5 text-emerald-400" /> {lead.phone}</div>}
                        </div>
                      </div>

                      <div className="pt-6 mt-6 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {lead.last_contacted_at ? "Active" : "New"}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); setIsPanelOpen(true); }}
                          className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                  
                {leads.filter(l => l.stage_id === expandedStage.id).length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-20">
                    <Users className="w-16 h-16 text-slate-100 mb-6" />
                    <h3 className="text-xl font-bold text-slate-300">No leads in this stack</h3>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Panel */}
      {isPanelOpen && selectedLead && (
        <>
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px] z-40" onClick={() => setIsPanelOpen(false)} />
          <aside className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)] z-50 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-lg">
                  {selectedLead.name?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{selectedLead.name}</h2>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-400">{selectedLead.company} • {selectedLead.email}</p>
                    {selectedLead.linkedin_url && (
                      <a href={selectedLead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700">
                        <Linkedin className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsPanelOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="px-6 py-3 flex gap-2 border-b border-slate-50 bg-slate-50/30">
              {selectedLead.phone && (
                <a href={`tel:${selectedLead.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all shadow-sm">
                  <Phone className="w-3 h-3" /> Call
                </a>
              )}
              {selectedLead.email && (
                <a href={`mailto:${selectedLead.email}`} className="flex-1 flex items-center justify-center gap-2 py-2 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all shadow-sm">
                  <Mail className="w-3 h-3" /> Email
                </a>
              )}
            </div>

            {/* Context */}
            <div className="p-4 border-b border-slate-50">
              <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">AI Notes</span>
                </div>
                <p className="text-sm text-indigo-900/70">{selectedLead.context?.notes || 'No notes yet.'}</p>
              </div>
            </div>

            {/* Unified Inbox */}
            <div className="flex-1 overflow-hidden">
              <UnifiedInbox leadId={selectedLead.id} />
            </div>
          </aside>
        </>
      )}

    </div>
  );
};

export default KanbanBoard;
