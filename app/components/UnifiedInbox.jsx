"use client";

import React, { useState, useEffect } from 'react';
import { Mail, Phone, MessageSquare, Loader2, Sparkles, Send, Linkedin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const UnifiedInbox = ({ leadId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    fetchMessages();

    const channel = supabase
      .channel(`lead-messages-${leadId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `lead_id=eq.${leadId}`
      }, (payload) => {
        setMessages(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [leadId]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('sent_at', { ascending: false });
    setMessages(data || []);
    setLoading(false);
  };

  const handleGenerateAI = async (typeOverride = null) => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const type = typeOverride || (messages.length === 0 ? 'outreach' : 'followup');
      
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ leadId, type })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI failed');
      setNewMessage(result.message);
    } catch (error) {
      alert(error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async (channel) => {
    if (!newMessage.trim()) return;
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ leadId, content: newMessage, channel })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send');
      setNewMessage('');
    } catch (error) {
      alert(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" /> Conversation
        </h3>
        <div className="flex gap-2">
          <button onClick={() => handleGenerateAI('linkedin')} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-200 transition-all disabled:opacity-50">
            <Linkedin className="w-3 h-3 fill-blue-600" />
            Connect
          </button>
          <button onClick={() => handleGenerateAI()} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-200 transition-all disabled:opacity-50">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 fill-amber-500" />}
            AI Write
          </button>
          <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-12">No messages yet. Click <b>AI Write</b> to start.</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.direction === 'outbound'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
              }`}>
                <div className="flex items-center gap-1.5 mb-1 opacity-60">
                  {msg.channel === 'whatsapp' ? <Phone className="w-2.5 h-2.5" /> : <Mail className="w-2.5 h-2.5" />}
                  <span className="text-[9px] font-bold uppercase">{msg.channel}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div className="mt-1 text-[9px] opacity-40 text-right">
                  {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 bg-white border-t border-slate-200">
        <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
          placeholder="Type a message..." rows="3"
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none transition-all" />
        <div className="flex gap-2 mt-2">
          <button disabled={sending || !newMessage.trim()} onClick={() => handleSend('email')}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-40">
            <Mail className="w-3 h-3" /> Email
          </button>
          <button disabled={sending || !newMessage.trim()} onClick={() => handleSend('whatsapp')}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-40 shadow-md shadow-emerald-100">
            <Phone className="w-3 h-3" /> WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedInbox;
