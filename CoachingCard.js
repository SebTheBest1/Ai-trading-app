import React from 'react';
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb, Target, Award } from 'lucide-react';

export default function CoachingCard({ coaching }) {
  if (!coaching) return null;

  const gradeColors = {
    'A+': { bg: 'bg-[#00F5A0]/10', border: 'border-[#00F5A0]/30', text: 'text-[#00F5A0]', icon: '🏆' },
    'A': { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: '⭐' },
    'B': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: '👍' },
    'C': { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: '💡' },
    'D': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: '📚' }
  };

  const gradeStyle = gradeColors[coaching.overall_grade] || gradeColors['B'];

  return (
    <div className={`rounded-xl border ${gradeStyle.border} ${gradeStyle.bg} p-5 space-y-4 animate-fade-in`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${gradeStyle.bg} flex items-center justify-center border ${gradeStyle.border}`}>
            <Brain className={`w-6 h-6 ${gradeStyle.text}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>AI Coach Feedback</span>
              <span className="text-2xl">{gradeStyle.icon}</span>
            </h3>
            <p className="text-sm text-slate-400">{coaching.summary}</p>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-lg ${gradeStyle.bg} border ${gradeStyle.border}`}>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Grade</p>
          <p className={`text-3xl font-bold ${gradeStyle.text}`}>{coaching.overall_grade}</p>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Strengths */}
        {coaching.strengths && coaching.strengths.length > 0 && (
          <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
            <h4 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" /> What You Did Well
            </h4>
            <ul className="space-y-2">
              {coaching.strengths.map((strength, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for Improvement */}
        {coaching.areas_for_improvement && coaching.areas_for_improvement.length > 0 && (
          <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
            <h4 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" /> Areas to Improve
            </h4>
            <ul className="space-y-2">
              {coaching.areas_for_improvement.map((area, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Detailed Feedback Sections */}
      <div className="space-y-3">
        
        {/* Risk Management */}
        {coaching.risk_management_feedback && (
          <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
            <h4 className="text-xs font-bold text-[#00D9F5] mb-2 flex items-center gap-2 uppercase tracking-wider">
              <Target className="w-4 h-4" /> Risk Management
            </h4>
            <p className="text-sm text-slate-300">{coaching.risk_management_feedback}</p>
          </div>
        )}

        {/* Entry & Exit Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {coaching.entry_analysis && (
            <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
              <h4 className="text-xs font-bold text-[#00F5A0] mb-2 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" /> Entry Analysis
              </h4>
              <p className="text-sm text-slate-300">{coaching.entry_analysis}</p>
            </div>
          )}
          
          {coaching.exit_analysis && (
            <div className="p-4 rounded-lg bg-[#0B0E11] border border-[#2A2F3A]">
              <h4 className="text-xs font-bold text-[#A78BFA] mb-2 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 rotate-180" /> Exit Analysis
              </h4>
              <p className="text-sm text-slate-300">{coaching.exit_analysis}</p>
            </div>
          )}
        </div>

        {/* Psychological Notes */}
        {coaching.psychological_notes && (
          <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <h4 className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
              <Brain className="w-4 h-4" /> Psychology & Discipline
            </h4>
            <p className="text-sm text-slate-300">{coaching.psychological_notes}</p>
          </div>
        )}

        {/* Key Lesson */}
        {coaching.key_lesson && (
          <div className="p-4 rounded-lg bg-[#FFD60A]/5 border border-[#FFD60A]/20">
            <h4 className="text-xs font-bold text-[#FFD60A] mb-2 flex items-center gap-2 uppercase tracking-wider">
              <Lightbulb className="w-4 h-4" /> Key Takeaway
            </h4>
            <p className="text-sm font-medium text-white">{coaching.key_lesson}</p>
          </div>
        )}

        {/* Next Trade Tip */}
        {coaching.next_trade_tip && (
          <div className="p-4 rounded-lg bg-[#00F5A0]/5 border border-[#00F5A0]/20">
            <h4 className="text-xs font-bold text-[#00F5A0] mb-2 flex items-center gap-2 uppercase tracking-wider">
              <Award className="w-4 h-4" /> For Your Next Trade
            </h4>
            <p className="text-sm font-medium text-white">{coaching.next_trade_tip}</p>
          </div>
        )}
      </div>
    </div>
  );
}
