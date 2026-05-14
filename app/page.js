"use client";

import React, { useState, useEffect } from 'react';
import KanbanBoard from './components/KanbanBoard';
import LeadManagement from './components/LeadManagement';
import AutomationHub from './components/AutomationHub';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import GlobalInbox from './components/GlobalInbox';
import { supabase } from '@/lib/supabase';
import { 
  Zap, 
  User, 
  Settings as SettingsIcon, 
  Layout, 
  BarChart3, 
  Users, 
  LogOut,
  Menu,
  MessageSquare
} from 'lucide-react';

export default function Home() {
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Auth />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Analytics', icon: BarChart3 },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'pipeline', label: 'Pipeline', icon: Layout },
    { id: 'inbox', label: 'Inbox', icon: MessageSquare },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-[#fafbfc] font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-[#0a0a0c] transition-all duration-300 flex flex-col shrink-0 relative z-20 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-24 flex items-center px-8 gap-4 border-b border-white/5">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-600/20 shrink-0">
            <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          {sidebarOpen && (
            <div className="flex flex-col">
              <span className="font-black text-xl text-white tracking-tighter italic leading-none">AdsScaleEngine</span>
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">by StartupSphere</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-8 flex flex-col gap-2 px-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                currentView === item.id 
                  ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' 
                  : 'hover:bg-white/5'
              }`}
              title={!sidebarOpen ? item.label : ''}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              {sidebarOpen && (
                <span className={`font-bold text-sm tracking-wide ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button onClick={() => supabase.auth.signOut()} 
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/5 transition-colors group">
            <LogOut className="w-5 h-5 text-rose-500 shrink-0" />
            {sidebarOpen && <span className="font-bold text-sm text-rose-500 group-hover:text-rose-400">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#fafbfc]">
        <header className="h-24 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0 relative z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <Menu className="w-5 h-5 text-slate-400" />
            </button>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">
              {currentView}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold text-slate-800">{session.user.email.split('@')[0]}</div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Enterprise Plan</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
              <User className="w-5 h-5" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'leads' && <LeadManagement />}
            {currentView === 'pipeline' && <KanbanBoard />}
            {currentView === 'inbox' && <GlobalInbox />}
            {currentView === 'automation' && <AutomationHub />}
            {currentView === 'settings' && <Settings />}
          </div>
        </div>
      </main>
    </div>
  );
}
