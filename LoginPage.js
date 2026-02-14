import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { TrendingUp, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [traderType, setTraderType] = useState('swing');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(username, email, password, traderType);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#0B0E11' }}>
      {/* Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,245,160,0.15), transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,217,245,0.15), transparent 70%)', filter: 'blur(80px)' }} />
      </div>
      <div className="scanline-overlay" />

      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00F5A0, #00D9F5)' }}>
            <TrendingUp className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase gradient-text">TradeAI Pro</h1>
        </div>

        {/* Form Card */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-2">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-slate-400 text-center mb-6">
            {isRegister ? 'Start your trading journey' : 'Sign in to your trading dashboard'}
          </p>

          {error && (
            <div data-testid="auth-error" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-2 animate-fade-in">
                <Label className="text-slate-300 text-sm">Username</Label>
                <Input
                  data-testid="register-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="traderpro"
                  required
                  className="bg-[#0B0E11] border-[#2A2F3A] text-white placeholder-slate-600 focus:border-[#00F5A0] focus:ring-1 focus:ring-[#00F5A0]"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Email</Label>
              <Input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@example.com"
                required
                className="bg-[#0B0E11] border-[#2A2F3A] text-white placeholder-slate-600 focus:border-[#00F5A0] focus:ring-1 focus:ring-[#00F5A0]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Password</Label>
              <div className="relative">
                <Input
                  data-testid="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="bg-[#0B0E11] border-[#2A2F3A] text-white placeholder-slate-600 focus:border-[#00F5A0] focus:ring-1 focus:ring-[#00F5A0] pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {isRegister && (
              <div className="space-y-2 animate-fade-in">
                <Label className="text-slate-300 text-sm">Trader Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['swing', 'day'].map(t => (
                    <button
                      key={t}
                      type="button"
                      data-testid={`trader-type-${t}`}
                      onClick={() => setTraderType(t)}
                      className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${traderType === t ? 'bg-[#00F5A0]/20 border border-[#00F5A0]/50 text-[#00F5A0]' : 'bg-[#1E2329] border border-[#2A2F3A] text-slate-400 hover:text-white'}`}
                    >
                      {t === 'swing' ? 'Swing Trader' : 'Day Trader'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold transition-all duration-200 shadow-[0_0_15px_rgba(0,245,160,0.3)] h-11"
            >
              {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              data-testid="toggle-auth-mode"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-sm text-slate-400 hover:text-[#00F5A0] transition-colors"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
