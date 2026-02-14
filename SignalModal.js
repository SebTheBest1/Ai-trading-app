import React from 'react';
import { X, TrendingUp, TrendingDown, Target, Activity, Zap, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import ChartCanvas from './ChartCanvas';

export default function SignalModal({ signal, onClose }) {
  if (!signal) return null;

  const isBuy = signal.action === 'BUY';

  // Generate a mock chart image for demonstration
  // In production, this would be an actual chart screenshot
  const generateMockChartDataUrl = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    // Dark background
    ctx.fillStyle = '#0B0E11';
    ctx.fillRect(0, 0, 800, 600);
    
    // Grid lines
    ctx.strokeStyle = '#1E2329';
    ctx.lineWidth = 1;
    for (let i = 0; i < 800; i += 80) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 600);
      ctx.stroke();
    }
    for (let i = 0; i < 600; i += 60) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(800, i);
      ctx.stroke();
    }
    
    // Price line (simulated)
    ctx.strokeStyle = isBuy ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const startY = isBuy ? 500 : 100;
    const endY = isBuy ? 200 : 400;
    const points = 50;
    
    for (let i = 0; i < points; i++) {
      const x = (i / points) * 800;
      const baseY = startY + ((endY - startY) * (i / points));
      const noise = Math.sin(i * 0.5) * 20 + Math.random() * 15;
      const y = baseY + noise;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Add some candlesticks
    for (let i = 0; i < 40; i++) {
      const x = 50 + i * 18;
      const baseY = startY + ((endY - startY) * (i / 40));
      const open = baseY + Math.random() * 30 - 15;
      const close = open + (Math.random() - 0.5) * 40;
      const high = Math.min(open, close) - Math.random() * 20;
      const low = Math.max(open, close) + Math.random() * 20;
      
      const isGreen = close > open;
      ctx.fillStyle = isGreen ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
      ctx.strokeStyle = isGreen ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      
      // Wick
      ctx.beginPath();
      ctx.moveTo(x, high);
      ctx.lineTo(x, low);
      ctx.stroke();
      
      // Body
      const bodyHeight = Math.abs(close - open);
      ctx.fillRect(x - 3, Math.min(open, close), 6, bodyHeight || 2);
    }
    
    return canvas.toDataURL();
  };

  const mockChartUrl = generateMockChartDataUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-y-auto glass-card rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-6 border-b border-[#2A2F3A] bg-[#0B0E11]/95 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {isBuy ? <TrendingUp className="w-7 h-7 text-green-400" /> : <TrendingDown className="w-7 h-7 text-red-400" />}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tighter uppercase flex items-center gap-2">
                {signal.symbol}
                <span className={`text-sm px-2 py-0.5 rounded ${isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {signal.action}
                </span>
              </h2>
              <p className="text-sm text-slate-400">{signal.asset_type.toUpperCase()} · {signal.timeframe}</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Scores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0B0E11] border border-[#2A2F3A] text-center">
              <Activity className="w-6 h-6 text-[#00D9F5] mx-auto mb-2" />
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Bias Score</p>
              <p className="text-3xl font-bold font-mono" style={{ color: signal.bias_score >= 70 ? '#00F5A0' : signal.bias_score >= 50 ? '#FFD60A' : '#FF3B30' }}>
                {signal.bias_score || 65}
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-[#0B0E11] border border-[#2A2F3A] text-center">
              <Target className="w-6 h-6 text-[#A78BFA] mx-auto mb-2" />
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Trade Quality</p>
              <p className="text-3xl font-bold font-mono" style={{ color: signal.trade_quality_score >= 70 ? '#00F5A0' : signal.trade_quality_score >= 50 ? '#FFD60A' : '#FF3B30' }}>
                {signal.trade_quality_score || 72}
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-[#0B0E11] border border-[#2A2F3A] text-center">
              <Zap className="w-6 h-6 text-[#FFD60A] mx-auto mb-2" />
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
              <p className="text-3xl font-bold font-mono" style={{ color: signal.confidence >= 70 ? '#00F5A0' : '#FFD60A' }}>
                {signal.confidence}%
              </p>
            </div>
          </div>

          {/* Visual Chart */}
          {signal.visual_overlays && (
            <div>
              <h3 className="text-lg font-bold tracking-tight mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#FFD60A]" /> Technical Analysis Chart
              </h3>
              <ChartCanvas imageUrl={mockChartUrl} overlayData={signal.visual_overlays} />
            </div>
          )}

          {/* Trade Setup */}
          <div className="p-5 rounded-xl border border-[#00F5A0]/20 bg-[#00F5A0]/5">
            <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-[#00F5A0]" /> Trade Setup
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Entry', value: signal.price, color: '#fff' },
                { label: 'Stop Loss', value: signal.sl, color: '#FF3B30' },
                { label: 'TP1', value: signal.tp1, color: '#00F5A0' },
                { label: 'TP2', value: signal.tp2, color: '#00D9F5' },
                { label: 'TP3', value: signal.tp3, color: '#A78BFA' },
              ].map((lvl, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                  <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">{lvl.label}</p>
                  <p className="text-sm font-bold font-mono" style={{ color: lvl.color }}>{lvl.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Risk:Reward</p>
                <p className="text-xl font-bold font-mono text-[#00D9F5]">{signal.risk_reward}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Risk Level</p>
                <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold uppercase ${signal.risk_level === 'Low' ? 'bg-green-500/20 text-green-400' : signal.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {signal.risk_level}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Quality</p>
                <span className="inline-block px-3 py-1 rounded-lg text-sm font-bold text-[#00F5A0] bg-[#00F5A0]/20">
                  {signal.quality}
                </span>
              </div>
            </div>
          </div>

          {/* Why This Trade */}
          <div className="p-5 rounded-xl bg-[#0B0E11] border border-[#FFD60A]/30">
            <h3 className="text-sm font-bold tracking-tight mb-3 flex items-center gap-2 text-[#FFD60A] uppercase">
              <Zap className="w-4 h-4" /> Why This Trade?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">{signal.why_this_trade}</p>
            
            {signal.reasons && signal.reasons.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Technical Confirmations:</p>
                {signal.reasons.map((reason, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00F5A0]" />
                    <p className="text-xs text-slate-400">{reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Market Context */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0B0E11] border border-[#2A2F3A]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Support</p>
              <p className="text-lg font-bold font-mono text-green-400">{signal.support}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0B0E11] border border-[#2A2F3A]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Resistance</p>
              <p className="text-lg font-bold font-mono text-red-400">{signal.resistance}</p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-yellow-400 mb-1">Risk Disclaimer</p>
              <p className="text-xs text-slate-400">Trading involves significant risk. This signal is for informational purposes only. Always use proper risk management and only trade with capital you can afford to lose.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
