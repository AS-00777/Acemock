import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

type InterviewDetails = {
  interview: {
    id: number;
    role: string;
    status: 'IN_PROGRESS' | 'COMPLETED';
    createdAt: string;
    questions: Array<{
      id: number;
      questionText: string;
      expectedAnswer?: string | null;
      keyConcepts?: string[];
      topic?: string | null;
      difficulty?: 'easy' | 'medium' | 'hard' | null;
      type?: 'theory' | 'coding';
      answers: Array<{
        id: number;
        answerText: string;
        code?: string | null;
        language?: string | null;
        score: number | null;
        technicalAccuracy?: number | null;
        conceptCoverage?: number | null;
        communicationScore?: number | null;
        semanticSimilarity?: number | null;
        finalScore?: number | null;
        matchedConcepts?: string[];
        missingConcepts?: string[];
        rating?: 'Poor' | 'Average' | 'Good' | 'Excellent' | null;
        feedback: string | null;
        strengths?: string | null;
        weaknesses?: string | null;
        createdAt: string;
      }>;
    }>;
    result: null | {
      overallScore: number;
      summary: string;
      createdAt: string;
    };
  };
};

function formatFeedbackLines(text?: string) {
  const normalized = String(text || '')
    .replace(/\r/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+-\s+/g, '\n- ')
    .replace(/\s+(Summary|Strengths|Weaknesses|Next-Step Recommendations|Recommendations|Code Quality Feedback|Positive Aspects|Areas for Improvement|Logical Issues|Optimization Suggestions):/gi, '\n$1:\n')
    .replace(/\s+(\d+\.\s+)/g, '\n$1')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return normalized.length ? normalized : ['No feedback available yet.'];
}

