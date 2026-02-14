import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { User, Trophy, Flame, Zap, Brain, Target, BookOpen, BarChart2, Shield, Crown, Star, Flag, Eye } from 'lucide-react';

const ICON_MAP = { trophy: Trophy, flame: Flame, zap: Zap, brain: Brain, eye: Eye, dollar: Target, star: Star, crown: Crown, target: Target, flag: Flag, shield: Shield };

export default function ProfilePage() {
  const { user, authHeaders, API } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    axios.get(`${API}/profile`, authHeaders())
      .then(res => setProfile(res.data))
      .catch(() => {});
  }, []);

  if (!profile) return <div className="p-6 text-slate-500">Loading profile...</div>;

  const xpProgress = (profile.xp % 500) / 500 * 100;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="profile-page">
      {/* Profile Header */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #00F5A0, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-extrabold" style={{ background: 'linear-gradient(135deg, #00F5A0, #00D9F5)' }}>
            {profile.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tighter uppercase">{profile.username}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-[#00F5A0] font-bold">{profile.level_title}</span>
              <span className="text-sm text-slate-500">Level {profile.level}</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-sm text-slate-400">{profile.trader_type} trader</span>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">{profile.xp} XP</span>
                <span className="text-xs text-slate-500">{profile.xp_to_next} XP to next level</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#1E2329] overflow-hidden max-w-md">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${xpProgress}%`, background: 'linear-gradient(90deg, #00F5A0, #00D9F5)' }} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile.streak > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 animate-pulse-glow" style={{ '--tw-shadow-color': 'rgba(249,115,22,0.2)' }}>
                <Flame className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-lg font-bold text-orange-400" data-testid="profile-streak">{profile.streak}</p>
                  <p className="text-[10px] text-orange-400/60">day streak</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Trades', value: profile.total_trades, icon: BarChart2, color: '#FFD60A' },
          { label: 'Win Rate', value: `${profile.win_rate?.toFixed(1)}%`, icon: Target, color: '#00D9F5' },
          { label: 'Total P&L', value: `$${profile.total_pnl?.toFixed(2)}`, icon: Zap, color: profile.total_pnl >= 0 ? '#00F5A0' : '#FF3B30' },
          { label: 'Analyses', value: profile.total_analyses, icon: Brain, color: '#A78BFA' },
          { label: 'Lessons', value: profile.lessons_completed, icon: BookOpen, color: '#00F5A0' },
        ].map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-4 hover-lift">
            <div className="flex items-center justify-between mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Streak Milestones */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" /> Streak Milestones
        </h3>
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {[3, 7, 14, 30, 60, 100].map(milestone => {
            const achieved = (profile.best_streak || 0) >= milestone;
            return (
              <div key={milestone} className={`flex-shrink-0 w-20 text-center p-3 rounded-xl border ${achieved ? 'bg-orange-500/10 border-orange-500/30' : 'bg-[#1E2329] border-[#2A2F3A]'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1 ${achieved ? 'bg-orange-500/20' : 'bg-[#0B0E11]'}`}>
                  <Flame className={`w-5 h-5 ${achieved ? 'text-orange-400' : 'text-slate-600'}`} />
                </div>
                <p className={`text-sm font-bold ${achieved ? 'text-orange-400' : 'text-slate-600'}`}>{milestone}</p>
                <p className="text-[9px] text-slate-500">days</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievements */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#FFD60A]" /> Achievements
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {profile.all_achievements?.map((a) => {
            const earned = profile.achievements?.includes(a.id);
            const IconComp = ICON_MAP[a.icon] || Zap;
            return (
              <div key={a.id} className={`rounded-xl p-4 text-center transition-all ${earned ? 'bg-[#FFD60A]/10 border border-[#FFD60A]/30 neon-border' : 'bg-[#1E2329] border border-[#2A2F3A] opacity-50'}`}
                style={earned ? { boxShadow: '0 0 15px rgba(255,214,10,0.15)' } : {}}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${earned ? 'bg-[#FFD60A]/20' : 'bg-[#0B0E11]'}`}>
                  <IconComp className={`w-6 h-6 ${earned ? 'text-[#FFD60A]' : 'text-slate-600'}`} />
                </div>
                <p className="text-xs font-bold">{a.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{a.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account Info */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-lg font-bold tracking-tight mb-4">Account Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
            <p className="text-xs text-slate-500">Email</p>
            <p className="text-sm font-medium">{profile.email}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
            <p className="text-xs text-slate-500">Member Since</p>
            <p className="text-sm font-medium">{profile.created_at?.slice(0, 10)}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
            <p className="text-xs text-slate-500">Best Streak</p>
            <p className="text-sm font-medium">{profile.best_streak || 0} days</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
            <p className="text-xs text-slate-500">Trader Type</p>
            <p className="text-sm font-medium capitalize">{profile.trader_type}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
