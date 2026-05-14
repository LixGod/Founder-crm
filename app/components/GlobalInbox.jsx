"use client";

import React, { useState, useEffect } from 'react';
import { Mail, Phone, MessageSquare, Loader2, Linkedin, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import UnifiedInbox from './UnifiedInbox';

const GlobalInbox = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchGlobalMessages();

    const channel = supabase
      .channel('global-inbox')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages'
      }, () => {
        fetchGlobalMessages();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchGlobalMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, leads(id, name, company)')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Group messages by lead to show conversations
      const conversations = [];
      const leadMap = new Map();

      data.forEach(msg => {
        if (!msg.leads) return;
        if (!leadMap.has(msg.leads.id)) {
          leadMap.set(msg.leads.id, {
            lead: msg.leads,
            latestMessage: msg,
            unreadCount: msg.direction === 'inbound' ? 1 : 0
          });
          conversations.push(leadMap.get(msg.leads.id));
        } else {
          const conv = leadMap.get(msg.leads.id);
          if (msg.direction === 'inbound' && new Date(msg.sent_at) > new Date(conv.latestMessage.sent_at)) {
             conv.unreadCount += 1;
          }
        }
      });

      setMessages(conversations);
      if (conversations.length > 0 && !selectedLeadId) {
        setSelectedLeadId(conversations[0].lead.id);
      }
    } catch (err) {
      console.error('Error fetching global inbox:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = messages.filter(c => 
    c.lead.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.lead.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full bg-white overflow-hidden max-w-7xl mx-auto rounded-3xl shadow-xl border border-slate-100 my-8">
      {/* Sidebar: Conversations List */}
      <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-indigo-600" /> Unified Inbox
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center p-8 text-slate-400 text-sm">No conversations found.</div>
          ) : (
            filteredConversations.map((conv) => (
              <button key={conv.lead.id} onClick={() => setSelectedLeadId(conv.lead.id)}
                className={`w-full text-left p-4 border-b border-slate-100 transition-all hover:bg-white ${selectedLeadId === conv.lead.id ? 'bg-white border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-800 text-sm truncate pr-2">{conv.lead.name}</span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(conv.latestMessage.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-2 truncate font-medium">{conv.lead.company}</div>
                <div className="flex items-center gap-2">
                  {conv.latestMessage.channel === 'whatsapp' ? <Phone className="w-3 h-3 text-emerald-500" /> : 
                   conv.latestMessage.channel === 'linkedin' ? <Linkedin className="w-3 h-3 text-blue-500" /> : 
                   <Mail className="w-3 h-3 text-indigo-400" />}
                  <span className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}`}>
                    {conv.latestMessage.direction === 'outbound' ? 'You: ' : ''}{conv.latestMessage.content}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Unified Inbox Component */}
      <div className="flex-1 bg-white h-full relative">
        {selectedLeadId ? (
          <UnifiedInbox leadId={selectedLeadId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-16 h-16 text-slate-100 mb-4" />
            <h3 className="text-xl font-bold text-slate-300">Select a conversation</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalInbox;
