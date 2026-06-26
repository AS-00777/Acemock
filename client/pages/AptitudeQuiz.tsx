import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import MiniCalculator from '../components/MiniCalculator';
import { api } from '../services/api';
import type { AptitudeAnalysis, AptitudeQuestion } from '../aptitudeTypes';

type StoredTest = { testId: number; questions: AptitudeQuestion[]; durationMinutes: number; startedAt: number; title?: string };

const AptitudeQuiz: React.FC = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<StoredTest | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [times, setTimes] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);
  const answersRef = useRef(answers);
  const timesRef = useRef(times);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { timesRef.current = times; }, [times]);

  useEffect(() => {
    const raw = localStorage.getItem(`aptitude-test-${testId}`);
    if (!raw) { setError('This test session is unavailable. Start a new test from setup.'); return; }
    try {
      const parsed = JSON.parse(raw) as StoredTest;
      setTest(parsed);
      const seconds = Math.max(0, parsed.durationMinutes * 60 - Math.floor((Date.now() - parsed.startedAt) / 1000));
      setRemaining(seconds);
    } catch { setError('The saved test session is invalid.'); }
  }, [testId]);

  const submit = async (automatic = false) => {
    if (!test || submittingRef.current) return;
    if (!automatic && !window.confirm('Submit this test? You cannot change answers afterward.')) return;
    submittingRef.current = true; setSubmitting(true); setError('');
    try {
      await api.post<AptitudeAnalysis>(`/aptitude/tests/${test.testId}/submit`, {
        answers: test.questions.map((question) => ({
          questionId: question.questionId,
          selectedAnswer: answersRef.current[question.questionId] || null,
          timeTakenSeconds: timesRef.current[question.questionId] || 0,
        })),
      });
      localStorage.removeItem(`aptitude-test-${test.testId}`);
      navigate(`/preparation/aptitude/result/${test.testId}`, { replace: true });
    } catch (e: any) { setError(e.message || 'Unable to submit test'); submittingRef.current = false; setSubmitting(false); }
  };

  useEffect(() => {
    if (!test || submittingRef.current) return;
    if (remaining <= 0) { void submit(true); return; }
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
      const questionId = test.questions[current]?.questionId;
      if (questionId) setTimes((value) => ({ ...value, [questionId]: (value[questionId] || 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining, test, current]);

  if (!test) return <Layout><main className="max-w-xl mx-auto px-4 py-20 text-center"><p className="font-bold text-red-600">{error || 'Loading test…'}</p>{error && <button onClick={() => navigate('/aptitude')} className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold">Start a new test</button>}</main></Layout>;
  const question = test.questions[current];
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  const answeredCount = Object.keys(answers).length;

  return (
    <Layout><main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-3xl px-6 py-4">
        <div><p className="text-[10px] uppercase tracking-widest font-black text-blue-600">{question.section}</p><h1 className="text-xl font-black text-slate-900 dark:text-neutral-100">{test.title || 'Aptitude Test'}</h1></div>
        <div className={`px-5 py-3 rounded-2xl font-black tabular-nums ${remaining < 60 ? 'bg-red-50 text-red-600' : 'bg-slate-950 text-white'}`}>⏱ {minutes}:{seconds}</div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <section className="flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-[2rem] p-6 sm:p-9 shadow-sm">
          <div className="flex justify-between gap-4 mb-7"><span className="font-black text-slate-500">Question {current + 1} of {test.questions.length}</span><span className="text-xs font-black px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-full">{question.topic} · {question.difficulty}</span></div>
          <h2 className="text-xl sm:text-2xl font-bold leading-relaxed text-slate-900 dark:text-neutral-100 whitespace-pre-wrap">{question.question}</h2>
          <div className="space-y-3 mt-8">{(['A', 'B', 'C', 'D'] as const).map((key) => {
            const selected = answers[question.questionId] === key;
            return <button key={key} onClick={() => setAnswers({ ...answers, [question.questionId]: key })} className={`w-full text-left flex gap-4 items-start p-4 rounded-2xl border-2 transition ${selected ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-100 dark:border-neutral-800 hover:border-blue-200'}`}><span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-neutral-800'}`}>{key}</span><span className="pt-1 font-semibold text-slate-700 dark:text-neutral-200">{question.options[key]}</span></button>;
          })}</div>
          {error && <p className="mt-5 p-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm">{error}</p>}
          <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-neutral-800">
            <button disabled={current === 0} onClick={() => setCurrent(current - 1)} className="px-5 py-3 rounded-2xl font-black bg-slate-100 dark:bg-neutral-800 disabled:opacity-40">← Previous</button>
            {current < test.questions.length - 1 ? <button onClick={() => setCurrent(current + 1)} className="px-6 py-3 rounded-2xl font-black bg-blue-600 text-white">Next →</button> : <button disabled={submitting} onClick={() => void submit()} className="px-6 py-3 rounded-2xl font-black bg-emerald-600 text-white disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit Test'}</button>}
          </div>
        </section>
        <aside className="w-full lg:w-64 bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-3xl p-5">
          <div className="flex justify-between text-xs font-black mb-4"><span>Question map</span><span className="text-blue-600">{answeredCount}/{test.questions.length} answered</span></div>
          <div className="grid grid-cols-5 gap-2">{test.questions.map((item, index) => <button key={item.questionId} onClick={() => setCurrent(index)} className={`aspect-square rounded-xl text-xs font-black border ${index === current ? 'ring-2 ring-blue-600' : ''} ${answers[item.questionId] ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700'}`}>{index + 1}</button>)}</div>
          <button disabled={submitting} onClick={() => void submit()} className="w-full mt-5 py-3 rounded-2xl bg-slate-950 dark:bg-blue-600 text-white font-black text-sm disabled:opacity-50">Submit test</button>
        </aside>
        {question.section === 'Numerical Ability' && <MiniCalculator />}
      </div>
    </main></Layout>
  );
};

export default AptitudeQuiz;
