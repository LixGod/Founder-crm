"use client";

import React, { useState } from 'react';
import { Search, Globe, Plus, Loader2, Zap, Phone, Mail, Linkedin, Instagram, FileText, X, Info, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const LeadScraper = ({ onLeadsFound, stages }) => {
  const [url, setUrl] = useState('');
  const [manualText, setManualText] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [deepSearch, setDeepSearch] = useState(false);
  const [mode, setMode] = useState('url');
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(10);
  const [logs, setLogs] = useState([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  const handleDiscover = async (e) => {
    e.preventDefault();
    if (!niche || !location) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/scrape/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ niche, location, deepSearch, limit })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      
      if (data.tip) {
        alert(data.tip);
      } else {
        setResults(data.leads || []);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunPipeline = async (e) => {
    e.preventDefault();
    if (!niche || !location) return;
    
    setLoading(true);
    setLogs([]);
    setResults([]);
    setPipelineComplete(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/leadgen/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ niche, city: location, limit, syncCrm: false })
      });

      if (!response.ok) throw new Error('Failed to start pipeline');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              
              if (data.type === 'log' || data.type === 'start' || data.type === 'warn') {
                setLogs(prev => [...prev, { type: data.type, message: data.message }]);
              } else if (data.type === 'error') {
                setLogs(prev => [...prev, { type: 'error', message: data.message }]);
                throw new Error(data.message);
              } else if (data.type === 'done') {
                setLogs(prev => [...prev, { type: 'success', message: data.message }]);
                setResults(data.leads || []);
                setPipelineComplete(true);
              }
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
          }
        }
      }
    } catch (error) {
      setLogs(prev => [...prev, { type: 'error', message: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    if (mode === 'pipeline') return handleRunPipeline(e);
    if (mode === 'maps') return handleDiscover(e);
    if (!url && !manualText) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(isManual ? { text: manualText, deepSearch } : { url, deepSearch })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to process');
      }

      const data = await response.json();
      setResults(data.leads || []);
    } catch (error) {
      alert('Extraction Tip: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const importLead = async (lead) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const domain = url ? url.replace('https://', '').replace('http://', '').split('/')[0] : 'Manual Scrape';

      // Get the first available stage ID
      let stageId = stages[0]?.id;
      if (!stageId) {
        const { data: defaultStages } = await supabase.from('pipeline_stages').select('id').order('order_index').limit(1);
        stageId = defaultStages?.[0]?.id;
      }

      if (!stageId) throw new Error("No pipeline stages found. Please add a stage in settings or run the seed script.");

      const { data, error } = await supabase
        .from('leads')
        .insert([{
          name: lead.owner_name || lead.name || 'Unknown Contact',
          email: lead.email,
          phone: lead.phone,
          linkedin_url: lead.linkedin,
          company: lead.company || lead.name || (url ? domain.split('.')[0].toUpperCase() : 'NEW COMPANY'),
          stage_id: stageId,
          user_id: user.id,
          source_channel: 'ai_scraper',
          context: { 
            notes: `Extracted via AI. Role: ${lead.role || 'Not specified'}`,
            website: lead.website,
            location: lead.location || lead.address,
            instagram: lead.instagram,
            whatsapp: lead.whatsapp,
            category: lead.category,
            maps_url: lead.maps_url,
            original_data: lead
          }
        }])
        .select();

      if (error) throw error;
      setResults(prev => prev.filter(r => r.email !== lead.email || r.phone !== lead.phone || r.name !== lead.name));
      onLeadsFound(data[0]);
    } catch (error) {
      alert('Error importing: ' + error.message);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Zap className="text-white w-5 h-5 fill-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">AI Deep Lead Extractor</h2>
            <p className="text-xs text-slate-500">Extract high-intent business leads instantly.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-1 py-1 rounded-xl border border-indigo-100">
          <button onClick={() => { setIsManual(false); setMode('url'); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isManual && mode === 'url' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            URL Scrape
          </button>
          <button onClick={() => { setIsManual(true); setMode('text'); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isManual && mode === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Paste Text
          </button>
          <button onClick={() => { setIsManual(true); setMode('maps'); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isManual && mode === 'maps' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Maps Search
          </button>
          <button onClick={() => { setIsManual(false); setMode('pipeline'); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isManual && mode === 'pipeline' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
            Full Pipeline
          </button>
        </div>
      </div>

      <div className="p-6 pb-0">
        {mode === 'maps' && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
            <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Info className="w-3 h-3" /> {mode === 'pipeline' ? 'Full 8-Stage Pipeline' : 'Pro Tip: Batch Extract Leads'}
            </h4>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              {mode === 'pipeline' ? (
                <>This triggers the complete <b>enterprise pipeline</b>: Maps → Scraping → Snov/Hunter → Apollo → ICP Scoring. This may take 1-3 minutes but provides high-quality verified leads.</>
              ) : (
                <>Enter your desired niche and location, and select how many leads you want. The AI will instantly discover the top matching businesses and extract their contact details using its real-time knowledge base.</>
              )}
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleScrape} className="p-6 space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDeepSearch(!deepSearch)}
              className={`w-10 h-5 rounded-full transition-all relative ${deepSearch ? 'bg-indigo-600' : 'bg-slate-200'}`}>
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${deepSearch ? 'left-6' : 'left-1'}`} />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
              <Target className="w-3 h-3" /> Deep Search (Finds Emails & Mobile Numbers)
            </span>
          </div>
        </div>

        {mode === 'maps' || mode === 'pipeline' ? (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
                placeholder="Business Niche (e.g. Dental Clinics)"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
            </div>
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="City (e.g. Mumbai)"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
            </div>
            <div className="w-full md:w-32 relative">
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-600 font-medium">
                <option value={5}>5 Leads</option>
                <option value={10}>10 Leads</option>
                <option value={20}>20 Leads</option>
                <option value={50}>50 Leads</option>
              </select>
            </div>
            <button disabled={loading} type="submit"
              className={`${mode === 'pipeline' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-800 hover:bg-slate-900'} text-white font-bold px-8 py-3 rounded-2xl transition-all flex items-center justify-center gap-2`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{mode === 'pipeline' ? <Zap className="w-4 h-4" /> : <Search className="w-4 h-4" />} {mode === 'pipeline' ? 'Start Pipeline' : 'Find Leads'}</>}
            </button>
          </div>
        ) : !isManual ? (
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste any directory or business URL..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
            </div>
            <button disabled={loading}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-3 rounded-2xl transition-all flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Extract</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste raw text or search results here..."
              rows="6"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none transition-all" />
            <button disabled={loading}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Extract from Text</>}
            </button>
          </div>
        )}
      </form>

      {logs.length > 0 && (
        <div className="mx-6 mb-6 p-4 bg-slate-900 rounded-2xl font-mono text-[10px] text-slate-300 max-h-40 overflow-y-auto shadow-inner border border-slate-800">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
            <span className="text-indigo-400 font-bold uppercase tracking-widest">Pipeline Console</span>
            {loading && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
          </div>
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-amber-400' : log.type === 'success' ? 'text-emerald-400' : ''}`}>
              <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log.message}
            </div>
          ))}
          <div id="logs-end" />
        </div>
      )}

      {results.length > 0 && (
        <div className="p-6 pt-0 border-t border-slate-100 bg-slate-50/30 max-h-[500px] overflow-y-auto">
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((lead, i) => (
              <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                      {lead.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 truncate w-32">{lead.name || 'Unknown Contact'}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lead.company || 'Business'}</p>
                    </div>
                  </div>
                  <button onClick={() => importLead(lead)}
                    className="p-2 bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 text-xs ${lead.email ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                    <Mail className={`w-3.5 h-3.5 ${lead.email ? 'text-indigo-400' : ''}`} /> {lead.email || 'Email not found'}
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${lead.phone ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                    <Phone className={`w-3.5 h-3.5 ${lead.phone ? 'text-emerald-400' : ''}`} /> {lead.phone || 'Phone not found'}
                  </div>
                  {lead.website && (
                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-[10px] text-indigo-500 hover:text-indigo-700 font-bold uppercase tracking-tighter transition-colors">
                      <Globe className="w-3 h-3" /> {lead.website.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]}
                    </a>
                  )}
                  {lead.instagram && (
                    <a href={lead.instagram.startsWith('http') ? lead.instagram : `https://${lead.instagram}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-[10px] text-pink-500 hover:text-pink-700 font-bold uppercase tracking-tighter transition-colors">
                      <Instagram className="w-3 h-3" /> Instagram
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadScraper;
