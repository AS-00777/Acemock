import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { normalizeConfidence, type ConfidenceLevel } from '../utils/confidence';

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
      type?: 'theory' | 'coding' | 'mcq' | 'practical' | 'scenario';
      answers: Array<{
        id: number;
        answerText: string;
        rawTranscript?: string | null;
        correctedTranscript?: string | null;
        code?: string | null;
        language?: string | null;
        score: number | null;
        finalScore?: number | null;
        factorScores?: Record<string, number> | null;
        matchedConcepts?: string[];
        missingConcepts?: string[];
        rating?: 'Poor' | 'Average' | 'Good' | 'Excellent' | null;
        feedback: string | null;
        strengths?: string | null;
        weaknesses?: string | null;
        suggestions?: string | null;
        confidenceScore?: number | string | null;
        confidenceLevel?: 'High' | 'Medium' | 'Low' | null;
        confidenceReasons?: string[];
        confidenceTips?: string[];
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

const theoryFactorLabels: Array<[string, string]> = [
  ['relevance', 'Relevance'],
  ['technicalAccuracy', 'Technical Accuracy'],
  ['completeness', 'Completeness'],
  ['communicationClarity', 'Communication'],
  ['structureOrganization', 'Structure'],
  ['examplesPracticalKnowledge', 'Examples'],
  ['confidenceFluency', 'Fluency'],
];

const codingFactorLabels: Array<[string, string]> = [
  ['correctness', 'Correctness'],
  ['logicProblemSolving', 'Logic'],
  ['timeComplexity', 'Time Complexity'],
  ['spaceComplexity', 'Space Complexity'],
  ['codeQuality', 'Code Quality'],
  ['edgeCaseHandling', 'Edge Cases'],
  ['explanationCommunication', 'Explanation'],
];

function getRubricFactors(type: 'theory' | 'coding' | 'mcq' | 'practical' | 'scenario' | undefined, factorScores?: Record<string, number> | null) {
  const labels = type === 'coding' ? codingFactorLabels : theoryFactorLabels;
  return labels.map(([key, label]) => ({
    label,
    value: typeof factorScores?.[key] === 'number' ? factorScores[key] : undefined,
  }));
}

function getConfidenceTone(level: ConfidenceLevel | null) {
  if (level === 'High') return 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30';
  if (level === 'Medium') return 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30';
  if (level === 'Low') return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
  return 'text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800';
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
          userAnswer: a.correctedTranscript?.trim() || a.answerText,
          rawTranscript: a.rawTranscript ?? undefined,
          correctedTranscript: a.correctedTranscript ?? undefined,
          feedback: a.feedback ?? undefined,
          score: a.finalScore ?? (a.score === null ? 0 : a.score * 10),
          type: q.type ?? 'theory',
          factorScores: a.factorScores ?? null,
          matchedConcepts: a.matchedConcepts ?? [],
          missingConcepts: a.missingConcepts ?? [],
          strengths: a.strengths ?? undefined,
          weaknesses: a.weaknesses ?? undefined,
          suggestions: a.suggestions ?? undefined,
          confidenceScore: a.confidenceScore ?? undefined,
          confidenceReasons: a.confidenceReasons ?? [],
          confidenceTips: a.confidenceTips ?? [],
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
                      <div className="flex items-center gap-2 mb-3 ml-1">
                        <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                          Your Answer
                        </h4>
                        {item.correctedTranscript && (
                          <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-[10px] font-black uppercase tracking-widest">
                            Cleaned transcript
                          </span>
                        )}
                      </div>
                      <div className="min-h-16 p-5 sm:p-6 bg-slate-50/50 dark:bg-neutral-950/50 rounded-2xl text-slate-600 dark:text-neutral-300 text-sm leading-relaxed border-2 border-dashed border-blue-400/40 dark:border-blue-900/40">
                        {item.userAnswer || <span className="text-slate-400 dark:text-neutral-400">No verbal answer provided.</span>}
                      </div>
                    </div>
                    {item.codingAnswer && (
                      <div>
                        <h4 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 ml-1">Code Submission</h4>
                        <div className="max-w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/70 shadow-sm">
                          <pre className="max-h-[420px] max-w-full overflow-auto p-4 sm:p-6 font-mono text-xs sm:text-sm leading-6 text-slate-800 dark:text-neutral-100 whitespace-pre tab-4">
                            <code className="block min-w-max">{item.codingAnswer}</code>
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="w-full p-5 sm:p-6 bg-blue-50/50 dark:bg-neutral-900 rounded-3xl flex flex-col gap-5 border border-blue-100 dark:border-neutral-800 relative overflow-hidden transition-colors">
                   <div className="relative z-10">
                    <h4 className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-4">Correction / Suggestion</h4>
                    <FormattedFeedback compact text={item.suggestions || item.feedback || "Review the weakest rubric areas and add concrete details, tradeoffs, and edge cases where relevant."} />
                  </div>
                  <div className="relative z-10 grid grid-cols-2 gap-3">
                    <h4 className="col-span-2 text-[10px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Rubric Factors</h4>
                    {getRubricFactors(item.type, item.factorScores).map(({ label, value }) => (
                      <div key={label} className="rounded-2xl bg-white/70 dark:bg-neutral-950/70 border border-blue-100 dark:border-neutral-800 p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">{label}</div>
                        <div className="text-lg font-black text-slate-900 dark:text-neutral-100">{typeof value === 'number' ? `${value}%` : 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const confidence = normalizeConfidence(item.confidenceScore);
                    return (
                    <div className="relative z-10 rounded-2xl bg-white/70 dark:bg-neutral-950/70 border border-blue-100 dark:border-neutral-800 p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="text-[10px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Communication Confidence Estimate</h4>
                          <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-neutral-500">Not a guaranteed measure of confidence.</p>
                        </div>
                        <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getConfidenceTone(confidence.level)}`}>
                          {confidence.level ?? 'Not available'}
                        </span>
                      </div>
                      {confidence.score === null ? (
                        <p className="text-sm font-semibold text-slate-500 dark:text-neutral-400">Confidence score is not available.</p>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-3 rounded-full bg-slate-200 dark:bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 dark:bg-blue-400 transition-[width] duration-300"
                              style={{ width: `${confidence.score}%` }}
                            />
                          </div>
                          <div className="text-lg font-black text-slate-900 dark:text-neutral-100 tabular-nums">{confidence.score}%</div>
                        </div>
                      )}
                      {item.confidenceReasons.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {item.confidenceReasons.slice(0, 3).map((reason: string) => (
                            <p key={reason} className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{reason}</p>
                          ))}
                        </div>
                      )}
                      {item.confidenceTips.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-blue-100 dark:border-neutral-800">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-2">Improve</h5>
                          <p className="text-xs font-semibold leading-5 text-slate-600 dark:text-neutral-300">{item.confidenceTips[0]}</p>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                  {item.feedback && (
                    <div className="relative z-10">
                      <h4 className="text-[10px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest mb-2">Feedback</h4>
                      <FormattedFeedback compact text={item.feedback} />
                    </div>
                  )}
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
