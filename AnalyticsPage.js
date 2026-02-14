import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { BarChart2, TrendingUp, TrendingDown, Target, DollarSign, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const COLORS = ['#00F5A0', '#00D9F5', '#FFD60A', '#FF3B30', '#A78BFA'];

export default function AnalyticsPage() {
  const { authHeaders, API } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/analytics`, authHeaders())
      .then(res => setData(res.data))
      .catch(() => {});
  }, []);

  if (!data) return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="animate-pulse text-slate-500">Loading analytics...</div>
    </div>
  );

  const assetData = Object.entries(data.by_asset || {}).map(([key, val]) => ({
    name: key, trades: val.trades, pnl: val.pnl, wins: val.wins, winRate: val.trades > 0 ? (val.wins / val.trades * 100).toFixed(1) : 0
  }));

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="analytics-page">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
          <span className="gradient-text">Analytics</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Comprehensive performance breakdown</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total P&L', value: `$${data.total_pnl?.toFixed(2)}`, color: data.total_pnl >= 0 ? '#00F5A0' : '#FF3B30', icon: DollarSign },
          { label: 'Win Rate', value: `${data.win_rate?.toFixed(1)}%`, color: '#00D9F5', icon: Target },
          { label: 'Total Trades', value: data.total_trades, color: '#FFD60A', icon: BarChart2 },
          { label: 'Avg Win', value: `$${data.avg_win?.toFixed(2)}`, color: '#00F5A0', icon: TrendingUp },
          { label: 'Avg Loss', value: `$${data.avg_loss?.toFixed(2)}`, color: '#FF3B30', icon: TrendingDown },
          { label: 'Max Drawdown', value: `$${data.max_drawdown?.toFixed(2)}`, color: '#FF3B30', icon: Activity },
        ].map((m, i) => (
          <div key={i} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">{m.label}</p>
              <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
            </div>
            <p className="text-xl font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equity Curve */}
        <div className="glass-card rounded-xl p-4" data-testid="equity-curve">
          <h3 className="text-lg font-bold tracking-tight mb-4">Equity Curve</h3>
          {data.equity_curve?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.equity_curve}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00F5A0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2A2F3A" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#15191E', borderColor: '#2A2F3A', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="equity" stroke="#00F5A0" fill="url(#eqGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-slate-500">No data yet</div>}
        </div>

        {/* Asset Distribution */}
        <div className="glass-card rounded-xl p-4" data-testid="asset-distribution">
          <h3 className="text-lg font-bold tracking-tight mb-4">By Asset Type</h3>
          {assetData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={assetData} dataKey="trades" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {assetData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#15191E', borderColor: '#2A2F3A', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {assetData.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <div>
                      <p className="text-sm font-medium capitalize">{a.name}</p>
                      <p className="text-xs text-slate-500">{a.trades} trades · {a.winRate}% win</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-[200px] flex items-center justify-center text-slate-500">No data yet</div>}
        </div>
      </div>

      {/* Profit Factor + Win/Loss */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-lg font-bold tracking-tight mb-4">Win/Loss Ratio</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#00F5A0]">Wins: {data.wins}</span>
                <span className="text-sm text-red-400">Losses: {data.losses}</span>
              </div>
              <div className="h-4 rounded-full bg-[#1E2329] overflow-hidden flex">
                <div className="h-full bg-[#00F5A0]" style={{ width: `${data.total_trades > 0 ? (data.wins / data.total_trades * 100) : 50}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${data.total_trades > 0 ? (data.losses / data.total_trades * 100) : 50}%` }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold font-mono text-white">{data.profit_factor?.toFixed(2)}</p>
              <p className="text-xs text-slate-500">Profit Factor</p>
            </div>
          </div>
        </div>

        {/* Recent Trades Table */}
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-lg font-bold tracking-tight mb-4">Recent Closed Trades</h3>
          <div className="space-y-1">
            {data.recent_trades?.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#2A2F3A] last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${(t.pnl || 0) >= 0 ? 'bg-[#00F5A0]' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium">{t.symbol}</span>
                  <span className="text-xs text-slate-500">{t.trade_type}</span>
                </div>
                <span className={`text-sm font-mono font-bold ${(t.pnl || 0) >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                  {(t.pnl || 0) >= 0 ? '+' : ''}{(t.pnl || 0).toFixed(2)}
                </span>
              </div>
            ))}
            {(!data.recent_trades || data.recent_trades.length === 0) && (
              <p className="text-sm text-slate-500 text-center py-4">No closed trades</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
