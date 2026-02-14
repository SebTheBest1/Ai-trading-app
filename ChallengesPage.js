import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Swords, CheckCircle2, Flame, Star, Zap, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function ChallengesPage() {
  const { authHeaders, API } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => { loadChallenges(); }, []);

  const loadChallenges = async () => {
    try {
      const res = await axios.get(`${API}/challenges`, authHeaders());
      setData(res.data);
    } catch {}
  };

  const completeChallenge = async (id) => {
    try {
      await axios.post(`${API}/challenges/complete`, { challenge_id: id }, authHeaders());
      loadChallenges();
    } catch {}
  };

  const dailyCompleted = data?.daily?.filter(c => c.completed).length || 0;
  const weeklyCompleted = data?.weekly?.filter(c => c.completed).length || 0;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="challenges-page">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
          <span className="gradient-text">Challenges & Quests</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Complete challenges to earn XP and level up</p>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Daily Quests</h3>
              <p className="text-xs text-slate-500">{dailyCompleted}/{data?.daily?.length || 0} completed today</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-[#1E2329] overflow-hidden">
            <div className="h-full rounded-full bg-orange-400 transition-all duration-500" style={{ width: `${data?.daily?.length ? (dailyCompleted / data.daily.length * 100) : 0}%` }} />
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Star className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Weekly Challenges</h3>
              <p className="text-xs text-slate-500">{weeklyCompleted}/{data?.weekly?.length || 0} completed this week</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-[#1E2329] overflow-hidden">
            <div className="h-full rounded-full bg-purple-400 transition-all duration-500" style={{ width: `${data?.weekly?.length ? (weeklyCompleted / data.weekly.length * 100) : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Daily Challenges */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" /> Daily Quests
        </h2>
        <div className="space-y-2">
          {data?.daily?.map((c, i) => (
            <div key={c.id} className={`glass-card rounded-xl p-4 flex items-center justify-between hover-lift ${c.completed ? 'border border-[#00F5A0]/20' : ''}`}
              data-testid={`daily-challenge-${i}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.completed ? 'bg-[#00F5A0]/20' : 'bg-[#1E2329]'}`}>
                  {c.completed ? <CheckCircle2 className="w-5 h-5 text-[#00F5A0]" /> : <Swords className="w-5 h-5 text-slate-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">{c.title}</h3>
                  <p className="text-xs text-slate-500">{c.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold font-mono text-[#00F5A0]">+{c.xp} XP</span>
                {!c.completed && (
                  <Button data-testid={`complete-daily-${i}`} size="sm" onClick={() => completeChallenge(c.id)}
                    className="bg-[#00F5A0]/20 text-[#00F5A0] hover:bg-[#00F5A0]/30 border border-[#00F5A0]/30 text-xs">
                    Complete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Challenges */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-purple-400" /> Weekly Challenges
        </h2>
        <div className="space-y-2">
          {data?.weekly?.map((c, i) => (
            <div key={c.id} className={`glass-card rounded-xl p-4 flex items-center justify-between hover-lift ${c.completed ? 'border border-purple-500/20' : ''}`}
              data-testid={`weekly-challenge-${i}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.completed ? 'bg-purple-500/20' : 'bg-[#1E2329]'}`}>
                  {c.completed ? <CheckCircle2 className="w-5 h-5 text-purple-400" /> : <Star className="w-5 h-5 text-slate-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">{c.title}</h3>
                  <p className="text-xs text-slate-500">{c.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold font-mono text-purple-400">+{c.xp} XP</span>
                {!c.completed && (
                  <Button data-testid={`complete-weekly-${i}`} size="sm" onClick={() => completeChallenge(c.id)}
                    className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 text-xs">
                    Complete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#FFD60A]" /> Achievements
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {data?.achievements?.map((a, i) => (
            <div key={a.id} className="glass-card rounded-xl p-4 text-center hover-lift" data-testid={`achievement-${a.id}`}>
              <div className="w-12 h-12 rounded-full bg-[#1E2329] flex items-center justify-center mx-auto mb-2">
                <Zap className="w-6 h-6 text-[#FFD60A]" />
              </div>
              <p className="text-xs font-bold mb-1">{a.title}</p>
              <p className="text-[10px] text-slate-500">{a.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
