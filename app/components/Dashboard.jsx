"use client";

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Target, CheckCircle2, TrendingUp, Zap, Calendar, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: leads } = await supabase.from('leads').select('id, stage_id, created_at, last_contacted_at');
      const { data: jobs } = await supabase.from('automation_jobs').select('id').eq('status', 'pending');
      const { data: stages } = await supabase.from('pipeline_stages').select('id, name');
      const { data: messages } = await supabase.from('messages').select('id, direction, sent_at').order('sent_at', { ascending: false }).limit(100);

      const qualifiedStage = stages?.find(s => s.name === 'Qualified');
      const convertedStage = stages?.find(s => s.name === 'Converted');
      const contactedStage = stages?.find(s => s.name === 'Contacted');

      const total = leads?.length || 0;
      const qualified = leads?.filter(l => l.stage_id === qualifiedStage?.id).length || 0;
      const converted = leads?.filter(l => l.stage_id === convertedStage?.id).length || 0;
      const contacted = leads?.filter(l => l.stage_id === contactedStage?.id).length || 0;
      const outbound = messages?.filter(m => m.direction === 'outbound').length || 0;
      const inbound = messages?.filter(m => m.direction === 'inbound').length || 0;

      setStats({
        totalLeads: total,
        activeFollowups: jobs?.length || 0,
        qualifiedLeads: qualified,
        conversionRate: total > 0 ? `${Math.round((converted / total) * 100)}%` : '0%',
        contacted,
        outbound,
        inbound,
        replyRate: outbound > 0 ? `${Math.round((inbound / outbound) * 100)}%` : '0%',
      });
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 mb-4"></div>
              <div className="h-3 bg-slate-100 rounded w-24 mb-2"></div>
              <div className="h-8 bg-slate-100 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { title: 'Total Pipeline', value: stats.totalLeads, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Active Follow-ups', value: stats.activeFollowups, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
    { title: 'Qualified Leads', value: stats.qualifiedLeads, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { title: 'Conversion Rate', value: stats.conversionRate, icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Business Overview</h1>
          <p className="text-slate-500">Real-time performance metrics from your AI outreach.</p>
        </div>
        <button onClick={fetchStats} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`${card.bg} p-3 rounded-2xl`}>
                <card.icon className={`${card.color} w-6 h-6`} />
              </div>
              <ArrowUpRight className="text-slate-300 w-5 h-5 group-hover:text-slate-400 transition-colors" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{card.title}</p>
            <h2 className="text-3xl font-black text-slate-800 mt-1">{card.value}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Real metrics */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="text-indigo-600 w-5 h-5" /> Messaging Stats
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
              <span className="text-sm font-bold text-slate-600">Outbound Messages</span>
              <span className="text-2xl font-black text-indigo-600">{stats.outbound}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
              <span className="text-sm font-bold text-slate-600">Inbound Replies</span>
              <span className="text-2xl font-black text-emerald-600">{stats.inbound}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
              <span className="text-sm font-bold text-slate-600">Reply Rate</span>
              <span className="text-2xl font-black text-purple-600">{stats.replyRate}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
              <span className="text-sm font-bold text-slate-600">Contacted Leads</span>
              <span className="text-2xl font-black text-amber-600">{stats.contacted}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
          <Zap className="absolute -right-10 -top-10 w-64 h-64 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
            <Zap className="text-indigo-400 w-5 h-5 fill-indigo-400" /> System Status
          </h3>
          <div className="space-y-4 relative z-10">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex justify-between items-center">
              <span className="text-sm text-slate-300">AI Engine</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">Active</span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex justify-between items-center">
              <span className="text-sm text-slate-300">Real-time Sync</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">Connected</span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex justify-between items-center">
              <span className="text-sm text-slate-300">Pipeline Leads</span>
              <span className="text-lg font-black text-white">{stats.totalLeads}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
