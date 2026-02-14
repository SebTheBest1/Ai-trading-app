import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import { Settings2, Volume2, VolumeX, Bell, BellOff, Download, RotateCcw, Shield, Palette, Brain, Activity } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { authHeaders, API } = useAuth();
  const { theme: currentTheme, changeTheme } = useTheme();
  const [settings, setSettings] = useState({
    notifications_enabled: true,
    sound_enabled: true,
    signal_frequency: 'normal',
    theme: 'dark',
    ai_aggressiveness: 'balanced',
    risk_profile: 'swing'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings`, authHeaders())
      .then(res => {
        const loadedSettings = { ...settings, ...res.data };
        setSettings(loadedSettings);
        // Apply theme from backend
        if (loadedSettings.theme && loadedSettings.theme !== currentTheme) {
          changeTheme(loadedSettings.theme);
        }
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, settings, authHeaders());
      // Apply theme change immediately
      changeTheme(settings.theme);
      toast.success('✅ Settings saved successfully');
    } catch { toast.error('Failed to save settings'); }
    setSaving(false);
  };

  const exportData = async () => {
    try {
      const res = await axios.get(`${API}/export/data`, authHeaders());
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'tradeai_export.json'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch { toast.error('Export failed'); }
  };

  const SettingSection = ({ title, icon: Icon, children }) => (
    <div className="glass-card rounded-xl p-5 hover-lift">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-[#00F5A0]/10 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-[#00F5A0]" />
        </div>
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );

  const OptionGroup = ({ label, options, value, onChange }) => (
    <div className="space-y-2">
      <Label className="text-xs text-slate-400 uppercase tracking-wider">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt.value} data-testid={`setting-${opt.value}`} onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${value === opt.value ? 'bg-[#00F5A0]/20 text-[#00F5A0] border border-[#00F5A0]/30 shadow-[0_0_10px_rgba(0,245,160,0.1)]' : 'bg-[#0B0E11] text-slate-400 border border-[#2A2F3A] hover:text-white hover:border-[#3A3F4A]'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="settings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
            <span className="gradient-text">Settings</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Customize your trading terminal</p>
        </div>
        <Button data-testid="save-settings-btn" onClick={saveSettings} disabled={saving}
          className="bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold shadow-[0_0_15px_rgba(0,245,160,0.3)]">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notifications */}
        <SettingSection title="Notifications" icon={Bell}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {settings.notifications_enabled ? <Bell className="w-4 h-4 text-[#00F5A0]" /> : <BellOff className="w-4 h-4 text-slate-500" />}
                <div>
                  <Label className="text-sm text-white">Push Notifications</Label>
                  <p className="text-xs text-slate-500">Signal alerts & trade updates</p>
                </div>
              </div>
              <Switch data-testid="notifications-toggle" checked={settings.notifications_enabled} onCheckedChange={v => setSettings({...settings, notifications_enabled: v})} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {settings.sound_enabled ? <Volume2 className="w-4 h-4 text-[#00F5A0]" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                <div>
                  <Label className="text-sm text-white">Sound Alerts</Label>
                  <p className="text-xs text-slate-500">Ding sound on new signals</p>
                </div>
              </div>
              <Switch data-testid="sound-toggle" checked={settings.sound_enabled} onCheckedChange={v => setSettings({...settings, sound_enabled: v})} />
            </div>
            <OptionGroup label="Signal Frequency" value={settings.signal_frequency}
              onChange={v => setSettings({...settings, signal_frequency: v})}
              options={[{value: 'low', label: 'Low'}, {value: 'normal', label: 'Normal'}, {value: 'high', label: 'High'}]} />
          </div>
        </SettingSection>

        {/* AI Config */}
        <SettingSection title="AI Configuration" icon={Brain}>
          <div className="space-y-4">
            <OptionGroup label="AI Aggressiveness" value={settings.ai_aggressiveness}
              onChange={v => setSettings({...settings, ai_aggressiveness: v})}
              options={[{value: 'conservative', label: 'Conservative'}, {value: 'balanced', label: 'Balanced'}, {value: 'aggressive', label: 'Aggressive'}]} />
            <OptionGroup label="Risk Profile" value={settings.risk_profile}
              onChange={v => setSettings({...settings, risk_profile: v})}
              options={[{value: 'scalper', label: 'Scalper'}, {value: 'day', label: 'Day Trader'}, {value: 'swing', label: 'Swing Trader'}]} />
          </div>
        </SettingSection>

        {/* Appearance */}
        <SettingSection title="Appearance" icon={Palette}>
          <OptionGroup label="Theme" value={settings.theme}
            onChange={v => setSettings({...settings, theme: v})}
            options={[{value: 'dark', label: 'Dark'}, {value: 'darkpro', label: 'Dark Pro'}, {value: 'midnight', label: 'Midnight'}, {value: 'neon', label: 'Neon'}]} />
        </SettingSection>

        {/* Data */}
        <SettingSection title="Data & Privacy" icon={Shield}>
          <div className="space-y-3">
            <Button data-testid="export-data-btn" onClick={exportData} variant="outline"
              className="w-full border-[#2A2F3A] text-slate-300 bg-transparent hover:bg-white/5 justify-start gap-3">
              <Download className="w-4 h-4 text-[#00D9F5]" /> Export All Data (JSON)
            </Button>
            <Button variant="outline"
              className="w-full border-[#2A2F3A] text-slate-300 bg-transparent hover:bg-white/5 justify-start gap-3"
              onClick={async () => {
                try {
                  const res = await axios.get(`${API}/export/trades`, { ...authHeaders(), responseType: 'blob' });
                  const url = URL.createObjectURL(res.data);
                  const a = document.createElement('a'); a.href = url; a.download = 'trades.csv'; a.click();
                  toast.success('Trades exported as CSV');
                } catch { toast.error('CSV export failed'); }
              }}>
              <Download className="w-4 h-4 text-[#FFD60A]" /> Export Trades (CSV)
            </Button>
          </div>
        </SettingSection>
      </div>
    </div>
  );
}
