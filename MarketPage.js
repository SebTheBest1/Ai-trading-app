import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { 
  Globe, Clock, TrendingUp, TrendingDown, RefreshCw, Loader2, 
  Activity, ChevronRight, Search, Star, Upload, Maximize2, 
  ChartCandlestick, BarChart3, X, Plus
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
];

const CATEGORY_ICONS = {
  forex: '💱',
  crypto: '₿',
  indices: '📊',
  commodities: '🥇',
};

export default function MarketPage() {
  const { authHeaders, API } = useAuth();
  const navigate = useNavigate();
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const chartInitialized = useRef(false);
  
  const [instruments, setInstruments] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('forex');
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [watchlist, setWatchlist] = useState([]);

  // Load instruments
  useEffect(() => {
    const loadInstruments = async () => {
      try {
        const res = await axios.get(`${API}/market/instruments`);
        setInstruments(res.data.instruments);
        // Select first forex instrument by default
        if (res.data.instruments.forex?.length > 0) {
          const first = res.data.instruments.forex[0];
          setSelectedInstrument({ symbol: first[0], name: first[1], description: first[2] });
        }
      } catch (err) {
        console.error('Failed to load instruments:', err);
      }
      setLoading(false);
    };
    loadInstruments();
  }, [API]);

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await axios.get(`${API}/market/overview`);
        setSessions(res.data.sessions || []);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };
    loadSessions();
    const interval = setInterval(loadSessions, 60000);
    return () => clearInterval(interval);
  }, [API]);

  // Load watchlist
  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        const res = await axios.get(`${API}/watchlist`, authHeaders());
        setWatchlist(res.data.watchlist || []);
      } catch (err) {
        console.error('Failed to load watchlist:', err);
      }
    };
    loadWatchlist();
  }, [API, authHeaders]);

  // Initialize chart
  useEffect(() => {
    // Don't initialize if already done or container not ready
    if (chartInitialized.current || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    
    // Wait for container to have dimensions
    if (container.clientWidth === 0) {
      const timer = setTimeout(() => {
        // Force re-render to trigger another attempt
        chartInitialized.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }

    try {
      const width = container.clientWidth || 800;
      const height = isFullscreen ? window.innerHeight - 100 : 450;

      const chart = createChart(container, {
        width: width,
        height: height,
        layout: {
          background: { type: 'solid', color: '#0B0E11' },
          textColor: '#848E9C',
        },
        grid: {
          vertLines: { color: '#1E2329' },
          horzLines: { color: '#1E2329' },
        },
        crosshair: {
          mode: 0,
          vertLine: {
            color: '#00F5A0',
            width: 1,
            style: 2,
            labelBackgroundColor: '#00F5A0',
          },
          horzLine: {
            color: '#00F5A0',
            width: 1,
            style: 2,
            labelBackgroundColor: '#00F5A0',
          },
        },
        timeScale: {
          borderColor: '#2A2F3A',
          timeVisible: true,
          secondsVisible: false,
        },
        localization: {
          locale: 'en-US',
        },
        rightPriceScale: {
          borderColor: '#2A2F3A',
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00F5A0',
        downColor: '#F6465D',
        borderDownColor: '#F6465D',
        borderUpColor: '#00F5A0',
        wickDownColor: '#F6465D',
        wickUpColor: '#00F5A0',
      });

      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      chartInitialized.current = true;

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          const newWidth = chartContainerRef.current.clientWidth || 800;
          const newHeight = isFullscreen ? window.innerHeight - 100 : 450;
          chartRef.current.applyOptions({ 
            width: newWidth,
            height: newHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
          candleSeriesRef.current = null;
          volumeSeriesRef.current = null;
          chartInitialized.current = false;
        }
      };
    } catch (err) {
      console.error('Failed to initialize chart:', err);
    }
  }, [isFullscreen, loading]);

  // Load chart data when instrument or timeframe changes
  const loadChartData = useCallback(async () => {
    if (!selectedInstrument) return;
    
    setChartLoading(true);
    try {
      const res = await axios.get(`${API}/market/chart/${selectedInstrument.symbol}?timeframe=${timeframe}`);
      setChartData(res.data);
      
      if (candleSeriesRef.current && res.data.data?.length > 0) {
        // Clear and set new data
        candleSeriesRef.current.setData(res.data.data);
        
        // Set volume data with colors
        if (volumeSeriesRef.current) {
          const volumeData = res.data.data.map((d, i, arr) => ({
            time: d.time,
            value: d.volume || 0,
            color: i > 0 && d.close >= arr[i-1].close ? 'rgba(0, 245, 160, 0.3)' : 'rgba(246, 70, 93, 0.3)',
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
        
        // Fit content and resize chart
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
          // Trigger resize to ensure proper rendering
          const container = chartContainerRef.current;
          if (container) {
            chartRef.current.applyOptions({
              width: container.clientWidth || 800,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
      toast.error('Failed to load chart data');
    }
    setChartLoading(false);
  }, [API, selectedInstrument, timeframe]);

  useEffect(() => {
    // Delay initial data load to ensure chart is initialized
    const timer = setTimeout(() => {
      loadChartData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadChartData]);

  // Filter instruments based on search
  const filteredInstruments = instruments[selectedCategory]?.filter(([symbol, name, desc]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    desc.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleInstrumentSelect = (inst) => {
    setSelectedInstrument({ symbol: inst[0], name: inst[1], description: inst[2] });
  };

  const handleAddToWatchlist = async () => {
    if (!selectedInstrument) return;
    try {
      await axios.post(`${API}/watchlist`, {
        symbol: selectedInstrument.symbol,
        name: selectedInstrument.name,
        asset_type: selectedCategory,
      }, authHeaders());
      toast.success(`${selectedInstrument.name} added to watchlist`);
      // Refresh watchlist
      const res = await axios.get(`${API}/watchlist`, authHeaders());
      setWatchlist(res.data.watchlist || []);
    } catch (err) {
      toast.error('Failed to add to watchlist');
    }
  };

  const handleSendToAnalyzer = () => {
    // Navigate to chart upload page with the current chart
    navigate('/chart-upload', { state: { symbol: selectedInstrument?.symbol, name: selectedInstrument?.name } });
    toast.info(`Opening analyzer for ${selectedInstrument?.name}`);
  };

  const isInWatchlist = watchlist.some(w => w.symbol === selectedInstrument?.symbol);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="market-page-loading">
        <Loader2 className="w-8 h-8 animate-spin text-[#00F5A0]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="market-page">
      {/* Header */}
      <div className="p-4 border-b border-[#2A2F3A] bg-[#0B0E11]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tighter uppercase">
              <span className="gradient-text">Markets</span>
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">Live charts & market data</p>
          </div>
          
          {/* Trading Sessions Status */}
          <div className="flex items-center gap-2">
            {sessions.filter(s => s.status === 'active').slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#00F5A0]/10 border border-[#00F5A0]/20">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] animate-pulse" />
                <span className="text-xs font-medium text-[#00F5A0]">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Instrument Sidebar */}
        <div className="w-64 border-r border-[#2A2F3A] bg-[#0B0E11] flex flex-col shrink-0 hidden lg:flex">
          {/* Search */}
          <div className="p-3 border-b border-[#2A2F3A]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search instruments..."
                className="pl-8 h-8 text-sm bg-[#1E2329] border-[#2A2F3A] text-white placeholder:text-slate-500"
                data-testid="instrument-search"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex border-b border-[#2A2F3A] overflow-x-auto">
            {Object.keys(instruments).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
                  selectedCategory === cat
                    ? 'text-[#00F5A0] border-b-2 border-[#00F5A0] bg-[#00F5A0]/5'
                    : 'text-slate-500 hover:text-white'
                }`}
                data-testid={`category-${cat}`}
              >
                {CATEGORY_ICONS[cat]} {cat}
              </button>
            ))}
          </div>

          {/* Instrument List */}
          <div className="flex-1 overflow-y-auto">
            {filteredInstruments.map(([symbol, name, desc]) => (
              <button
                key={symbol}
                onClick={() => handleInstrumentSelect([symbol, name, desc])}
                className={`w-full px-3 py-2.5 text-left border-b border-[#1E2329] transition-all hover:bg-[#1E2329] ${
                  selectedInstrument?.symbol === symbol ? 'bg-[#00F5A0]/5 border-l-2 border-l-[#00F5A0]' : ''
                }`}
                data-testid={`instrument-${symbol}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chart Header */}
          {selectedInstrument && (
            <div className="p-3 border-b border-[#2A2F3A] bg-[#0B0E11]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{selectedInstrument.name}</h2>
                      {chartData && (
                        <span className={`text-sm font-mono ${chartData.change_pct >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                          {chartData.change_pct >= 0 ? '+' : ''}{chartData.change_pct}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{selectedInstrument.description}</p>
                  </div>
                  {chartData && (
                    <div className="flex items-center gap-4 ml-4">
                      <div>
                        <p className="text-xl font-bold font-mono text-white">{chartData.current_price}</p>
                      </div>
                      <div className="text-xs text-slate-500">
                        <p>H: <span className="text-[#00F5A0] font-mono">{chartData.period_high}</span></p>
                        <p>L: <span className="text-red-400 font-mono">{chartData.period_low}</span></p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Timeframe Selector */}
                  <div className="flex bg-[#1E2329] rounded-lg p-0.5">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf.value}
                        onClick={() => setTimeframe(tf.value)}
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                          timeframe === tf.value
                            ? 'bg-[#00F5A0] text-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                        data-testid={`timeframe-${tf.value}`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddToWatchlist}
                    disabled={isInWatchlist}
                    className={`h-8 border-[#2A2F3A] ${isInWatchlist ? 'text-[#FFD60A]' : 'text-slate-400 hover:text-white'}`}
                    data-testid="add-watchlist-btn"
                  >
                    <Star className={`w-4 h-4 ${isInWatchlist ? 'fill-current' : ''}`} />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendToAnalyzer}
                    className="h-8 border-[#2A2F3A] text-slate-400 hover:text-[#00F5A0] hover:border-[#00F5A0]"
                    data-testid="send-analyzer-btn"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Analyze
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadChartData}
                    disabled={chartLoading}
                    className="h-8 border-[#2A2F3A] text-slate-400 hover:text-white"
                    data-testid="refresh-chart-btn"
                  >
                    {chartLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="h-8 border-[#2A2F3A] text-slate-400 hover:text-white"
                    data-testid="fullscreen-btn"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Chart Container */}
          <div className={`flex-1 relative ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0B0E11]' : ''}`}>
            {isFullscreen && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsFullscreen(false)}
                className="absolute top-2 right-2 z-10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
            {chartLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0B0E11]/50 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-[#00F5A0]" />
              </div>
            )}
            <div 
              ref={chartContainerRef} 
              className="w-full"
              style={{ height: isFullscreen ? 'calc(100vh - 100px)' : '450px' }}
              data-testid="chart-container"
            />
          </div>

          {/* Bottom Stats Panel */}
          {chartData && (
            <div className="p-3 border-t border-[#2A2F3A] bg-[#0B0E11]">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="p-2 rounded-lg bg-[#1E2329]">
                  <p className="text-[10px] text-slate-500 uppercase">Current Price</p>
                  <p className="text-sm font-bold font-mono text-white">{chartData.current_price}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#1E2329]">
                  <p className="text-[10px] text-slate-500 uppercase">Change</p>
                  <p className={`text-sm font-bold font-mono ${chartData.change >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                    {chartData.change >= 0 ? '+' : ''}{chartData.change}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-[#1E2329]">
                  <p className="text-[10px] text-slate-500 uppercase">Change %</p>
                  <p className={`text-sm font-bold font-mono ${chartData.change_pct >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                    {chartData.change_pct >= 0 ? '+' : ''}{chartData.change_pct}%
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-[#1E2329]">
                  <p className="text-[10px] text-slate-500 uppercase">Period High</p>
                  <p className="text-sm font-bold font-mono text-[#00F5A0]">{chartData.period_high}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#1E2329]">
                  <p className="text-[10px] text-slate-500 uppercase">Period Low</p>
                  <p className="text-sm font-bold font-mono text-red-400">{chartData.period_low}</p>
                </div>
                <div className="p-2 rounded-lg bg-[#1E2329]">
                  <p className="text-[10px] text-slate-500 uppercase">Timeframe</p>
                  <p className="text-sm font-bold font-mono text-white">{timeframe.toUpperCase()}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Category Selector */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-[#2A2F3A] bg-[#0B0E11] p-2 z-40">
          <div className="flex justify-around">
            {Object.keys(instruments).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  selectedCategory === cat ? 'bg-[#00F5A0]/10 text-[#00F5A0]' : 'text-slate-500'
                }`}
              >
                <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                <span className="text-[10px] capitalize">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
