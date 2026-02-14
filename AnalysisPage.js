import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Brain, TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';

const SYMBOLS = {
  forex: ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X', 'NZDUSD=X', 'USDCHF=X', 'EURGBP=X'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD'],
  metals: ['GC=F', 'SI=F', 'PL=F', 'PA=F'],
};

export default function AnalysisPage() {
  const { authHeaders, API } = useAuth();
  const [symbol, setSymbol] = useState('EURUSD=X');
  const [timeframe, setTimeframe] = useState('1h');
  const [currentPrice, setCurrentPrice] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [assetType, setAssetType] = useState('forex');
  const [traderType, setTraderType] = useState('swing');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    axios.get(`${API}/analysis/history`, authHeaders())
      .then(res => setHistory(res.data.analyses || []))
      .catch(() => {});
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/analysis/run`, {
        symbol, timeframe, current_price: currentPrice ? parseFloat(currentPrice) : null,
        position_size: positionSize ? parseFloat(positionSize) : null,
        asset_type: assetType, trader_type: traderType
      }, authHeaders());
      setResult(res.data.analysis);
      setHistory(prev => [res.data.analysis, ...prev]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const ai = result?.ai_result;
  const ind = result?.indicators;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="analysis-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
            <span className="gradient-text">AI Analysis</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Advanced technical analysis powered by GPT-5.2</p>
        </div>
        <button data-testid="toggle-history" onClick={() => setShowHistory(!showHistory)} className="text-sm text-[#00D9F5] hover:underline flex items-center gap-1">
          History ({history.length}) <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Input Form */}
      <div className="glass-card rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Asset Type</Label>
            <div className="flex rounded-lg overflow-hidden border border-[#2A2F3A]">
              {['forex', 'crypto', 'metals'].map(t => (
                <button key={t} data-testid={`asset-type-${t}`} onClick={() => { setAssetType(t); setSymbol(SYMBOLS[t][0]); }}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${assetType === t ? 'bg-[#00F5A0]/20 text-[#00F5A0]' : 'bg-[#0B0E11] text-slate-400 hover:text-white'}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Symbol</Label>
            <select data-testid="symbol-select" value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full h-10 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-sm px-3 focus:border-[#00F5A0] focus:outline-none">
              {SYMBOLS[assetType].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Timeframe</Label>
            <select data-testid="timeframe-select" value={timeframe} onChange={e => setTimeframe(e.target.value)}
              className="w-full h-10 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-sm px-3 focus:border-[#00F5A0] focus:outline-none">
              {['1m', '5m', '15m', '1h', '4h', '1d', '1w'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Current Price</Label>
            <Input data-testid="current-price" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="Auto-fetch"
              className="bg-[#0B0E11] border-[#2A2F3A] text-white placeholder-slate-600 focus:border-[#00F5A0]" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Position Size</Label>
            <Input data-testid="position-size" value={positionSize} onChange={e => setPositionSize(e.target.value)} placeholder="Optional"
              className="bg-[#0B0E11] border-[#2A2F3A] text-white placeholder-slate-600 focus:border-[#00F5A0]" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs uppercase tracking-wider">Type</Label>
            <div className="flex rounded-lg overflow-hidden border border-[#2A2F3A]">
              {['swing', 'day'].map(t => (
                <button key={t} onClick={() => setTraderType(t)}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${traderType === t ? 'bg-[#00D9F5]/20 text-[#00D9F5]' : 'bg-[#0B0E11] text-slate-400'}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button data-testid="run-analysis-btn" onClick={runAnalysis} disabled={loading}
          className="mt-4 bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold shadow-[0_0_15px_rgba(0,245,160,0.3)] px-8">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><Brain className="w-4 h-4 mr-2" /> Run AI Analysis</>}
        </Button>
      </div>

      {/* Results */}
      {result && ai && (
        <div className="space-y-4 animate-fade-in">
          {/* Main Recommendation */}
          <div className={`glass-card rounded-xl p-6 neon-border`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${ai.recommendation === 'BUY' ? 'bg-green-500/20' : ai.recommendation === 'SELL' ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                  {ai.recommendation === 'BUY' ? <TrendingUp className="w-8 h-8 text-green-400" /> : ai.recommendation === 'SELL' ? <TrendingDown className="w-8 h-8 text-red-400" /> : <Minus className="w-8 h-8 text-yellow-400" />}
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tighter uppercase">{ai.recommendation}</h2>
                  <p className="text-sm text-slate-400">{result.symbol} · {result.timeframe}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Confidence</p>
                  <p className="text-3xl font-bold font-mono" style={{ color: ai.confidence >= 70 ? '#00F5A0' : ai.confidence >= 50 ? '#FFD60A' : '#FF3B30' }}>{ai.confidence}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Trend</p>
                  <p className={`text-lg font-bold ${ai.trend === 'BULLISH' ? 'text-green-400' : ai.trend === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'}`}>{ai.trend}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">R:R</p>
                  <p className="text-lg font-bold text-[#00D9F5]">{ai.risk_reward}</p>
                </div>
              </div>
            </div>

            {/* TP/SL Levels */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Take Profit 1', value: ai.tp1, color: '#00F5A0' },
                { label: 'Take Profit 2', value: ai.tp2, color: '#00D9F5' },
                { label: 'Take Profit 3', value: ai.tp3, color: '#A78BFA' },
                { label: 'Stop Loss', value: ai.sl, color: '#FF3B30' },
              ].map((lvl, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                  <p className="text-xs text-slate-500 mb-1">{lvl.label}</p>
                  <p className="text-lg font-bold font-mono" style={{ color: lvl.color }} data-testid={`analysis-${lvl.label.toLowerCase().replace(/ /g, '-')}`}>{lvl.value}</p>
                </div>
              ))}
            </div>

            {/* Entry Zone */}
            {ai.entry_zone && (
              <div className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] mb-4">
                <p className="text-xs text-slate-500 mb-1">Entry Zone</p>
                <p className="text-sm font-mono text-white">{ai.entry_zone}</p>
              </div>
            )}

            {/* Explanation */}
            <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">AI Explanation</p>
              <p className="text-sm text-slate-300 leading-relaxed">{ai.explanation}</p>
            </div>
          </div>

          {/* Indicators & Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Indicators */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-lg font-bold tracking-tight mb-4">Technical Indicators</h3>
              <div className="grid grid-cols-2 gap-3">
                {ind && Object.entries(ind).map(([key, val]) => (
                  <div key={key} className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <p className="text-xs text-slate-500 uppercase">{key.replace('_', ' ')}</p>
                    <p className="text-sm font-mono font-bold text-white">{typeof val === 'number' ? val.toFixed(5) : val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Patterns */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-lg font-bold tracking-tight mb-4">Detected Patterns</h3>
              <div className="space-y-2">
                {ai.patterns_detected?.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <div className="w-2 h-2 rounded-full bg-[#00F5A0]" />
                    <p className="text-sm text-slate-300">{p}</p>
                  </div>
                ))}
                {ai.advanced_patterns?.map((p, i) => (
                  <div key={`adv-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-[#00D9F5]/5 border border-[#00D9F5]/20">
                    <div className="w-2 h-2 rounded-full bg-[#00D9F5]" />
                    <p className="text-sm text-[#00D9F5]">{p}</p>
                  </div>
                ))}
              </div>
              {ai.momentum && (
                <div className="mt-3 p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                  <p className="text-xs text-slate-500">Momentum: <span className="text-white">{ai.momentum}</span></p>
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          {result.chart_data?.length > 0 && (
            <div className="glass-card rounded-xl p-4" data-testid="analysis-chart">
              <h3 className="text-lg font-bold tracking-tight mb-4">Price Action</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={result.chart_data}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00F5A0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2A2F3A" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={false} axisLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#15191E', borderColor: '#2A2F3A', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="close" stroke="#00F5A0" fill="url(#chartGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="glass-card rounded-xl p-4 animate-fade-in" data-testid="analysis-history">
          <h3 className="text-lg font-bold tracking-tight mb-4">Analysis History</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <button key={i} onClick={() => setResult(h)} className="w-full flex items-center justify-between p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] hover:border-[#00F5A0]/30 transition-all text-left">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${h.ai_result?.recommendation === 'BUY' ? 'bg-green-500/20 text-green-400' : h.ai_result?.recommendation === 'SELL' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {h.ai_result?.recommendation?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{h.symbol}</p>
                    <p className="text-xs text-slate-500">{h.timeframe} · {h.asset_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold" style={{ color: h.ai_result?.confidence >= 70 ? '#00F5A0' : '#FFD60A' }}>{h.ai_result?.confidence}%</p>
                  <p className="text-xs text-slate-500">{h.created_at?.slice(0, 10)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
