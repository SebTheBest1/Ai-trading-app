import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';

const AVAILABLE = {
  forex: [
    { symbol: 'EURUSD=X', name: 'EUR/USD' }, { symbol: 'GBPUSD=X', name: 'GBP/USD' },
    { symbol: 'USDJPY=X', name: 'USD/JPY' }, { symbol: 'AUDUSD=X', name: 'AUD/USD' },
    { symbol: 'USDCAD=X', name: 'USD/CAD' }, { symbol: 'NZDUSD=X', name: 'NZD/USD' },
    { symbol: 'USDCHF=X', name: 'USD/CHF' }, { symbol: 'EURGBP=X', name: 'EUR/GBP' }
  ],
  crypto: [
    { symbol: 'BTC-USD', name: 'BTC/USD' }, { symbol: 'ETH-USD', name: 'ETH/USD' },
    { symbol: 'SOL-USD', name: 'SOL/USD' }, { symbol: 'XRP-USD', name: 'XRP/USD' },
    { symbol: 'ADA-USD', name: 'ADA/USD' }, { symbol: 'DOGE-USD', name: 'DOGE/USD' }
  ],
  metals: [
    { symbol: 'GC=F', name: 'Gold' }, { symbol: 'SI=F', name: 'Silver' },
    { symbol: 'PL=F', name: 'Platinum' }
  ]
};

export default function WatchlistPage() {
  const { authHeaders, API } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState('forex');

  useEffect(() => { loadWatchlist(); }, []);

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/watchlist`, authHeaders());
      setWatchlist(res.data.watchlist || []);
    } catch {}
    setLoading(false);
  };

  const addItem = async (symbol, name, asset_type) => {
    try {
      await axios.post(`${API}/watchlist`, { symbol, name, asset_type }, authHeaders());
      toast.success(`${name} added to watchlist`);
      setShowAdd(false);
      loadWatchlist();
    } catch { toast.error('Failed to add'); }
  };

  const removeItem = async (id) => {
    try {
      await axios.delete(`${API}/watchlist/${id}`, authHeaders());
      setWatchlist(prev => prev.filter(w => w.id !== id));
      toast.success('Removed from watchlist');
    } catch {}
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="watchlist-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
            <span className="gradient-text">Watchlist</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Track your favorite markets</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadWatchlist} size="sm" className="border-[#2A2F3A] text-slate-400 bg-transparent">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button data-testid="add-watchlist-btn" className="bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold shadow-[0_0_15px_rgba(0,245,160,0.3)]">
                <Plus className="w-4 h-4 mr-1" /> Add Market
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#15191E] border-[#2A2F3A] text-white max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-xl font-bold">Add to Watchlist</DialogTitle></DialogHeader>
              <div className="flex rounded-lg overflow-hidden border border-[#2A2F3A] mb-4">
                {['forex', 'crypto', 'metals'].map(t => (
                  <button key={t} onClick={() => setAddType(t)}
                    className={`flex-1 py-2 text-xs font-medium transition-all ${addType === t ? 'bg-[#00F5A0]/20 text-[#00F5A0]' : 'bg-[#0B0E11] text-slate-400'}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {AVAILABLE[addType].map(item => {
                  const isAdded = watchlist.some(w => w.symbol === item.symbol);
                  return (
                    <button key={item.symbol} disabled={isAdded}
                      onClick={() => addItem(item.symbol, item.name, addType)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isAdded ? 'bg-[#00F5A0]/5 border-[#00F5A0]/20 cursor-not-allowed' : 'bg-[#0B0E11] border-[#2A2F3A] hover:border-[#00F5A0]/30'}`}>
                      <div className="flex items-center gap-3">
                        <Star className={`w-4 h-4 ${isAdded ? 'text-[#00F5A0] fill-[#00F5A0]' : 'text-slate-500'}`} />
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{item.symbol}</p>
                        </div>
                      </div>
                      {isAdded && <span className="text-xs text-[#00F5A0]">Added</span>}
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Watchlist Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00F5A0]" />
        </div>
      ) : watchlist.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {watchlist.map((item, i) => (
            <div key={item.id} className={`glass-card rounded-xl p-5 hover-lift stagger-${Math.min(i + 1, 5)} opacity-0 animate-fade-in`} data-testid={`watchlist-${i}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#FFD60A] fill-[#FFD60A]" />
                    <h3 className="text-lg font-bold">{item.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{item.symbol}</p>
                  <span className="text-[10px] text-slate-500 bg-[#1E2329] px-1.5 py-0.5 rounded mt-1 inline-block">{item.asset_type}</span>
                </div>
                <button onClick={() => removeItem(item.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold font-mono text-white">
                  {item.price?.toFixed(item.asset_type === 'crypto' ? 2 : 5) || '—'}
                </p>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${(item.change || 0) >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {(item.change || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {(item.change || 0) >= 0 ? '+' : ''}{(item.change || 0).toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center">
          <Star className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Empty Watchlist</h3>
          <p className="text-sm text-slate-500 mt-1">Add your favorite markets to track them here</p>
        </div>
      )}
    </div>
  );
}
