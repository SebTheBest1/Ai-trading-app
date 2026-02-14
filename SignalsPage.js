import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Radio, RefreshCw, TrendingUp, TrendingDown, Loader2, Eye, Target, Activity, Zap, Bell } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import SignalModal from '../components/SignalModal';

export default function SignalsPage() {
  const { authHeaders, API } = useAuth();
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [filterAsset, setFilterAsset] = useState('all');
  const prevSignalCount = useRef(0);
  const [newSignalIds, setNewSignalIds] = useState(new Set());

  useEffect(() => {
    loadSignals();
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      loadSignals(true);
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  const playDing = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const loadSignals = async (silent = false) => {
    try {
      const res = await axios.get(`${API}/signals`, authHeaders());
      const newSignals = res.data.signals || [];
      
      // Check for new signals
      if (prevSignalCount.current > 0 && newSignals.length > prevSignalCount.current) {
        const newCount = newSignals.length - prevSignalCount.current;
        playDing();
        toast.success(`🔔 ${newCount} new signal${newCount > 1 ? 's' : ''} detected!`, {
          description: `High-quality trading opportunities identified`
        });
        
        // Mark new signals for flash animation
        const newIds = new Set();
        newSignals.slice(0, newCount).forEach(s => newIds.add(s.id));
        setNewSignalIds(newIds);
        
        // Remove flash after 3 seconds
        setTimeout(() => setNewSignalIds(new Set()), 3000);
      }
      
      prevSignalCount.current = newSignals.length;
      setSignals(newSignals);
    } catch {}
  };

  const generateSignals = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/signals/generate`, {}, authHeaders());
      const newSignals = res.data.signals || [];
      if (newSignals.length > 0) {
        playDing();
        toast.success(`✨ Generated ${newSignals.length} new signal${newSignals.length > 1 ? 's' : ''}!`);
        
        // Mark as new
        const newIds = new Set();
        newSignals.forEach(s => newIds.add(s.id));
        setNewSignalIds(newIds);
        setTimeout(() => setNewSignalIds(new Set()), 3000);
      } else {
        toast.info('No quality signals found at the moment. Market conditions don\'t meet criteria.');
      }
      loadSignals(true);
    } catch {
      toast.error('Failed to generate signals');
    }
    setLoading(false);
  };

  const filteredSignals = signals.filter(s => 
    filterAsset === 'all' || s.asset_type === filterAsset
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="signals-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
            <span className="gradient-text flex items-center gap-2">
              <Radio className="w-8 h-8 text-[#00F5A0]" />
              AI Signals
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Confluence-based trading opportunities with visual analysis</p>
        </div>
        <Button
          onClick={generateSignals}
          disabled={loading}
          className="bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold shadow-[0_0_15px_rgba(0,245,160,0.3)]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          {loading ? 'Scanning Markets...' : 'Generate Signals'}
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Signals</p>
          <p className="text-3xl font-bold text-white">{signals.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">High Quality</p>
          <p className="text-3xl font-bold text-[#00F5A0]">
            {signals.filter(s => (s.trade_quality_score || 0) >= 70).length}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Buy Signals</p>
          <p className="text-3xl font-bold text-green-400">
            {signals.filter(s => s.action === 'BUY').length}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sell Signals</p>
          <p className="text-3xl font-bold text-red-400">
            {signals.filter(s => s.action === 'SELL').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {['all', 'forex', 'crypto', 'metals'].map(type => (
          <button
            key={type}
            onClick={() => setFilterAsset(type)}
            className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filterAsset === type
                ? 'bg-[#00F5A0]/20 text-[#00F5A0] border border-[#00F5A0]/30 shadow-[0_0_10px_rgba(0,245,160,0.1)]'
                : 'bg-[#0B0E11] text-slate-400 border border-[#2A2F3A] hover:text-white hover:border-[#3A3F4A]'
            }`}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Signals Grid */}
      {filteredSignals.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Radio className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">No Signals Available</h3>
          <p className="text-sm text-slate-500 mb-6">Click "Generate Signals" to scan markets for trading opportunities</p>
          <Button onClick={generateSignals} disabled={loading} className="bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Scan Markets Now
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSignals.map(signal => {
            const isBuy = signal.action === 'BUY';
            const isNew = newSignalIds.has(signal.id);
            
            return (
              <div
                key={signal.id}
                className={`glass-card rounded-xl p-5 hover-lift transition-all ${
                  isNew ? 'animate-pulse-border' : ''
                } ${isBuy ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold">{signal.symbol}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {signal.action}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{signal.asset_type} · {signal.timeframe}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isBuy ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {isBuy ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
                  </div>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <p className="text-[9px] text-slate-500 uppercase mb-0.5">Quality</p>
                    <p className="text-lg font-bold" style={{ 
                      color: (signal.trade_quality_score || 0) >= 70 ? '#00F5A0' : (signal.trade_quality_score || 0) >= 50 ? '#FFD60A' : '#FF3B30' 
                    }}>
                      {signal.trade_quality_score || signal.quality || 'B'}
                    </p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <p className="text-[9px] text-slate-500 uppercase mb-0.5">Conf.</p>
                    <p className="text-lg font-bold text-[#00D9F5]">{signal.confidence}%</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <p className="text-[9px] text-slate-500 uppercase mb-0.5">R:R</p>
                    <p className="text-lg font-bold text-[#A78BFA]">{signal.risk_reward}</p>
                  </div>
                </div>

                {/* Levels */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Entry:</span>
                    <span className="font-mono font-bold text-white">{signal.price}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Stop Loss:</span>
                    <span className="font-mono font-bold text-red-400">{signal.sl}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Take Profit:</span>
                    <span className="font-mono font-bold text-[#00F5A0]">{signal.tp1} / {signal.tp2} / {signal.tp3}</span>
                  </div>
                </div>

                {/* View Analysis Button */}
                <Button
                  onClick={() => setSelectedSignal(signal)}
                  className="w-full bg-[#0B0E11] border border-[#2A2F3A] text-slate-300 hover:bg-[#00F5A0]/10 hover:text-[#00F5A0] hover:border-[#00F5A0]/30"
                  size="sm"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Analysis
                </Button>

                {/* Timestamp */}
                <p className="text-[10px] text-slate-600 text-center mt-3">
                  {new Date(signal.created_at).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Signal Modal */}
      {selectedSignal && (
        <SignalModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
        />
      )}

      <style jsx>{`
        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(0, 245, 160, 0.7);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(0, 245, 160, 0);
          }
        }
        
        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out 3;
        }
      `}</style>
    </div>
  );
}
