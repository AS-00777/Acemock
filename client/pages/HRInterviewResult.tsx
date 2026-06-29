import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

const metricLabels: Array<[string, string]> = [
  ['communication', 'Communication'],
  ['confidence', 'Confidence'],
  ['structure', 'Structure'],
  ['professionalism', 'Professionalism'],
  ['starUsage', 'STAR Usage'],
];

const HRInterviewResult: React.FC = () => {
  const { interviewId } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    if (!interviewId) return;
    api.get(`/hr-interview/result/${interviewId}`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout();
        setError(err?.message || 'Could not load HR report.');
      });
  }, [interviewId, logout]);

  const report = data?.report;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}
        {!report && !error && <div className="text-center font-black text-slate-500 dark:text-neutral-400">Loading HR report...</div>}
        {report && (
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">HR Interview Result</p>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-3xl font-black text-slate-950 dark:text-neutral-100">Overall Score: {report.overallScore}%</h1>
                  <p className="mt-2 text-sm font-bold text-slate-500 dark:text-neutral-400">Behavioral readiness based on your HR answers.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button onClick={() => navigate('/hr-interview')} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700">Retake</button>
                  <Link to="/dashboard" className="rounded-2xl border border-slate-200 px-5 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800">Back to Dashboard</Link>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {metricLabels.map(([key, label]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">{label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-950 dark:text-neutral-100">{Math.round(Number(report[key] ?? 0))}%</p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="text-xl font-black text-slate-950 dark:text-neutral-100">Strengths</h2>
                <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-neutral-300">
                  {report.strengths.map((item: string) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                <h2 className="text-xl font-black text-slate-950 dark:text-neutral-100">Weak Areas</h2>
                <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-neutral-300">
                  {report.weakAreas.map((item: string) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-xl font-black text-slate-950 dark:text-neutral-100">Question-wise Feedback</h2>
              <div className="mt-5 space-y-4">
                {report.questionWiseFeedback.map((item: any) => (
                  <div key={item.questionId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-black text-slate-900 dark:text-neutral-100">{item.order}. {item.question}</p>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{item.score}%</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-neutral-300">{item.feedback}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HRInterviewResult;
