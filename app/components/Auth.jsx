"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Zap, 
  Mail, 
  Lock, 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  Globe, 
  Sparkles,
  Rocket
} from 'lucide-react';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-700"></div>
      
      <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-2 bg-white/[0.03] backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden relative z-10">
        
        {/* Left Side: Brand & Social Proof */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-indigo-600 to-indigo-900 relative">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                <Zap className="text-indigo-600 w-6 h-6 fill-indigo-600" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-2xl text-white tracking-tighter italic leading-none">AdsScaleEngine</span>
                <span className="text-xs font-bold text-white/70 uppercase tracking-widest mt-1">by StartupSphere</span>
              </div>
            </div>
            
            <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight mb-6">
              The OS for <br />
              <span className="text-indigo-200">Solo Founders.</span>
            </h1>
            <p className="text-lg text-indigo-100/80 font-medium max-w-sm">
              Automate your outreach, manage your leads, and close deals while you sleep.
            </p>
          </div>

          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-4 text-white/90">
              <div className="bg-white/10 p-2 rounded-xl border border-white/20">
                <Sparkles className="w-5 h-5 text-indigo-300" />
              </div>
              <p className="text-sm font-semibold tracking-wide uppercase">AI-Driven Intent Detection</p>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="bg-white/10 p-2 rounded-xl border border-white/20">
                <Globe className="w-5 h-5 text-indigo-300" />
              </div>
              <p className="text-sm font-semibold tracking-wide uppercase">Multi-Channel Unified Inbox</p>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="bg-white/10 p-2 rounded-xl border border-white/20">
                <Rocket className="w-5 h-5 text-indigo-300" />
              </div>
              <p className="text-sm font-semibold tracking-wide uppercase">Built for 10x Scalability</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="p-10 lg:p-20 flex flex-col justify-center">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-black text-white mb-2">
              {isSignUp ? 'Join the Elite' : 'Welcome Back'}
            </h2>
            <p className="text-slate-400 font-medium">
              {isSignUp ? 'Start your 14-day free trial.' : 'Enter your credentials to continue.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all text-white placeholder:text-slate-600 text-sm"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end ml-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Password</label>
                {!isSignUp && <button type="button" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">Forgot?</button>}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all text-white placeholder:text-slate-600 text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-widest text-sm">{isSignUp ? 'Create My Account' : 'Sign Into Dashboard'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <span className="text-indigo-400">
                {isSignUp ? 'Sign In' : 'Create One'}
              </span>
            </button>
            
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise Grade Security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Badge */}
      <div className="fixed bottom-8 right-8 flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
        Status: Systems Operational
      </div>
    </div>
  );
};

export default Auth;
