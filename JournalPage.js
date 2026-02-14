import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  BookOpen, Plus, TrendingUp, TrendingDown, Trash2, Filter, Brain, Sparkles, 
  Download, X, Calendar, Search, ChevronDown, ChevronUp, BarChart3, Target,
  Trophy, Flame, ArrowUpRight, ArrowDownRight, Percent, DollarSign, Clock, Star
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, PieChart, Pie } from 'recharts';
import CoachingCard from '../components/CoachingCard';
import { toast } from 'sonner';

export default function JournalPage() {
  const { authHeaders, API } = useAuth();
  const [trades, setTrades] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [form, setForm] = useState({ 
    symbol: '', entry_price: '', position_size: '', tp1: '', tp2: '', tp3: '', sl: '', 
    trade_type: 'buy', outcome: '', exit_price: '', pnl: '', notes: '', 
    asset_type: 'forex', timeframe: '1h', direction: 'buy' 
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    asset_type: 'all',
    outcome: 'all',
    direction: 'all',
    symbol: '',
    date_from: '',
    date_to: '',
    min_pnl: '',
    max_pnl: ''
  });
  
  const [requestingCoaching, setRequestingCoaching] = useState(null);
  const [expandedTrade, setExpandedTrade] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { 
    loadTrades(); 
    loadStatistics();
  }, []);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.asset_type !== 'all') params.append('asset_type', filters.asset_type);
    if (filters.outcome !== 'all') params.append('outcome', filters.outcome);
    if (filters.direction !== 'all') params.append('direction', filters.direction);
    if (filters.symbol) params.append('symbol', filters.symbol);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.min_pnl) params.append('min_pnl', filters.min_pnl);
    if (filters.max_pnl) params.append('max_pnl', filters.max_pnl);
    return params.toString();
  }, [filters]);

  const loadTrades = async () => {
    try {
      const query = buildQueryString();
      const url = query ? `${API}/trades?${query}` : `${API}/trades`;
      const res = await axios.get(url, authHeaders());
      setTrades(res.data.trades || []);
    } catch (err) {
      console.error('Failed to load trades:', err);
    }
  };

  const loadStatistics = async () => {
    try {
      const query = buildQueryString();
      const url = query ? `${API}/trades/statistics?${query}` : `${API}/trades/statistics`;
      const res = await axios.get(url, authHeaders());
      setStatistics(res.data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  useEffect(() => {
    loadTrades();
    loadStatistics();
  }, [filters]);

  const addTrade = async () => {
    try {
      const payload = { ...form, direction: form.trade_type };
      ['entry_price', 'position_size', 'tp1', 'tp2', 'tp3', 'sl', 'exit_price', 'pnl'].forEach(k => {
        if (payload[k]) payload[k] = parseFloat(payload[k]);
        else delete payload[k];
      });
      const res = await axios.post(`${API}/trades`, payload, authHeaders());
      
      setShowAdd(false);
      setForm({ 
        symbol: '', entry_price: '', position_size: '', tp1: '', tp2: '', tp3: '', sl: '', 
        trade_type: 'buy', outcome: '', exit_price: '', pnl: '', notes: '', 
        asset_type: 'forex', timeframe: '1h', direction: 'buy' 
      });
      
      if (res.data.ai_coaching) {
        toast.success('AI Coach analyzed your trade!', {
          description: res.data.ai_coaching.summary
        });
      }
      
      loadTrades();
      loadStatistics();
    } catch (err) {
      toast.error('Failed to add trade');
    }
  };

  const requestCoaching = async (tradeId) => {
    setRequestingCoaching(tradeId);
    try {
      await axios.post(`${API}/trades/${tradeId}/request-coaching`, {}, authHeaders());
      toast.success('AI Coach feedback ready!');
      loadTrades();
    } catch {
      toast.error('Failed to get coaching');
    }
    setRequestingCoaching(null);
  };

  const deleteTrade = async (id) => {
    try {
      await axios.delete(`${API}/trades/${id}`, authHeaders());
      loadTrades();
      loadStatistics();
      toast.success('Trade deleted');
    } catch {
      toast.error('Failed to delete trade');
    }
  };

  const exportTrades = async (format) => {
    setExporting(true);
    try {
      const query = buildQueryString();
      const url = `${API}/trades/export?format=${format}${query ? '&' + query : ''}`;
      
      if (format === 'csv') {
        const res = await axios.get(url, { ...authHeaders(), responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `trades_export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        toast.success('Trades exported as CSV');
      } else {
        const res = await axios.get(url, authHeaders());
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `trades_export_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        toast.success('Trades exported as JSON');
      }
    } catch {
      toast.error('Failed to export trades');
    }
    setExporting(false);
  };

  const clearFilters = () => {
    setFilters({
      asset_type: 'all',
      outcome: 'all',
      direction: 'all',
      symbol: '',
      date_from: '',
      date_to: '',
      min_pnl: '',
      max_pnl: ''
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => 
    (k.includes('_type') || k === 'outcome' || k === 'direction') ? v !== 'all' : v !== ''
  );

  const stats = statistics || {};
  const pnlData = trades.filter(t => t.pnl).map((t, i) => ({ name: t.symbol, pnl: t.pnl, idx: i }));

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="journal-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
            <span className="gradient-text">Trade Journal</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Track, analyze, and improve your trading performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`bg-[#0B0E11] border-[#2A2F3A] text-slate-300 hover:text-white ${hasActiveFilters ? 'border-[#00F5A0]/50 text-[#00F5A0]' : ''}`}
            data-testid="toggle-filters-btn"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-[#00F5A0]" />}
          </Button>
          
          {/* Stats Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="bg-[#0B0E11] border-[#2A2F3A] text-slate-300 hover:text-white"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            {showStats ? 'Hide' : 'Show'} Stats
          </Button>
          
          {/* Export */}
          <div className="relative group">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              className="bg-[#0B0E11] border-[#2A2F3A] text-slate-300 hover:text-white"
              data-testid="export-btn"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
            <div className="absolute right-0 top-full mt-1 bg-[#15191E] border border-[#2A2F3A] rounded-lg shadow-xl hidden group-hover:block z-10">
              <button onClick={() => exportTrades('csv')} className="block w-full px-4 py-2 text-sm text-left text-slate-300 hover:bg-[#1E2329] hover:text-white">
                Export as CSV
              </button>
              <button onClick={() => exportTrades('json')} className="block w-full px-4 py-2 text-sm text-left text-slate-300 hover:bg-[#1E2329] hover:text-white">
                Export as JSON
              </button>
            </div>
          </div>
          
          {/* Add Trade */}
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button data-testid="add-trade-btn" className="bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold shadow-[0_0_15px_rgba(0,245,160,0.3)]">
                <Plus className="w-4 h-4 mr-1" /> Log Trade
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#15191E] border-[#2A2F3A] text-white max-w-lg max-h-[90vh] overflow-y-auto glass-modal">
              <DialogHeader><DialogTitle className="text-xl font-bold">Log New Trade</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-slate-400">Symbol</Label>
                    <Input data-testid="trade-symbol" value={form.symbol} onChange={e => setForm({...form, symbol: e.target.value.toUpperCase()})} placeholder="EURUSD" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                  <div><Label className="text-xs text-slate-400">Asset Type</Label>
                    <select value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value})} className="w-full h-10 mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-sm px-3">
                      <option value="forex">Forex</option><option value="crypto">Crypto</option><option value="metals">Metals</option><option value="indices">Indices</option>
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-slate-400">Entry Price</Label>
                    <Input data-testid="trade-entry" value={form.entry_price} onChange={e => setForm({...form, entry_price: e.target.value})} type="number" step="any" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                  <div><Label className="text-xs text-slate-400">Position Size</Label>
                    <Input value={form.position_size} onChange={e => setForm({...form, position_size: e.target.value})} type="number" step="any" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-slate-400">Type</Label>
                    <div className="flex gap-2 mt-1">
                      {['buy', 'sell'].map(t => (
                        <button key={t} onClick={() => setForm({...form, trade_type: t})}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium ${form.trade_type === t ? (t === 'buy' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30') : 'bg-[#1E2329] text-slate-400 border border-[#2A2F3A]'}`}>
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div></div>
                  <div><Label className="text-xs text-slate-400">Timeframe</Label>
                    <select value={form.timeframe} onChange={e => setForm({...form, timeframe: e.target.value})} className="w-full h-10 mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-sm px-3">
                      {['1m','5m','15m','1h','4h','1d','1w'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs text-slate-400">TP1</Label><Input value={form.tp1} onChange={e => setForm({...form, tp1: e.target.value})} type="number" step="any" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                  <div><Label className="text-xs text-slate-400">TP2</Label><Input value={form.tp2} onChange={e => setForm({...form, tp2: e.target.value})} type="number" step="any" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                  <div><Label className="text-xs text-slate-400">SL</Label><Input value={form.sl} onChange={e => setForm({...form, sl: e.target.value})} type="number" step="any" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs text-slate-400">Outcome</Label>
                    <select value={form.outcome} onChange={e => setForm({...form, outcome: e.target.value})} className="w-full h-10 mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-sm px-3">
                      <option value="">Open</option><option value="tp_hit">TP Hit</option><option value="sl_hit">SL Hit</option><option value="partial">Partial</option><option value="breakeven">Breakeven</option>
                    </select></div>
                  <div><Label className="text-xs text-slate-400">Exit Price</Label><Input value={form.exit_price} onChange={e => setForm({...form, exit_price: e.target.value})} type="number" step="any" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                  <div><Label className="text-xs text-slate-400">P&L ($)</Label><Input data-testid="trade-pnl" value={form.pnl} onChange={e => setForm({...form, pnl: e.target.value})} type="number" step="any" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
                </div>
                <div><Label className="text-xs text-slate-400">Notes</Label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-sm p-3 resize-none focus:border-[#00F5A0] focus:outline-none" placeholder="Trade reflections..." /></div>
                <Button data-testid="submit-trade-btn" onClick={addTrade} className="w-full bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold">Save Trade</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass-card rounded-xl p-4 animate-fade-in" data-testid="filters-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter Trades
            </h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-[#00F5A0] hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div>
              <Label className="text-xs text-slate-500">Asset Type</Label>
              <select value={filters.asset_type} onChange={e => setFilters({...filters, asset_type: e.target.value})}
                className="w-full h-9 mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-xs px-2">
                <option value="all">All</option>
                <option value="forex">Forex</option>
                <option value="crypto">Crypto</option>
                <option value="metals">Metals</option>
                <option value="indices">Indices</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Outcome</Label>
              <select value={filters.outcome} onChange={e => setFilters({...filters, outcome: e.target.value})}
                className="w-full h-9 mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-xs px-2">
                <option value="all">All</option>
                <option value="tp_hit">TP Hit</option>
                <option value="sl_hit">SL Hit</option>
                <option value="partial">Partial</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Direction</Label>
              <select value={filters.direction} onChange={e => setFilters({...filters, direction: e.target.value})}
                className="w-full h-9 mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-xs px-2">
                <option value="all">All</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Symbol</Label>
              <Input value={filters.symbol} onChange={e => setFilters({...filters, symbol: e.target.value})}
                placeholder="EURUSD" className="h-9 mt-1 bg-[#0B0E11] border-[#2A2F3A] text-white text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">From Date</Label>
              <Input type="date" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})}
                className="h-9 mt-1 bg-[#0B0E11] border-[#2A2F3A] text-white text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">To Date</Label>
              <Input type="date" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})}
                className="h-9 mt-1 bg-[#0B0E11] border-[#2A2F3A] text-white text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Min P&L</Label>
              <Input type="number" value={filters.min_pnl} onChange={e => setFilters({...filters, min_pnl: e.target.value})}
                placeholder="-100" className="h-9 mt-1 bg-[#0B0E11] border-[#2A2F3A] text-white text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Max P&L</Label>
              <Input type="number" value={filters.max_pnl} onChange={e => setFilters({...filters, max_pnl: e.target.value})}
                placeholder="500" className="h-9 mt-1 bg-[#0B0E11] border-[#2A2F3A] text-white text-xs" />
            </div>
          </div>
        </div>
      )}

      {/* Advanced Statistics */}
      {showStats && statistics && (
        <div className="space-y-4 animate-fade-in" data-testid="statistics-panel">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-slate-500" />
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total P&L</p>
              </div>
              <p className={`text-2xl font-bold font-mono ${stats.total_pnl >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                {stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-slate-500" />
                <p className="text-xs text-slate-500 uppercase tracking-wider">Win Rate</p>
              </div>
              <p className={`text-2xl font-bold font-mono ${stats.win_rate >= 50 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                {stats.win_rate?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <p className="text-xs text-slate-500 uppercase tracking-wider">Profit Factor</p>
              </div>
              <p className={`text-2xl font-bold font-mono ${stats.profit_factor >= 1 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                {stats.profit_factor?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                <p className="text-xs text-slate-500 uppercase tracking-wider">Expectancy</p>
              </div>
              <p className={`text-2xl font-bold font-mono ${stats.expectancy >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                ${stats.expectancy?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <p className="text-xs text-slate-500 uppercase tracking-wider">Avg R:R</p>
              </div>
              <p className="text-2xl font-bold font-mono text-[#00D9F5]">
                1:{stats.avg_rr?.toFixed(1) || '0.0'}
              </p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-slate-500" />
                <p className="text-xs text-slate-500 uppercase tracking-wider">Current Streak</p>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold font-mono ${stats.current_streak_type === 'win' ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                  {stats.current_streak || 0}
                </p>
                {stats.current_streak_type && (
                  <span className={`text-xs px-2 py-0.5 rounded ${stats.current_streak_type === 'win' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {stats.current_streak_type}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Win/Loss Stats */}
            <div className="glass-card rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Performance Breakdown</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Total Trades</span>
                  <span className="text-sm font-bold text-white">{stats.total_trades || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Closed / Open</span>
                  <span className="text-sm font-bold text-white">{stats.closed_trades || 0} / {stats.open_trades || 0}</span>
                </div>
                <div className="h-px bg-[#2A2F3A]" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-green-400 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Avg Win</span>
                  <span className="text-sm font-bold text-green-400">${stats.avg_win?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-red-400 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> Avg Loss</span>
                  <span className="text-sm font-bold text-red-400">${stats.avg_loss?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="h-px bg-[#2A2F3A]" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Largest Win</span>
                  <span className="text-sm font-bold text-green-400">${stats.largest_win?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Largest Loss</span>
                  <span className="text-sm font-bold text-red-400">${stats.largest_loss?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="h-px bg-[#2A2F3A]" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Best Win Streak</span>
                  <span className="text-sm font-bold text-[#00F5A0]">{stats.win_streak || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Worst Loss Streak</span>
                  <span className="text-sm font-bold text-red-400">{stats.loss_streak || 0}</span>
                </div>
              </div>
            </div>

            {/* Performance by Asset */}
            <div className="glass-card rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">By Asset Class</h4>
              {stats.by_asset && Object.keys(stats.by_asset).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.by_asset).map(([asset, data]) => (
                    <div key={asset} className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-white uppercase">{asset}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${data.win_rate >= 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {data.win_rate}% WR
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">{data.trades} trades</span>
                        <span className={data.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {stats.best_asset && (
                    <div className="pt-2 border-t border-[#2A2F3A] flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-[#FFD60A]" />
                      <span className="text-xs text-slate-400">Best: <span className="text-[#FFD60A] font-bold uppercase">{stats.best_asset}</span></span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No data yet</p>
              )}
            </div>

            {/* Performance by Direction */}
            <div className="glass-card rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">By Direction</h4>
              {stats.by_direction && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> LONG / BUY
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${stats.by_direction.buy?.win_rate >= 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {stats.by_direction.buy?.win_rate || 0}% WR
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{stats.by_direction.buy?.trades || 0} trades</span>
                      <span className={stats.by_direction.buy?.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {stats.by_direction.buy?.pnl >= 0 ? '+' : ''}${(stats.by_direction.buy?.pnl || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" /> SHORT / SELL
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${stats.by_direction.sell?.win_rate >= 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {stats.by_direction.sell?.win_rate || 0}% WR
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{stats.by_direction.sell?.trades || 0} trades</span>
                      <span className={stats.by_direction.sell?.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {stats.by_direction.sell?.pnl >= 0 ? '+' : ''}${(stats.by_direction.sell?.pnl || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Best Timeframe */}
              {stats.best_timeframe && (
                <div className="mt-4 pt-3 border-t border-[#2A2F3A]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#00D9F5]" />
                    <span className="text-xs text-slate-400">Best TF: <span className="text-[#00D9F5] font-bold">{stats.best_timeframe}</span></span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Monthly P&L Chart */}
          {stats.monthly_pnl && stats.monthly_pnl.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Monthly Performance</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.monthly_pnl}>
                  <CartesianGrid stroke="#2A2F3A" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#15191E', borderColor: '#2A2F3A', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {stats.monthly_pnl.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#00F5A0' : '#FF3B30'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* P&L Chart */}
      {pnlData.length > 0 && (
        <div className="glass-card rounded-xl p-4" data-testid="pnl-chart">
          <h3 className="text-lg font-bold tracking-tight mb-4">P&L by Trade</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pnlData}>
              <CartesianGrid stroke="#2A2F3A" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#15191E', borderColor: '#2A2F3A', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {pnlData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#00F5A0' : '#FF3B30'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trade List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">Trade History</h3>
          <span className="text-xs text-slate-500">{trades.length} trades</span>
        </div>
        
        {trades.length > 0 ? trades.map((t, i) => (
          <div key={t.id || i} className="glass-card rounded-xl p-4 space-y-3" data-testid={`trade-${i}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.trade_type === 'buy' || t.direction === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {t.trade_type === 'buy' || t.direction === 'buy' ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold">{t.symbol}</h3>
                    <span className="text-xs text-slate-500 bg-[#1E2329] px-1.5 py-0.5 rounded">{(t.trade_type || t.direction)?.toUpperCase()}</span>
                    <span className="text-xs text-slate-500 bg-[#1E2329] px-1.5 py-0.5 rounded">{t.asset_type}</span>
                    {t.outcome && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.outcome.includes('tp') ? 'bg-green-500/10 text-green-400' : t.outcome.includes('sl') ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{t.outcome}</span>}
                    {t.ai_coaching && (
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-[#00F5A0]/10 text-[#00F5A0] flex items-center gap-1">
                        <Brain className="w-3 h-3" /> {t.ai_coaching.overall_grade}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">Entry: {t.entry_price} · Size: {t.position_size} · {t.timeframe}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  {t.pnl !== null && t.pnl !== undefined && (
                    <p className={`text-lg font-bold font-mono ${t.pnl >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">{t.created_at?.slice(0, 10)}</p>
                </div>
                {t.outcome && !t.ai_coaching && (
                  <Button
                    size="sm"
                    onClick={() => requestCoaching(t.id)}
                    disabled={requestingCoaching === t.id}
                    className="bg-[#00F5A0]/10 text-[#00F5A0] hover:bg-[#00F5A0]/20 border border-[#00F5A0]/20"
                    data-testid={`coaching-btn-${i}`}
                  >
                    {requestingCoaching === t.id ? <Sparkles className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                  </Button>
                )}
                <button onClick={() => deleteTrade(t.id)} className="text-slate-600 hover:text-red-400 transition-colors" data-testid={`delete-trade-${i}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {t.notes && <p className="text-xs text-slate-400 pl-13 italic">{t.notes}</p>}
            
            {/* AI Coaching */}
            {t.ai_coaching && (
              <div className="pt-2 border-t border-[#2A2F3A]">
                <CoachingCard coaching={t.ai_coaching} />
              </div>
            )}
          </div>
        )) : (
          <div className="glass-card rounded-xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-400">No Trades Found</h3>
            <p className="text-sm text-slate-500 mt-1">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Start logging your trades to track performance'}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" size="sm" className="mt-4 bg-[#0B0E11] border-[#2A2F3A] text-slate-300">
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
