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
      type?: 'theory' | 'coding';
      answers: Array<{
        id: number;
        answerText: string;
        code?: string | null;
        language?: string | null;
        score: number | null;
        rating?: 'Poor' | 'Average' | 'Good' | 'Excellent' | null;
        feedback: string | null;
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
          userAnswer: a.answerText,
          feedback: a.feedback ?? undefined,
          score: a.score === null ? 0 : a.score * 10,
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
        <div className="p-20 text-center text-gray-500 dark:text-slate-400 font-bold">Syncing Results...</div>
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
      <div className="max-w-5xl mx-auto px-4 py-12 transition-colors duration-200">
        <header className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
          <div>
            <Link to="/dashboard" className="text-blue-600 dark:text-blue-400 font-bold mb-4 inline-block hover:underline">← Back to Dashboard</Link>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-slate-100">Interview Evaluation</h1>
            <p className="text-gray-500 dark:text-slate-400 mt-2">Comprehensive breakdown of your session on {new Date(viewModel.date).toLocaleDateString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl shadow-blue-50 dark:shadow-none border border-gray-100 dark:border-slate-700 flex items-center gap-8 px-10 transition-colors">
            <div className="text-center">
              <div className={`text-5xl font-black mb-1 ${getScoreColor(viewModel.score)}`}>{viewModel.score}%</div>
              <div className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Total Score</div>
            </div>
            <div className="h-12 w-px bg-gray-100 dark:bg-slate-700"></div>
            <div className="text-center">
              <div className="flex text-yellow-400 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className={`w-6 h-6 ${i < viewModel.overallRating ? 'fill-current' : 'text-gray-200 dark:text-slate-700'}`} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ))}
              </div>
              <div className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Global Rating</div>
            </div>
          </div>
        </header>

        <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 md:p-12 border border-gray-100 dark:border-slate-700 shadow-sm mb-12 transition-colors">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">✓</span>
            Overall AI Feedback
          </h2>
          <div className="prose prose-blue dark:prose-invert max-w-none text-gray-700 dark:text-slate-300 leading-relaxed text-lg">
            {viewModel.feedback || 'No summary yet.'}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold mb-8 text-slate-900 dark:text-slate-100">Question Breakdown</h2>
          {viewModel.transcript.map((item: any, index: number) => (
            <div key={index} className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden mb-8 transition-colors">
              <div className="p-8 flex flex-col md:flex-row gap-10">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Question {index + 1}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-8 leading-tight">{item.questionText}</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 ml-1">Your Answer</h4>
                      <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl text-slate-600 dark:text-slate-300 text-sm leading-relaxed border-2 border-dashed border-blue-400/40 dark:border-blue-900/40">
                        {item.userAnswer}
                      </div>
                    </div>
                    {item.codingAnswer && (
                      <div>
                        <h4 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 ml-1">Code Submission</h4>
                        <pre className="p-6 bg-slate-950 dark:bg-black text-emerald-400 rounded-3xl font-mono text-sm overflow-x-auto shadow-inner">
                          {item.codingAnswer}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full md:w-96 p-8 bg-blue-50/30 dark:bg-blue-900/20 rounded-[2rem] flex flex-col gap-6 border border-blue-50 dark:border-blue-900/30 relative overflow-hidden transition-colors">
                   <div className="relative z-10">
                    <h4 className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-4">Correction / Suggestion</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium italic leading-relaxed">
                      {item.feedback || "Review your approach for optimization and clarity. Ensure you're addressing the core logic efficiently."}
                    </p>
                  </div>
                  <div className="mt-auto pt-6 border-t border-blue-100 dark:border-blue-900/30 flex items-center justify-between relative z-10">
                    <span className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item Score</span>
                    <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{item.score || 0}/100</span>
                  </div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/20 dark:bg-blue-400/10 rounded-bl-[4rem]"></div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </Layout>
  );
};

export default Result;
