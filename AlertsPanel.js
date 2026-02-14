import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Bell, BellRing, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

export default function AlertsPanel({ isOpen, onClose }) {
  const { authHeaders, API } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  
  // Form state
  const [symbol, setSymbol] = useState('EURUSD=X');
  const [alertType, setAlertType] = useState('above');
  const [priceLevel, setPriceLevel] = useState('');
  const [notes, setNotes] = useState('');

  const loadAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/alerts`, authHeaders());
      setAlerts(res.data.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
    setLoading(false);
  }, [API, authHeaders]);

  const checkAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/alerts/check`, authHeaders());
      if (res.data.triggered_alerts?.length > 0) {
        setTriggeredAlerts(res.data.triggered_alerts);
        res.data.triggered_alerts.forEach(alert => {
          toast.warning(
            `Price Alert: ${alert.symbol} ${alert.alert_type === 'above' ? 'above' : 'below'} ${alert.price_level}`,
            { duration: 10000 }
          );
        });
        loadAlerts(); // Refresh to show triggered status
      }
    } catch (err) {
      console.error('Failed to check alerts:', err);
    }
  }, [API, authHeaders, loadAlerts]);

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen, loadAlerts]);

  // Check alerts every minute
  useEffect(() => {
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [checkAlerts]);

  const createAlert = async (e) => {
    e.preventDefault();
    if (!priceLevel) {
      toast.error('Please enter a price level');
      return;
    }
    try {
      await axios.post(`${API}/alerts`, {
        symbol,
        alert_type: alertType,
        price_level: parseFloat(priceLevel),
        notes,
        enabled: true
      }, authHeaders());
      toast.success('Alert created successfully');
      setShowCreate(false);
      setSymbol('EURUSD=X');
      setAlertType('above');
      setPriceLevel('');
      setNotes('');
      loadAlerts();
    } catch (err) {
      toast.error('Failed to create alert');
    }
  };

  const deleteAlert = async (alertId) => {
    try {
      await axios.delete(`${API}/alerts/${alertId}`, authHeaders());
      toast.success('Alert deleted');
      loadAlerts();
    } catch (err) {
      toast.error('Failed to delete alert');
    }
  };

  const toggleAlert = async (alertId) => {
    try {
      await axios.put(`${API}/alerts/${alertId}/toggle`, {}, authHeaders());
      loadAlerts();
    } catch (err) {
      toast.error('Failed to toggle alert');
    }
  };

  if (!isOpen) return null;

  const alertTypeOptions = [
    { value: 'above', label: 'Price Above', icon: TrendingUp },
    { value: 'below', label: 'Price Below', icon: TrendingDown },
    { value: 'cross_resistance', label: 'Cross Resistance', icon: AlertTriangle },
    { value: 'cross_support', label: 'Cross Support', icon: AlertTriangle },
  ];

  const symbolOptions = [
    { value: 'EURUSD=X', label: 'EUR/USD' },
    { value: 'GBPUSD=X', label: 'GBP/USD' },
    { value: 'USDJPY=X', label: 'USD/JPY' },
    { value: 'BTC-USD', label: 'BTC/USD' },
    { value: 'ETH-USD', label: 'ETH/USD' },
    { value: 'GC=F', label: 'Gold' },
    { value: '^GSPC', label: 'S&P 500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md h-full bg-[#0B0E11] border-l border-[#2A2F3A] animate-slide-left overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        data-testid="alerts-panel"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#2A2F3A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FFD60A]/10">
              <BellRing className="w-5 h-5 text-[#FFD60A]" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Price Alerts</h2>
              <p className="text-xs text-slate-500">{alerts.filter(a => a.enabled && !a.triggered).length} active alerts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Create Alert Button/Form */}
          {!showCreate ? (
            <Button 
              onClick={() => setShowCreate(true)}
              className="w-full bg-gradient-to-r from-[#00F5A0] to-[#00D9F5] text-black font-bold h-11"
              data-testid="create-alert-btn"
            >
              <Plus className="w-4 h-4 mr-2" /> Create New Alert
            </Button>
          ) : (
            <form onSubmit={createAlert} className="p-4 rounded-xl bg-[#15191E] border border-[#2A2F3A] space-y-4">
              <h3 className="text-sm font-bold mb-3">New Price Alert</h3>
              
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Symbol</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full h-10 rounded-lg bg-[#1E2329] border border-[#2A2F3A] text-white px-3 text-sm"
                  data-testid="alert-symbol-select"
                >
                  {symbolOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Alert Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {alertTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAlertType(opt.value)}
                      className={`p-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        alertType === opt.value
                          ? 'bg-[#00F5A0]/10 border-2 border-[#00F5A0] text-[#00F5A0]'
                          : 'bg-[#1E2329] border border-[#2A2F3A] text-slate-400 hover:border-[#3A4049]'
                      }`}
                      data-testid={`alert-type-${opt.value}`}
                    >
                      <opt.icon className="w-3 h-3" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Price Level</label>
                <Input
                  type="number"
                  step="any"
                  value={priceLevel}
                  onChange={(e) => setPriceLevel(e.target.value)}
                  placeholder="Enter price level"
                  className="h-10 bg-[#1E2329] border-[#2A2F3A]"
                  data-testid="alert-price-input"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Notes (optional)</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Key resistance level"
                  className="h-10 bg-[#1E2329] border-[#2A2F3A]"
                  data-testid="alert-notes-input"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  className="flex-1 bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold"
                  data-testid="save-alert-btn"
                >
                  Create Alert
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setShowCreate(false)}
                  className="border-[#2A2F3A]"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Triggered Alerts */}
          {triggeredAlerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#FFD60A] uppercase">Just Triggered</h3>
              {triggeredAlerts.map(alert => (
                <div 
                  key={alert.id}
                  className="p-3 rounded-lg bg-[#FFD60A]/10 border border-[#FFD60A]/30 animate-pulse-glow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#FFD60A]">
                        {symbolOptions.find(s => s.value === alert.symbol)?.label || alert.symbol}
                      </p>
                      <p className="text-xs text-slate-400">
                        {alert.alert_type === 'above' ? 'Crossed above' : 'Crossed below'} {alert.price_level}
                      </p>
                    </div>
                    <p className="text-sm font-mono text-white">{alert.current_price?.toFixed(5)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Alerts */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Active Alerts</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#00F5A0]" />
              </div>
            ) : alerts.filter(a => !a.triggered).length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active alerts</p>
                <p className="text-xs">Create an alert to get notified</p>
              </div>
            ) : (
              alerts.filter(a => !a.triggered).map(alert => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-lg border transition-all ${
                    alert.enabled 
                      ? 'bg-[#15191E] border-[#2A2F3A]' 
                      : 'bg-[#0B0E11] border-[#1E2329] opacity-50'
                  }`}
                  data-testid={`alert-${alert.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        alert.alert_type.includes('above') || alert.alert_type === 'cross_resistance'
                          ? 'bg-[#00F5A0]/10'
                          : 'bg-[#F6465D]/10'
                      }`}>
                        {alert.alert_type.includes('above') || alert.alert_type === 'cross_resistance' ? (
                          <TrendingUp className={`w-4 h-4 ${alert.alert_type.includes('above') ? 'text-[#00F5A0]' : 'text-[#FFD60A]'}`} />
                        ) : (
                          <TrendingDown className={`w-4 h-4 ${alert.alert_type.includes('below') ? 'text-[#F6465D]' : 'text-[#FFD60A]'}`} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {symbolOptions.find(s => s.value === alert.symbol)?.label || alert.symbol}
                        </p>
                        <p className="text-xs text-slate-500">
                          {alertTypeOptions.find(t => t.value === alert.alert_type)?.label} {alert.price_level}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAlert(alert.id)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          alert.enabled ? 'bg-[#00F5A0]/10 text-[#00F5A0]' : 'bg-[#1E2329] text-slate-500'
                        }`}
                        data-testid={`toggle-alert-${alert.id}`}
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F6465D]/10 text-[#F6465D] hover:bg-[#F6465D]/20 transition-colors"
                        data-testid={`delete-alert-${alert.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {alert.notes && (
                    <p className="text-xs text-slate-500 mt-2 pl-11">{alert.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Triggered History */}
          {alerts.filter(a => a.triggered).length > 0 && (
            <div className="space-y-2 pt-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase">Triggered History</h3>
              {alerts.filter(a => a.triggered).map(alert => (
                <div 
                  key={alert.id}
                  className="p-3 rounded-lg bg-[#0B0E11] border border-[#1E2329] opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-400">
                        {symbolOptions.find(s => s.value === alert.symbol)?.label || alert.symbol}
                      </p>
                      <p className="text-xs text-slate-600">
                        {alertTypeOptions.find(t => t.value === alert.alert_type)?.label} {alert.price_level}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-1.5 rounded text-slate-600 hover:text-[#F6465D]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
