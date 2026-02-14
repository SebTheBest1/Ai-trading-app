import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { GraduationCap, BookOpen, CheckCircle2, ChevronRight, Award, Clock, HelpCircle, Sparkles, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function AcademyPage() {
  const { authHeaders, API } = useAuth();
  const [data, setData] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLessons(); }, []);

  const loadLessons = async () => {
    try {
      const res = await axios.get(`${API}/academy/lessons`, authHeaders());
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load lessons');
    }
    setLoading(false);
  };

  const completeLesson = async (lessonId) => {
    try {
      const res = await axios.post(`${API}/academy/complete/${lessonId}`, {}, authHeaders());
      toast.success(`Lesson completed! +${res.data.xp_earned || 0} XP`);
      loadLessons();
    } catch (err) {
      toast.error('Failed to complete lesson');
    }
  };

  const submitQuiz = async () => {
    if (selectedAnswer === null) return;
    try {
      const res = await axios.post(`${API}/academy/quiz/${selectedLesson.id}`, {
        lesson_id: selectedLesson.id,
        answer_index: selectedAnswer
      }, authHeaders());
      setQuizResult(res.data);
      if (res.data.correct) {
        toast.success(`Correct! +${res.data.xp_earned} XP`);
      } else {
        toast.error('Incorrect. Try again next time!');
      }
    } catch (err) {
      toast.error('Failed to submit quiz');
    }
  };

  const closeLesson = () => {
    setSelectedLesson(null);
    setShowQuiz(false);
    setSelectedAnswer(null);
    setQuizResult(null);
  };

  const overallProgress = data ? (data.completed_count / data.total_count * 100) : 0;
  const diffColors = { beginner: '#00F5A0', intermediate: '#FFD60A', advanced: '#F6465D' };
  const diffBg = { beginner: 'rgba(0, 245, 160, 0.1)', intermediate: 'rgba(255, 214, 10, 0.1)', advanced: 'rgba(246, 70, 93, 0.1)' };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#00F5A0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in" data-testid="academy-page">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
          <span className="gradient-text">Trading Academy</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Master the markets with {data?.total_count || 0} interactive lessons</p>
      </div>

      {/* Progress Overview */}
      <div className="glass-card rounded-xl p-5 neon-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center gradient-bg">
              <GraduationCap className="w-6 h-6 text-[#00F5A0]" />
            </div>
            <div>
              <p className="text-sm font-bold">Your Learning Progress</p>
              <p className="text-xs text-slate-500">{data?.completed_count || 0} of {data?.total_count || 0} lessons completed</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold font-mono gradient-text">{overallProgress.toFixed(0)}%</span>
            <p className="text-xs text-slate-500">Complete</p>
          </div>
        </div>
        <div className="h-3 rounded-full bg-[#1E2329] overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out" 
            style={{ 
              width: `${overallProgress}%`, 
              background: 'linear-gradient(90deg, #00F5A0, #00D9F5)' 
            }} 
          />
        </div>
        <div className="flex justify-between mt-3 text-xs text-slate-500">
          <span>Beginner</span>
          <span>Intermediate</span>
          <span>Advanced</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[#00F5A0] font-mono">{data?.modules ? Object.keys(data.modules).length : 0}</div>
          <div className="text-xs text-slate-500">Modules</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[#00D9F5] font-mono">{data?.total_count || 0}</div>
          <div className="text-xs text-slate-500">Lessons</div>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[#FFD60A] font-mono">{data?.completed_count || 0}</div>
          <div className="text-xs text-slate-500">Completed</div>
        </div>
      </div>

      {/* Lesson Detail Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={closeLesson}>
          <div 
            className="glass-modal rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in-scale" 
            onClick={e => e.stopPropagation()} 
            data-testid="lesson-detail"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide" 
                      style={{ color: diffColors[selectedLesson.difficulty], background: diffBg[selectedLesson.difficulty] }}
                    >
                      {selectedLesson.difficulty}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {selectedLesson.duration}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold">{selectedLesson.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedLesson.module}</p>
                </div>
                <button 
                  onClick={closeLesson}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {!showQuiz ? (
                <>
                  {/* Lesson Content */}
                  <div className="p-5 rounded-xl bg-[#0B0E11] border border-[#2A2F3A] mb-6">
                    <p className="text-slate-300 leading-relaxed">{selectedLesson.content}</p>
                  </div>

                  {/* XP Reward */}
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[#00F5A0]/5 border border-[#00F5A0]/20 mb-6">
                    <Award className="w-8 h-8 text-[#00F5A0]" />
                    <div>
                      <p className="text-sm font-bold text-[#00F5A0]">+{selectedLesson.xp} XP</p>
                      <p className="text-xs text-slate-500">Complete this lesson to earn XP</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {!selectedLesson.completed ? (
                      <>
                        <Button 
                          data-testid="complete-lesson-btn" 
                          onClick={() => { completeLesson(selectedLesson.id); setSelectedLesson({...selectedLesson, completed: true}); }}
                          className="flex-1 bg-gradient-to-r from-[#00F5A0] to-[#00D9F5] text-black hover:opacity-90 font-bold h-12"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Complete
                        </Button>
                        {selectedLesson.quiz && selectedLesson.quiz.length > 0 && (
                          <Button 
                            data-testid="take-quiz-btn"
                            onClick={() => setShowQuiz(true)}
                            variant="outline"
                            className="border-[#00D9F5] text-[#00D9F5] hover:bg-[#00D9F5]/10 h-12"
                          >
                            <HelpCircle className="w-4 h-4 mr-2" /> Take Quiz
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 py-3 text-center rounded-xl bg-[#00F5A0]/10 border border-[#00F5A0]/30">
                        <div className="text-[#00F5A0] font-bold flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-5 h-5" /> Lesson Completed!
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Quiz Section */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-[#FFD60A]" />
                      <h3 className="text-lg font-bold">Quiz Time!</h3>
                    </div>
                    
                    {selectedLesson.quiz && selectedLesson.quiz.map((q, qi) => (
                      <div key={qi} className="p-5 rounded-xl bg-[#0B0E11] border border-[#2A2F3A]">
                        <p className="text-sm font-medium mb-4">{q.q}</p>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => (
                            <button
                              key={oi}
                              onClick={() => !quizResult && setSelectedAnswer(oi)}
                              disabled={quizResult !== null}
                              className={`w-full p-3 rounded-lg text-left text-sm transition-all ${
                                quizResult !== null
                                  ? oi === q.answer
                                    ? 'bg-[#00F5A0]/20 border-2 border-[#00F5A0]'
                                    : selectedAnswer === oi
                                      ? 'bg-[#F6465D]/20 border-2 border-[#F6465D]'
                                      : 'bg-[#1E2329] border border-[#2A2F3A] opacity-50'
                                  : selectedAnswer === oi
                                    ? 'bg-[#00D9F5]/10 border-2 border-[#00D9F5]'
                                    : 'bg-[#1E2329] border border-[#2A2F3A] hover:border-[#00D9F5]/50'
                              }`}
                              data-testid={`quiz-option-${oi}`}
                            >
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2A2F3A] text-xs mr-3">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quiz Result */}
                  {quizResult && (
                    <div className={`p-4 rounded-xl mb-4 ${quizResult.correct ? 'bg-[#00F5A0]/10 border border-[#00F5A0]/30' : 'bg-[#F6465D]/10 border border-[#F6465D]/30'}`}>
                      <p className={`font-bold ${quizResult.correct ? 'text-[#00F5A0]' : 'text-[#F6465D]'}`}>
                        {quizResult.correct ? '🎉 Correct! +10 XP' : '❌ Incorrect. Review the material and try again!'}
                      </p>
                    </div>
                  )}

                  {/* Quiz Actions */}
                  <div className="flex items-center gap-3">
                    {!quizResult ? (
                      <>
                        <Button 
                          onClick={submitQuiz}
                          disabled={selectedAnswer === null}
                          className="flex-1 bg-gradient-to-r from-[#FFD60A] to-[#FF9500] text-black hover:opacity-90 font-bold h-12 disabled:opacity-50"
                          data-testid="submit-quiz-btn"
                        >
                          Submit Answer
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => { setShowQuiz(false); setSelectedAnswer(null); }}
                          className="border-[#2A2F3A] text-slate-400"
                        >
                          Back
                        </Button>
                      </>
                    ) : (
                      <Button 
                        onClick={closeLesson}
                        className="flex-1 bg-[#1E2329] hover:bg-[#2A2F3A] h-12"
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modules */}
      {data?.modules && Object.entries(data.modules).map(([module, lessons]) => {
        const modCompleted = lessons.filter(l => l.completed).length;
        const moduleProgress = (modCompleted / lessons.length) * 100;
        return (
          <div key={module} className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-[#2A2F3A]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#1E2329]">
                    <BookOpen className="w-5 h-5 text-[#00D9F5]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">{module}</h3>
                    <p className="text-xs text-slate-500">{lessons.length} lessons • {modCompleted} completed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono text-[#00F5A0]">{moduleProgress.toFixed(0)}%</p>
                  </div>
                  <div className="w-16 h-2 rounded-full bg-[#1E2329] overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-[#00F5A0] to-[#00D9F5] transition-all duration-500" 
                      style={{ width: `${moduleProgress}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-[#1E2329]">
              {lessons.map((lesson, i) => (
                <button 
                  key={lesson.id} 
                  onClick={() => setSelectedLesson(lesson)} 
                  data-testid={`lesson-${lesson.id}`}
                  className={`w-full flex items-center justify-between p-4 transition-all text-left hover:bg-white/[0.02] ${
                    lesson.completed ? 'bg-[#00F5A0]/[0.02]' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      lesson.completed 
                        ? 'bg-[#00F5A0]/20 text-[#00F5A0]' 
                        : 'bg-[#1E2329] text-slate-500'
                    }`}>
                      {lesson.completed ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lesson.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase"
                          style={{ color: diffColors[lesson.difficulty], background: diffBg[lesson.difficulty] }}
                        >
                          {lesson.difficulty}
                        </span>
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {lesson.duration}
                        </span>
                        {lesson.quiz && lesson.quiz.length > 0 && (
                          <span className="text-[10px] text-[#FFD60A] flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" /> Quiz
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#00F5A0] font-mono font-bold">+{lesson.xp} XP</span>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
