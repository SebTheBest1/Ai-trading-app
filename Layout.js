import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MarketTicker from './MarketTicker';
import AlertsPanel from './AlertsPanel';
import {
  LayoutDashboard, Brain, Radio, BookOpen, Target, BarChart2,
  Globe, GraduationCap, User, Swords, TrendingUp, LogOut, Menu, X,
  Upload, Star, Settings2, Bell
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/analysis', icon: Brain, label: 'AI Analysis' },
  { path: '/chart-upload', icon: Upload, label: 'Chart Analyzer' },
  { path: '/signals', icon: Radio, label: 'Signals' },
  { path: '/journal', icon: BookOpen, label: 'Journal' },
  { path: '/goals', icon: Target, label: 'Goals' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  { path: '/market', icon: Globe, label: 'Market' },
  { path: '/watchlist', icon: Star, label: 'Watchlist' },
  { path: '/academy', icon: GraduationCap, label: 'Academy' },
  { path: '/challenges', icon: Swords, label: 'Challenges' },
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/settings', icon: Settings2, label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [alertsOpen, setAlertsOpen] = React.useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0B0E11' }}>
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[#2A2F3A] bg-[#0B0E11] shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#2A2F3A]">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00F5A0, #00D9F5)' }}>
            <TrendingUp className="w-5 h-5 text-black" />
          </div>
          <span className="text-lg font-extrabold tracking-tighter uppercase gradient-text">TradeAI</span>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-[#00F5A0]/10 text-[#00F5A0] border border-[#00F5A0]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`
              }
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[#2A2F3A]">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#1E2329] flex items-center justify-center text-[#00F5A0] font-bold text-xs">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{user?.username}</p>
              <p className="text-xs text-slate-500">Lv.{user?.level || 1} · {user?.xp || 0} XP</p>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-[#2A2F3A] bg-[#0B0E11]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00F5A0, #00D9F5)' }}>
            <TrendingUp className="w-4 h-4 text-black" />
          </div>
          <span className="text-base font-extrabold tracking-tighter uppercase gradient-text">TradeAI</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white p-1">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-[#15191E] border-b border-[#2A2F3A] p-3 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <nav className="grid grid-cols-3 gap-2">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-[#00F5A0]/10 text-[#00F5A0]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full mt-3 py-2.5 rounded-lg text-sm text-red-400 bg-red-500/5">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto lg:pt-0 pt-14 flex flex-col">
        <MarketTicker />
        {/* Alerts Button - Fixed Position */}
        <button
          onClick={() => setAlertsOpen(true)}
          className="fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-[#FFD60A] to-[#FF9500] text-black shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          data-testid="open-alerts-btn"
        >
          <Bell className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
      
      {/* Alerts Panel */}
      <AlertsPanel isOpen={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </div>
  );
}
