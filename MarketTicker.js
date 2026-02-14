import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function MarketTicker() {
  const { authHeaders, API } = useAuth();
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickers();
    const interval = setInterval(loadTickers, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const loadTickers = async () => {
    try {
      const res = await axios.get(`${API}/market/overview`, authHeaders());
      const allPrices = [];
      
      if (res.data.prices) {
        Object.values(res.data.prices).forEach(category => {
          category.forEach(item => {
            allPrices.push(item);
          });
        });
      }
      
      setTickers(allPrices);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  if (loading || tickers.length === 0) return null;

  return (
    <div className="w-full bg-[#0B0E11] border-b border-[#2A2F3A] overflow-hidden">
      <div className="ticker-container">
        <div className="ticker-wrapper">
          <div className="ticker-content">
            {[...tickers, ...tickers].map((ticker, idx) => (
              <div key={idx} className="ticker-item flex items-center gap-2 px-4 py-2 whitespace-nowrap">
                <span className="text-xs font-medium text-slate-400">{ticker.name}</span>
                <span className="text-xs font-bold font-mono text-white">
                  {typeof ticker.price === 'number' ? ticker.price.toFixed(ticker.name.includes('/USD') || ticker.name.includes('BTC') ? 2 : 5) : '0.00'}
                </span>
                <div className={`flex items-center gap-0.5 ${ticker.change >= 0 ? 'text-[#00F5A0]' : 'text-red-400'}`}>
                  {ticker.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span className="text-xs font-mono font-bold">
                    {ticker.change >= 0 ? '+' : ''}{typeof ticker.change === 'number' ? ticker.change.toFixed(2) : '0.00'}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .ticker-container {
          width: 100%;
          overflow: hidden;
        }
        
        .ticker-wrapper {
          display: inline-block;
          animation: scroll 60s linear infinite;
        }
        
        .ticker-content {
          display: inline-flex;
        }
        
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .ticker-wrapper:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