function FormattedFeedback({ text, compact = false }: { text?: string; compact?: boolean }) {
  const lines = formatFeedbackLines(text);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {lines.map((line, index) => {
        const isHeading = /^[A-Za-z][A-Za-z -]+:$/.test(line);
        const isBullet = line.startsWith('- ');
        const isNumbered = /^\d+\.\s/.test(line);
        const body = isBullet ? line.slice(2).trim() : line;

        if (isHeading) {
          return (
            <div key={`${line}-${index}`} className={compact ? 'pt-1' : 'pt-2'}>
              <h3 className={`${compact ? 'text-xs' : 'text-sm'} font-black uppercase tracking-widest text-blue-700 dark:text-blue-300`}>
                {line.replace(/:$/, '')}
              </h3>
            </div>
          );
        }

        if (isBullet || isNumbered) {
          return (
            <div key={`${line}-${index}`} className="flex gap-3 rounded-2xl bg-slate-50 dark:bg-neutral-950/50 border border-slate-100 dark:border-neutral-800 px-4 py-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
              <p className={`${compact ? 'text-sm' : 'text-base'} leading-7 text-slate-700 dark:text-neutral-300`}>
                {body}
              </p>
            </div>
          );
        }

        return (
          <p key={`${line}-${index}`} className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} leading-8 text-slate-700 dark:text-neutral-300`}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

const Result: React.FC = () => {
  const { id } = useParams();
  const interviewId = Number(id);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [data, setData] = useState<InterviewDetails | null>(null);

  useEffect(() => {
    if (!Number.isFinite(interviewId) || interviewId <= 0) return;
    api
      .get<InterviewDetails>(`/interview/${interviewId}`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout();
      });
  }, [interviewId, logout]);

  const viewModel = useMemo(() => {
    if (!data) return null;
    const overallScore = data.interview.result?.overallScore ?? 0;
    const summary = data.interview.result?.summary ?? (data.interview.status === 'COMPLETED' ? '' : 'Interview is still in progress.');
    const transcript = data.interview.questions
      .map((q) => {
        const a = q.answers[0];
        if (!a) return null;
        return {
          questionText: q.questionText,
          expectedAnswer: q.expectedAnswer ?? undefined,
          keyConcepts: q.keyConcepts ?? [],
          topic: q.topic ?? undefined,
          difficulty: q.difficulty ?? undefined,
          userAnswer: a.answerText,
          feedback: a.feedback ?? undefined,
          score: a.finalScore ?? (a.score === null ? 0 : a.score * 10),
          technicalAccuracy: a.technicalAccuracy ?? undefined,
          conceptCoverage: a.conceptCoverage ?? undefined,
          communicationScore: a.communicationScore ?? undefined,
          semanticSimilarity: a.semanticSimilarity ?? undefined,
          matchedConcepts: a.matchedConcepts ?? [],
          missingConcepts: a.missingConcepts ?? [],
          strengths: a.strengths ?? undefined,
          weaknesses: a.weaknesses ?? undefined,
          codingAnswer: a.code ?? (a.answerText.includes('\n\nCODE:\n') ? a.answerText.split('\n\nCODE:\n')[1] : undefined),
          language: a.language ?? undefined,
          rating: a.rating ?? undefined,
        };
      })
      .filter(Boolean) as Array<any>;

    return {
      date: data.interview.createdAt,
      score: overallScore,
      feedback: summary,
      transcript,
      overallRating: Math.round((overallScore / 100) * 5),
    };
  }, [data]);

  if (!viewModel) {
    return (
      <Layout>
        <div className="p-20 text-center text-gray-500 dark:text-neutral-400 font-bold">Syncing Results...</div>
      </Layout>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 transition-colors duration-200">
        <header className="mb-10 sm:mb-12 flex flex-col lg:flex-row justify-between lg:items-end gap-6">
          <div>
            <Link to="/dashboard" className="text-blue-600 dark:text-blue-400 font-bold mb-4 inline-block hover:underline">← Back to Dashboard</Link>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-neutral-100">Interview Evaluation</h1>
            <p className="text-gray-500 dark:text-neutral-400 mt-2">Comprehensive breakdown of your session on {new Date(viewModel.date).toLocaleDateString()}</p>
          </div>
          <div className="w-full sm:w-auto bg-white dark:bg-neutral-900 p-5 sm:p-6 rounded-3xl shadow-xl shadow-blue-50 dark:shadow-none border border-gray-100 dark:border-neutral-800 flex items-center justify-between sm:justify-start gap-6 sm:gap-8 sm:px-10 transition-colors">
            <div className="text-center">
              <div className={`text-5xl font-black mb-1 ${getScoreColor(viewModel.score)}`}>{viewModel.score}%</div>
              <div className="text-xs font-bold text-gray-400 dark:text-neutral-400 uppercase tracking-widest">Total Score</div>
            </div>
            <div className="h-12 w-px bg-gray-100 dark:bg-neutral-800"></div>
            <div className="text-center">
              <div className="flex text-yellow-400 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className={`w-6 h-6 ${i < viewModel.overallRating ? 'fill-current' : 'text-gray-200 dark:text-neutral-700'}`} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ))}
              </div>
              <div className="text-xs font-bold text-gray-400 dark:text-neutral-400 uppercase tracking-widest">Global Rating</div>
            </div>
          </div>
        </header>

        <section className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 md:p-10 border border-gray-100 dark:border-neutral-800 shadow-sm mb-10 sm:mb-12 transition-colors">
          <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3 text-slate-900 dark:text-neutral-100">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">✓</span>
            Overall AI Feedback
          </h2>
          <div className="rounded-3xl bg-gradient-to-br from-blue-50/80 via-white to-slate-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-black border border-blue-100 dark:border-neutral-800 p-5 sm:p-7">
            <FormattedFeedback text={viewModel.feedback || 'No summary yet.'} />
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold mb-8 text-slate-900 dark:text-neutral-100">Question Breakdown</h2>
          {viewModel.transcript.map((item: any, index: number) => (
            <div key={index} className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-sm overflow-hidden mb-8 transition-colors">
              <div className="p-5 sm:p-7 lg:p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-8">
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-slate-400 dark:text-neutral-400 uppercase tracking-widest">Question {index + 1}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-neutral-100 mb-7 leading-tight">{item.questionText}</h3>
                  {item.expectedAnswer && (
                    <div className="mb-6">
                      <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-3 ml-1">Expected Answer</h4>
                      <div className="p-5 bg-emerald-50/70 dark:bg-emerald-900/20 rounded-2xl text-slate-700 dark:text-neutral-300 text-sm leading-relaxed border border-emerald-100 dark:border-emerald-900/30">
                        {item.expectedAnswer}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 ml-1">Your Answer</h4>
                      <div className="min-h-16 p-5 sm:p-6 bg-slate-50/50 dark:bg-neutral-950/50 rounded-2xl text-slate-600 dark:text-neutral-300 text-sm leading-relaxed border-2 border-dashed border-blue-400/40 dark:border-blue-900/40">
                        {item.userAnswer || <span className="text-slate-400 dark:text-neutral-400">No verbal answer provided.</span>}
                      </div>
                    </div>
                    {item.codingAnswer && (
                      <div>
                        <h4 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 ml-1">Code Submission</h4>
                        <pre className="max-h-[420px] p-5 sm:p-6 bg-slate-950 dark:bg-black text-emerald-400 rounded-3xl font-mono text-sm overflow-auto shadow-inner">
                          {item.codingAnswer}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="w-full p-5 sm:p-6 bg-blue-50/50 dark:bg-neutral-900 rounded-3xl flex flex-col gap-5 border border-blue-100 dark:border-neutral-800 relative overflow-hidden transition-colors">
                   <div className="relative z-10">
                    <h4 className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-4">Correction / Suggestion</h4>
                    <FormattedFeedback compact text={item.feedback || "Review your approach for optimization and clarity. Ensure you're addressing the core logic efficiently."} />
                  </div>
                  <div className="relative z-10 grid grid-cols-2 gap-3">
                    {[
                      ['Accuracy', item.technicalAccuracy],
                      ['Coverage', item.conceptCoverage],
                      ['Similarity', item.semanticSimilarity],
                      ['Comms', item.communicationScore],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-2xl bg-white/70 dark:bg-neutral-950/70 border border-blue-100 dark:border-neutral-800 p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">{label}</div>
                        <div className="text-lg font-black text-slate-900 dark:text-neutral-100">{typeof value === 'number' ? `${value}%` : 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                  {(item.matchedConcepts.length > 0 || item.missingConcepts.length > 0) && (
                    <div className="relative z-10 space-y-4">
                      {item.matchedConcepts.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-2">Matched Concepts</h4>
                          <div className="flex flex-wrap gap-2">
                            {item.matchedConcepts.map((concept: string) => (
                              <span key={concept} className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 text-xs font-bold">{concept}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.missingConcepts.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-2">Missing Concepts</h4>
                          <div className="flex flex-wrap gap-2">
                            {item.missingConcepts.map((concept: string) => (
                              <span key={concept} className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 text-xs font-bold">{concept}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-auto pt-5 border-t border-blue-100 dark:border-neutral-800 flex items-center justify-between relative z-10">
                    <span className="text-sm font-black text-slate-400 dark:text-neutral-400 uppercase tracking-widest">Item Score</span>
                    <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{item.score || 0}/100</span>
                  </div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/20 dark:bg-blue-400/10 rounded-bl-[4rem]"></div>
                </aside>
              </div>
            </div>
          ))}
        </section>
      </div>
    </Layout>
  );
};

export default Result;
