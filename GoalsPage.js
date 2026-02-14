import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Target, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';

export default function GoalsPage() {
  const { authHeaders, API } = useAuth();
  const [goals, setGoals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', target_profit: '', deadline: '', description: '' });

  useEffect(() => { loadGoals(); }, []);

  const loadGoals = async () => {
    try {
      const res = await axios.get(`${API}/goals`, authHeaders());
      setGoals(res.data.goals || []);
    } catch {}
  };

  const addGoal = async () => {
    try {
      await axios.post(`${API}/goals`, {
        ...form,
        target_profit: parseFloat(form.target_profit),
      }, authHeaders());
      setShowAdd(false);
      setForm({ title: '', target_profit: '', deadline: '', description: '' });
      loadGoals();
    } catch {}
  };

  const deleteGoal = async (id) => {
    try {
      await axios.delete(`${API}/goals/${id}`, authHeaders());
      loadGoals();
    } catch {}
  };

  const active = goals.filter(g => g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="goals-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
            <span className="gradient-text">Trading Goals</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Set targets and track progress automatically</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button data-testid="add-goal-btn" className="bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold shadow-[0_0_15px_rgba(0,245,160,0.3)]">
              <Plus className="w-4 h-4 mr-1" /> New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#15191E] border-[#2A2F3A] text-white">
            <DialogHeader><DialogTitle className="text-xl font-bold">Create Trading Goal</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label className="text-xs text-slate-400">Goal Title</Label>
                <Input data-testid="goal-title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., Monthly profit target" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
              <div><Label className="text-xs text-slate-400">Target Profit ($)</Label>
                <Input data-testid="goal-target" value={form.target_profit} onChange={e => setForm({...form, target_profit: e.target.value})} type="number" step="any" placeholder="1000" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
              <div><Label className="text-xs text-slate-400">Deadline (optional)</Label>
                <Input value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} type="date" className="bg-[#0B0E11] border-[#2A2F3A] text-white mt-1" /></div>
              <div><Label className="text-xs text-slate-400">Description</Label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full mt-1 rounded-lg bg-[#0B0E11] border border-[#2A2F3A] text-white text-sm p-3 resize-none" placeholder="Optional notes..." /></div>
              <Button data-testid="submit-goal-btn" onClick={addGoal} className="w-full bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold">Create Goal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Goals */}
      {active.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Active Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((g, i) => {
              const progress = Math.min(100, Math.max(0, (g.current_profit / g.target_profit) * 100));
              return (
                <div key={g.id} className="glass-card rounded-xl p-5 hover-lift" data-testid={`goal-${i}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{g.title}</h3>
                      {g.description && <p className="text-xs text-slate-400 mt-1">{g.description}</p>}
                    </div>
                    <button onClick={() => deleteGoal(g.id)} className="text-slate-600 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Progress</span>
                      <span className="text-sm font-mono font-bold" style={{ color: progress >= 100 ? '#00F5A0' : '#00D9F5' }}>
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-[#1E2329] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progress}%`, background: progress >= 100 ? '#00F5A0' : 'linear-gradient(90deg, #00F5A0, #00D9F5)' }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      <span className="font-mono text-white">${g.current_profit?.toFixed(2)}</span> / ${g.target_profit?.toFixed(2)}
                    </span>
                    {g.deadline && <span className="text-slate-500">Due: {g.deadline}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#00F5A0]" /> Completed
          </h2>
          <div className="space-y-2">
            {completed.map((g, i) => (
              <div key={g.id} className="glass-card rounded-xl p-4 flex items-center justify-between border border-[#00F5A0]/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00F5A0]/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-[#00F5A0]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{g.title}</p>
                    <p className="text-xs text-slate-500">Target: ${g.target_profit} · Achieved: ${g.current_profit?.toFixed(2)}</p>
                  </div>
                </div>
                <button onClick={() => deleteGoal(g.id)} className="text-slate-600 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No Goals Set</h3>
          <p className="text-sm text-slate-500 mt-1">Create a trading goal to start tracking your progress</p>
        </div>
      )}
    </div>
  );
}
