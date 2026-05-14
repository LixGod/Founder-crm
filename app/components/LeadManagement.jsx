"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Mail, Phone, Linkedin, MoreVertical, Filter, Loader2, Trash2, Zap, Play, CheckSquare, Square, Globe, RefreshCw, Edit2, Plus, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AddLeadModal from './AddLeadModal';
import LeadScraper from './LeadScraper';
import UnifiedInbox from './UnifiedInbox';

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stages, setStages] = useState({ map: {}, list: [] });
  const [showScraper, setShowScraper] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Lead Panel State
  const [selectedLead, setSelectedLead] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Campaign State
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [sequences, setSequences] = useState([]);
  const [enrichingId, setEnrichingId] = useState(null);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data: stagesData } = await supabase.from('pipeline_stages').select('id, name').order('order_index');
      const stageMap = {};
      const stagesList = [];
      const stageNames = new Set();
      
      stagesData?.forEach(s => {
        if (!stageNames.has(s.name)) {
          stageNames.add(s.name);
          stageMap[s.id] = s.name;
          stagesList.push(s);
        }
      });
      setStages({ map: stageMap, list: stagesList });

      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data || []);

      const { data: seqData } = await supabase.from('automation_sequences').select('id, name');
      setSequences(seqData || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const launchSequence = async (sequenceId) => {
    if (selectedLeads.length === 0 || !sequenceId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/campaigns/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ sequenceId, leadIds: selectedLeads })
      });
      if (!res.ok) throw new Error('Launch failed');
      
      // Auto-update stage to 'Contacted' for these leads
      const contactedStage = stages.list.find(s => s.name.toLowerCase() === 'contacted');
      if (contactedStage) {
        await supabase.from('leads').update({ stage_id: contactedStage.id }).in('id', selectedLeads);
        setLeads(prev => prev.map(l => selectedLeads.includes(l.id) ? { ...l, stage_id: contactedStage.id } : l));
      }

      alert(`Campaign launched for ${selectedLeads.length} leads!`);
      setSelectedLeads([]);
      setShowCampaignPicker(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const enrichLead = async (lead) => {
    if (!lead.company && !lead.name) return;
    setEnrichingId(lead.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/scrape/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ leadId: lead.id })
      });

      if (!res.ok) throw new Error('Enrichment failed');
      const { email } = await res.json();
      
      if (email) {
        setLeads(leads.map(l => l.id === lead.id ? { ...l, email } : l));
      } else {
        alert('Could not find email on company website.');
      }
    } catch (err) { alert(err.message); }
    finally { setEnrichingId(null); }
  };

  const deleteLead = async (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (!error) setLeads(leads.filter(l => l.id !== id));
    else alert('Error deleting: ' + error.message);
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setIsEditModalOpen(true);
  };

  const filteredLeads = leads.filter(l => 
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.company?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        
        // Find indexes
        const idxName = headers.indexOf('name');
        const idxCompany = headers.indexOf('company');
        const idxEmail = headers.indexOf('email');
        const idxPhone = headers.indexOf('phone');

        if (idxName === -1 || idxCompany === -1) {
          throw new Error("CSV must contain at least 'name' and 'company' columns.");
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        // Find default stage (Lead)
        let defaultStageId = stages.list.find(s => s.name.toLowerCase() === 'lead')?.id;
        if (!defaultStageId && stages.list.length > 0) defaultStageId = stages.list[0].id;

        const newLeads = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          newLeads.push({
            user_id: user.id,
            stage_id: defaultStageId,
            name: cols[idxName] || '',
            company: cols[idxCompany] || '',
            email: idxEmail !== -1 ? cols[idxEmail] : null,
            phone: idxPhone !== -1 ? cols[idxPhone] : null,
            context: { source: 'csv_import' }
          });
        }

        const { data, error } = await supabase.from('leads').insert(newLeads).select();
        if (error) throw error;
        
        setLeads(prev => [...(data || []), ...prev]);
        alert(`Successfully imported ${data?.length || 0} leads!`);
      } catch (err) {
        alert("Error importing CSV: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset
  };

  return (
    <div className="p-8 h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" /> Lead Management
          </h1>
          <p className="text-slate-500 text-sm">Manage {leads.length} leads in your database.</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <label className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-sm font-bold px-6 py-3 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-sm">
            <Plus className="w-4 h-4" /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={() => setIsAddModalOpen(true)}
            className="bg-slate-900 hover:bg-black text-white text-sm font-bold px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl shadow-slate-200">
            <Plus className="w-4 h-4" /> New Lead
          </button>
          <button onClick={() => setShowScraper(!showScraper)}
            className={`text-sm font-bold flex items-center gap-2 px-6 py-3 rounded-2xl transition-all ${showScraper ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-400'}`}>
            <Globe className="w-4 h-4" /> AI Finder
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-64 transition-all shadow-sm" />
          </div>
        </div>
      </div>

      {showScraper && (
        <div className="mb-8">
          <LeadScraper stages={stages.list} onLeadsFound={(newLead) => setLeads(prev => [newLead, ...prev])} />
        </div>
      )}

      {/* Bulk Actions Header */}
      {selectedLeads.length > 0 && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3 text-indigo-800 font-bold">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
            {selectedLeads.length} Leads Selected
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedLeads([])} className="text-sm font-bold text-slate-400 hover:text-slate-600 px-4">Cancel</button>
            <div className="relative">
              <button onClick={() => setShowCampaignPicker(!showCampaignPicker)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-6 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
                <Play className="w-4 h-4" /> Launch Campaign
              </button>
              {showCampaignPicker && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20">
                  <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">Select Sequence</div>
                  {sequences.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No sequences found. Create one in the Automation Hub.</div>
                  ) : (
                    sequences.map(s => (
                      <button key={s.id} onClick={() => launchSequence(s.id)}
                        className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                        {s.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
          {filteredLeads.map((lead) => (
            <div key={lead.id} 
              onClick={() => { 
                if (selectedLeads.length > 0) {
                  setSelectedLeads(prev => prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id]);
                } else {
                  setSelectedLead(lead); setIsPanelOpen(true); 
                }
              }}
              className={`bg-white p-6 rounded-[2.5rem] border transition-all group relative overflow-hidden cursor-pointer ${selectedLeads.includes(lead.id) || selectedLead?.id === lead.id ? 'border-indigo-500 ring-8 ring-indigo-500/5 shadow-2xl' : 'border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1'}`}>
              
              {/* Selection Checkbox */}
              <div onClick={(e) => {
                e.stopPropagation();
                setSelectedLeads(prev => prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id]);
              }} className="absolute top-4 left-4 z-10 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {selectedLeads.includes(lead.id) ? (
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-300 hover:text-indigo-400" />
                )}
              </div>
              {selectedLeads.includes(lead.id) && <div className="absolute top-4 left-4 z-10 p-2"><CheckSquare className="w-5 h-5 text-indigo-600" /></div>}
              
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(lead); }} 
                  className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-400 hover:text-indigo-600 rounded-xl shadow-lg border border-slate-100 transition-all hover:scale-110">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteLead(lead.id); }} 
                  className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-400 hover:text-rose-500 rounded-xl shadow-lg border border-slate-100 transition-all hover:scale-110">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-slate-200">
                  {lead.name?.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-slate-800 text-base truncate">{lead.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lead.company || 'Private'}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  <Mail className="w-4 h-4 text-indigo-400" /> 
                  <span className="truncate">{lead.email || 'No email found'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  <Phone className="w-4 h-4 text-emerald-400" /> 
                  <span>{lead.phone || 'No phone'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                  {stages.map?.[lead.stage_id] || 'Lead'}
                </div>
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                  View Interactions
                </span>
              </div>
            </div>
          ))}
          
          {filteredLeads.length === 0 && (
            <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold">No leads found.</p>
            </div>
          )}
        </div>
      )}

      {/* Lead Detail Panel */}
      {isPanelOpen && selectedLead && (
        <>
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px] z-[60]" onClick={() => setIsPanelOpen(false)} />
          <aside className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)] z-[70] flex flex-col animate-in slide-in-from-right duration-300">
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

            {/* Context */}
            <div className="p-4 border-b border-slate-50">
              <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">AI Context</span>
                </div>
                <p className="text-sm text-indigo-900/70">{selectedLead.context?.notes || 'No notes yet.'}</p>
                
                {/* Extracted Details */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-indigo-100/50">
                  {selectedLead.context?.website && (
                    <div className="text-[10px]">
                      <span className="font-bold text-indigo-900/50 block mb-0.5 uppercase tracking-widest">Website</span>
                      <a href={selectedLead.context.website.startsWith('http') ? selectedLead.context.website : `https://${selectedLead.context.website}`} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline truncate block">
                        {selectedLead.context.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                      </a>
                    </div>
                  )}
                  {selectedLead.context?.location && (
                    <div className="text-[10px]">
                      <span className="font-bold text-indigo-900/50 block mb-0.5 uppercase tracking-widest">Location</span>
                      <span className="text-indigo-900/80 font-semibold">{selectedLead.context.location}</span>
                    </div>
                  )}
                  {selectedLead.context?.instagram && (
                    <div className="text-[10px]">
                      <span className="font-bold text-indigo-900/50 block mb-0.5 uppercase tracking-widest">Instagram</span>
                      <a href={selectedLead.context.instagram} target="_blank" rel="noreferrer" className="text-pink-600 font-bold hover:underline truncate block">View Profile</a>
                    </div>
                  )}
                  {selectedLead.context?.whatsapp && (
                    <div className="text-[10px]">
                      <span className="font-bold text-indigo-900/50 block mb-0.5 uppercase tracking-widest">WhatsApp</span>
                      <span className="text-emerald-600 font-bold">{selectedLead.context.whatsapp}</span>
                    </div>
                  )}
                  {selectedLead.context?.category && (
                    <div className="text-[10px]">
                      <span className="font-bold text-indigo-900/50 block mb-0.5 uppercase tracking-widest">Category</span>
                      <span className="text-indigo-900/80 font-semibold">{selectedLead.context.category}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Unified Inbox / AI Messaging */}
            <div className="flex-1 overflow-hidden">
              <UnifiedInbox leadId={selectedLead.id} />
            </div>
          </aside>
        </>
      )}

      <AddLeadModal 
        isOpen={isAddModalOpen || isEditModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setEditingLead(null); }} 
        onLeadAdded={(newLead) => {
          if (editingLead) {
            setLeads(leads.map(l => l.id === newLead.id ? newLead : l));
          } else {
            setLeads([newLead, ...leads]);
          }
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}
        stages={stages.list || []}
        editLead={editingLead}
      />
    </div>
  );
};

export default LeadManagement;
