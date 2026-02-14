import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Upload, Brain, TrendingUp, TrendingDown, Minus, Image, Loader2, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Target, Activity, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import ChartCanvas from '../components/ChartCanvas';

const LOADING_STEPS = [
  { text: 'Scanning candles and price action...', icon: '📊' },
  { text: 'Detecting market structure (HH/HL/LH/LL)...', icon: '📈' },
  { text: 'Locating support and resistance zones...', icon: '🎯' },
  { text: 'Identifying chart patterns...', icon: '🔍' },
  { text: 'Drawing trendlines and channels...', icon: '📐' },
  { text: 'Analyzing volume and momentum...', icon: '⚡' },
  { text: 'Evaluating trade quality and risk...', icon: '⚖️' },
  { text: 'Generating visual overlays and report...', icon: '✨' }
];

export default function ChartUploadPage() {
  const { authHeaders, API } = useAuth();
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [marketType, setMarketType] = useState('forex');
  const [timeframe, setTimeframe] = useState('1h');
  const [pairName, setPairName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    axios.get(`${API}/analysis/history`, authHeaders())
      .then(res => {
        const uploads = (res.data.analyses || []).filter(a => a.type === 'chart_upload');
        setHistory(uploads);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => prev < LOADING_STEPS.length - 1 ? prev + 1 : prev);
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/image\/(png|jpeg|jpg|webp)/)) {
      toast.error('Unsupported format. Use PNG, JPG, or WebP');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      setImageBase64(ev.target.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target.result);
        setImageBase64(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const runAnalysis = async () => {
    if (!imageBase64) { toast.error('Upload a chart image first'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/analysis/upload`, {
        image_base64: imageBase64, market_type: marketType, timeframe, pair_name: pairName
      }, authHeaders());
      setResult(res.data.analysis);
      setHistory(prev => [res.data.analysis, ...prev]);
      toast.success('✅ Analysis complete!');
    } catch (err) {
      console.error('Chart analysis error:', err);
      const errorMsg = err.response?.data?.detail || 'Analysis failed. Please try again.';
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  const submitFeedback = async (analysisId, worked) => {
    try {
      await axios.post(`${API}/analysis/${analysisId}/feedback`, { worked }, authHeaders());
      toast.success(worked ? 'Marked as correct' : 'Marked as incorrect');
      setResult(prev => prev ? { ...prev, accuracy_feedback: { worked } } : prev);
    } catch {}
  };

  const ai = result?.ai_result;
  const trade = ai?.trade_idea;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="chart-upload-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
            <span className="gradient-text">Chart Analyzer</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Upload a chart screenshot for AI visual analysis</p>
        </div>
        <button data-testid="toggle-upload-history" onClick={() => setShowHistory(!showHistory)}
          className="text-sm text-[#00D9F5] hover:underline flex items-center gap-1">
          Past Analyses ({history.length}) <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Upload Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="glass-card rounded-xl p-6"
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Chart" className="w-full rounded-lg border border-[#2A2F3A] max-h-[400px] object-contain" data-testid="chart-preview" />
                <button onClick={() => { setImagePreview(null); setImageBase64(''); setResult(null); }}
                  className="absolute top-2 right-2 bg-red-500/80 text-white rounded-lg px-3 py-1 text-xs hover:bg-red-500">
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-[300px] border-2 border-dashed border-[#2A2F3A] rounded-xl cursor-pointer hover:border-[#00F5A0]/40 transition-colors" data-testid="upload-dropzone">
                <Upload className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-sm text-slate-400 font-medium">Drop chart image here or click to upload</p>
                <p className="text-xs text-slate-600 mt-1">PNG, JPG, JPEG, WebP supported</p>
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileUpload} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <div>
              <Label className="text-xs text-slate-400 uppercase tracking-wider">Market Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['forex', 'crypto', 'indices', 'stocks'].map(t => (
                  <button key={t} data-testid={`market-${t}`} onClick={() => setMarketType(t)}
                    className={`py-2 text-xs font-medium rounded-lg transition-all ${marketType === t ? 'bg-[#00F5A0]/20 text-[#00F5A0] border border-[#00F5A0]/30' : 'bg-[#0B0E11] text-slate-400 border border-[#2A2F3A]'}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400 uppercase tracking-wider">Timeframe</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {['1m', '5m', '15m', '1H', '4H', 'Daily'].map(t => (
                  <button key={t} onClick={() => setTimeframe(t)}
                    className={`py-2 text-xs font-medium rounded-lg transition-all ${timeframe === t ? 'bg-[#00D9F5]/20 text-[#00D9F5] border border-[#00D9F5]/30' : 'bg-[#0B0E11] text-slate-400 border border-[#2A2F3A]'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400 uppercase tracking-wider">Pair Name (Optional)</Label>
              <Input data-testid="pair-name" value={pairName} onChange={e => setPairName(e.target.value)}
                placeholder="e.g. EURUSD" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-2" />
            </div>
            <Button data-testid="analyze-chart-btn" onClick={runAnalysis} disabled={loading || !imageBase64}
              className="w-full bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold shadow-[0_0_15px_rgba(0,245,160,0.3)] h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
              {loading ? 'Analyzing...' : 'Analyze Chart'}
            </Button>
          </div>

          {/* Loading Steps */}
          {loading && (
            <div className="glass-card rounded-xl p-4 animate-fade-in" data-testid="loading-steps">
              <div className="space-y-2.5">
                {LOADING_STEPS.map((step, i) => (
                  <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${i <= loadingStep ? 'opacity-100' : 'opacity-25'}`}>
                    <div className="flex items-center gap-2 flex-1">
                      {i < loadingStep ? (
                        <CheckCircle2 className="w-5 h-5 text-[#00F5A0] shrink-0" />
                      ) : i === loadingStep ? (
                        <Loader2 className="w-5 h-5 text-[#00D9F5] animate-spin shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-[#2A2F3A] shrink-0" />
                      )}
                      <span className="text-lg shrink-0">{step.icon}</span>
                      <p className={`text-sm ${i <= loadingStep ? 'text-white font-medium' : 'text-slate-600'}`}>{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && ai && (
        <div className="space-y-4 animate-fade-in" data-testid="chart-analysis-result">
          
          {/* Scores Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Market Bias Score */}
            <div className="glass-card rounded-xl p-5 neon-border text-center">
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center ${ai.market_bias === 'BULLISH' ? 'bg-green-500/20' : ai.market_bias === 'BEARISH' ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                {ai.market_bias === 'BULLISH' ? <TrendingUp className="w-8 h-8 text-green-400" /> : ai.market_bias === 'BEARISH' ? <TrendingDown className="w-8 h-8 text-red-400" /> : <Minus className="w-8 h-8 text-yellow-400" />}
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Market Bias</p>
              <h3 className="text-2xl font-extrabold tracking-tighter uppercase mb-1">{ai.market_bias}</h3>
              <p className="text-sm text-slate-400">{result.symbol} · {result.timeframe}</p>
            </div>

            {/* Bias Score */}
            <div className="glass-card rounded-xl p-5 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[#00D9F5]/10">
                <Activity className="w-8 h-8 text-[#00D9F5]" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Bias Strength</p>
              <h3 className="text-4xl font-bold font-mono" style={{ color: (ai.bias_score || 50) >= 70 ? '#00F5A0' : (ai.bias_score || 50) >= 50 ? '#FFD60A' : '#FF3B30' }}>
                {ai.bias_score || 50}
              </h3>
              <p className="text-xs text-slate-500 mt-1">out of 100</p>
            </div>

            {/* Trade Quality Score */}
            <div className="glass-card rounded-xl p-5 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[#A78BFA]/10">
                <Target className="w-8 h-8 text-[#A78BFA]" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Trade Quality</p>
              <h3 className="text-4xl font-bold font-mono" style={{ color: (ai.trade_quality_score || 40) >= 70 ? '#00F5A0' : (ai.trade_quality_score || 40) >= 50 ? '#FFD60A' : '#FF3B30' }}>
                {ai.trade_quality_score || 40}
              </h3>
              <p className="text-xs text-slate-500 mt-1">out of 100</p>
            </div>
          </div>

          {/* Marked Chart */}
          {ai.visual_overlays && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#FFD60A]" /> Visual Analysis
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">AI-detected levels, patterns, and trade zones</p>
                </div>
              </div>
              <ChartCanvas imageUrl={imagePreview} overlayData={ai.visual_overlays} />
            </div>
          )}

          {/* Market Assessment */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-lg font-bold tracking-tight mb-3">Market Assessment</h3>
            <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
              <p className="text-sm text-slate-300 leading-relaxed">{ai.overall_assessment || ai.market_summary}</p>
            </div>
          </div>

          {/* Trade Idea */}
          {trade?.valid && (
            <div className="glass-card rounded-xl p-5 neon-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Brain className="w-5 h-5 text-[#00F5A0]" /> Trade Setup — {trade.direction}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Confidence</p>
                    <p className="text-xl font-bold font-mono" style={{ color: trade.confidence >= 70 ? '#00F5A0' : '#FFD60A' }}>{trade.confidence}%</p>
                  </div>
                  {trade.risk_reward_ratio && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">R:R</p>
                      <p className="text-xl font-bold font-mono text-[#00D9F5]">{trade.risk_reward_ratio}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                {[
                  { label: 'Entry', value: trade.entry_zone, color: '#fff' },
                  { label: 'Stop Loss', value: trade.stop_loss, color: '#FF3B30' },
                  { label: 'TP1', value: trade.tp1, color: '#00F5A0' },
                  { label: 'TP2', value: trade.tp2, color: '#00D9F5' },
                  { label: 'TP3', value: trade.tp3, color: '#A78BFA' },
                ].map((lvl, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">{lvl.label}</p>
                    <p className="text-sm font-bold" style={{ color: lvl.color }}>{lvl.value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Why This Trade */}
              <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#FFD60A]/30">
                <p className="text-xs text-[#FFD60A] uppercase tracking-wider mb-2 font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Why This Trade?
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">{trade.why_this_trade}</p>
              </div>

              {/* Risk Badge */}
              <div className="mt-3 flex items-center justify-between">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${trade.risk_level === 'Low' ? 'bg-green-500/20 text-green-400' : trade.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {trade.risk_level} Risk
                </span>
                <p className="text-xs text-slate-500">Confluence-based setup</p>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Key Levels */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-lg font-bold tracking-tight mb-3">Key Levels</h3>
              <div className="space-y-2">
                {ai.key_levels?.support?.map((s, i) => (
                  <div key={`s-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <p className="text-xs text-green-400">Support: {s}</p>
                  </div>
                ))}
                {ai.key_levels?.resistance?.map((r, i) => (
                  <div key={`r-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <p className="text-xs text-red-400">Resistance: {r}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Patterns */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="text-lg font-bold tracking-tight mb-3">Patterns Detected</h3>
              <div className="space-y-2">
                {ai.patterns_detected?.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${p.significance === 'high' ? 'bg-[#00F5A0]' : p.significance === 'medium' ? 'bg-[#FFD60A]' : 'bg-slate-400'}`} />
                      <p className="text-xs font-medium text-white">{p.name || p}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.completion && <span className="text-[10px] text-[#00D9F5] bg-[#00D9F5]/10 px-1.5 py-0.5 rounded">{p.completion}</span>}
                      {p.type && <span className="text-[10px] text-slate-500 bg-[#1E2329] px-1.5 py-0.5 rounded">{p.type}</span>}
                    </div>
                  </div>
                ))}
                {ai.candlestick_patterns?.map((p, i) => (
                  <div key={`cp-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-[#00D9F5]/5 border border-[#00D9F5]/20">
                    <div className="w-2 h-2 rounded-full bg-[#00D9F5]" />
                    <p className="text-xs text-[#00D9F5]">{p}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Harmonic Patterns */}
            {ai.harmonic_patterns && ai.harmonic_patterns.length > 0 && (
              <div className="glass-card rounded-xl p-4 neon-border">
                <h3 className="text-lg font-bold tracking-tight mb-3 flex items-center gap-2">
                  <span className="text-[#A78BFA]">⬡</span> Harmonic Patterns
                </h3>
                <div className="space-y-2">
                  {ai.harmonic_patterns.map((hp, i) => (
                    <div key={i} className="p-3 rounded-lg bg-[#A78BFA]/5 border border-[#A78BFA]/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-[#A78BFA]">{hp.name}</span>
                        <div className="flex items-center gap-2">
                          {hp.completion && <span className="text-xs px-2 py-0.5 rounded bg-[#A78BFA]/20 text-[#A78BFA]">{hp.completion}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded ${hp.direction === 'bullish' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {hp.direction?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {hp.potential_reversal_zone && (
                        <p className="text-xs text-slate-400">PRZ: <span className="text-white font-mono">{hp.potential_reversal_zone}</span></p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market Structure */}
            {ai.market_structure && (
              <div className="glass-card rounded-xl p-4">
                <h3 className="text-lg font-bold tracking-tight mb-3">Market Structure</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{ai.market_structure}</p>
                {ai.momentum && (
                  <div className="mt-3 p-2 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
                    <p className="text-xs text-slate-500">Momentum: <span className="text-white font-medium">{ai.momentum}</span></p>
                  </div>
                )}
              </div>
            )}

            {/* Scenarios */}
            {ai.scenarios && (
              <div className="glass-card rounded-xl p-4">
                <h3 className="text-lg font-bold tracking-tight mb-3">Scenarios</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <p className="text-xs text-green-400 font-bold mb-1">Bullish Scenario</p>
                    <p className="text-xs text-slate-300">{ai.scenarios.bullish}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <p className="text-xs text-red-400 font-bold mb-1">Bearish Scenario</p>
                    <p className="text-xs text-slate-300">{ai.scenarios.bearish}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accuracy Feedback */}
          {!result.accuracy_feedback && (
            <div className="glass-card rounded-xl p-4 flex items-center justify-between" data-testid="accuracy-feedback">
              <div>
                <p className="text-sm font-bold text-white">Did this analysis work?</p>
                <p className="text-xs text-slate-500">Help us track AI accuracy</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submitFeedback(result.id, true)}
                  className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Yes
                </Button>
                <Button size="sm" onClick={() => submitFeedback(result.id, false)}
                  className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30">
                  <XCircle className="w-4 h-4 mr-1" /> No
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="glass-card rounded-xl p-4 animate-fade-in" data-testid="upload-history">
          <h3 className="text-lg font-bold tracking-tight mb-4">Past Chart Analyses</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <button key={i} onClick={() => setResult(h)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] hover:border-[#00F5A0]/30 transition-all text-left">
                <div className="flex items-center gap-3">
                  <Image className="w-5 h-5 text-[#00D9F5]" />
                  <div>
                    <p className="text-sm font-medium">{h.symbol || 'Chart Upload'}</p>
                    <p className="text-xs text-slate-500">{h.timeframe} · {h.asset_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {h.accuracy_feedback && (
                    <span className={`text-xs ${h.accuracy_feedback.worked ? 'text-green-400' : 'text-red-400'}`}>
                      {h.accuracy_feedback.worked ? 'Correct' : 'Incorrect'}
                    </span>
                  )}
                  <p className="text-xs text-slate-500">{h.created_at?.slice(0, 10)}</p>
                </div>
              </button>
            ))}
            {history.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No past chart analyses</p>}
          </div>
        </div>
      )}
    </div>
  );
}
