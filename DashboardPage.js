import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { TrendingUp, TrendingDown, Brain, Target, Flame, Zap, BarChart2, Radio, BookOpen, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DashboardPage() {
  const { user, authHeaders, API, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [recentSignals, setRecentSignals] = useState([]);
  const [challenges, setChallenges] = useState(null);

  useEffect(() => {
    refreshUser();
    const load = async () => {
      try {
        const [analyticsRes, tradesRes, signalsRes, challengesRes] = await Promise.all([
          axios.get(`${API}/analytics`, authHeaders()).catch(() => ({ data: {} })),
          axios.get(`${API}/trades`, authHeaders()).catch(() => ({ data: { trades: [] } })),
          axios.get(`${API}/signals`, authHeaders()).catch(() => ({ data: { signals: [] } })),
          axios.get(`${API}/challenges`, authHeaders()).catch(() => ({ data: { daily: [], weekly: [] } })),
        ]);
        setStats(analyticsRes.data);
        setRecentTrades(tradesRes.data.trades?.slice(0, 5) || []);
        setRecentSignals(signalsRes.data.signals?.slice(0, 3) || []);
        setChallenges(challengesRes.data);
      } catch {}
    };
    load();
  }, []);

  const streakFire = user?.streak > 0;
  const xpProgress = user?.xp ? (user.xp % 500) / 500 * 100 : 0;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tighter uppercase">
            Welcome back, <span className="gradient-text">{user?.username}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Your trading command center</p>
        </div>
        <div className="flex items-center gap-3">
          {streakFire && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 animate-pulse-glow" style={{ '--tw-shadow-color': 'rgba(249,115,22,0.3)' }}>
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-orange-400" data-testid="streak-count">{user?.streak} day streak</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00F5A0]/10 border border-[#00F5A0]/30">
            <Zap className="w-4 h-4 text-[#00F5A0]" />
            <span className="text-sm font-bold text-[#00F5A0]">Lv.{user?.level || 1}</span>
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Experience</span>
          <span className="text-xs text-slate-500 font-mono">{user?.xp || 0} XP</span>
        </div>
        <div className="h-2 rounded-full bg-[#1E2329] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${xpProgress}%`, background: 'linear-gradient(90deg, #00F5A0, #00D9F5)' }} />
        </div>
        <p className="text-xs text-slate-500 mt-1">{500 - (user?.xp || 0) % 500} XP to next level</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Total P&L', value: `$${stats?.total_pnl?.toFixed(2) || '0.00'}`, icon: TrendingUp, color: (stats?.total_pnl || 0) >= 0 ? '#00F5A0' : '#FF3B30' },
          { label: 'Win Rate', value: `${stats?.win_rate?.toFixed(1) || '0'}%`, icon: Target, color: '#00D9F5' },
          { label: 'Total Trades', value: stats?.total_trades || 0, icon: BarChart2, color: '#FFD60A' },
          { label: 'Profit Factor', value: stats?.profit_factor?.toFixed(2) || '0.00', icon: Brain, color: '#A78BFA' },
        ].map((s, i) => (
          <div key={i} className={`glass-card rounded-xl p-4 hover-lift stagger-${i + 1} opacity-0 animate-fade-in`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{s.label}</span>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Equity Chart + Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity Chart */}
        <div className="lg:col-span-2 glass-card rounded-xl p-4" data-testid="equity-chart">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold tracking-tight">Equity Curve</h3>
            <span className="text-xs text-slate-500 font-mono">All time</span>
          </div>
          {stats?.equity_curve?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.equity_curve}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00F5A0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2A2F3A" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#15191E', borderColor: '#2A2F3A', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="equity" stroke="#00F5A0" fill="url(#equityGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
              Start trading to see your equity curve
            </div>
          )}
        </div>

        {/* Recent Signals */}
        <div className="glass-card rounded-xl p-4" data-testid="recent-signals">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold tracking-tight">Latest Signals</h3>
            <button onClick={() => navigate('/signals')} className="text-xs text-[#00F5A0] hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {recentSignals.length > 0 ? recentSignals.map((sig, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                <div>
                  <p className="text-sm font-medium">{sig.symbol}</p>
                  <p className="text-xs text-slate-500">{sig.asset_type}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${sig.action === 'BUY' ? 'bg-green-500/10 text-green-400' : sig.action === 'SELL' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    {sig.action}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">{sig.confidence}% conf</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500 text-center py-4">Generate signals to see them here</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Trades + Challenges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Trades */}
        <div className="glass-card rounded-xl p-4" data-testid="recent-trades">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold tracking-tight">Recent Trades</h3>
            <button onClick={() => navigate('/journal')} className="text-xs text-[#00F5A0] hover:underline flex items-center gap-1">
              Journal <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {recentTrades.length > 0 ? recentTrades.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                <div className="flex items-center gap-3">
                  {(t.pnl || 0) >= 0 ? <TrendingUp className="w-4 h-4 text-[#00F5A0]" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                  <div>
                    <p className="text-sm font-medium">{t.symbol}</p>
                    <p className="text-xs text-slate-500">{t.trade_type?.toUpperCase()} · {t.timeframe}</p>
                  </div>
                </div>
                <span className={`text-sm font-mono font-bold ${(t.pnl || 0) >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                  {(t.pnl || 0) >= 0 ? '+' : ''}{(t.pnl || 0).toFixed(2)}
                </span>
              </div>
            )) : (
              <p className="text-sm text-slate-500 text-center py-4">No trades logged yet</p>
            )}
          </div>
        </div>

        {/* Daily Challenges */}
        <div className="glass-card rounded-xl p-4" data-testid="daily-challenges">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold tracking-tight">Daily Challenges</h3>
            <button onClick={() => navigate('/challenges')} className="text-xs text-[#00F5A0] hover:underline flex items-center gap-1">
              All challenges <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {challenges?.daily?.slice(0, 4).map((c, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${c.completed ? 'bg-[#00F5A0]/5 border-[#00F5A0]/20' : 'bg-[#0B0E11] border-[#2A2F3A]'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${c.completed ? 'bg-[#00F5A0] text-black' : 'bg-[#1E2329] text-slate-500'}`}>
                    {c.completed ? '✓' : i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-slate-500">{c.description}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#00F5A0]">+{c.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
