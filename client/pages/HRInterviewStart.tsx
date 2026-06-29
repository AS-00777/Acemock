import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

const roles = ['General', 'Software Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Data Analyst', 'DevOps Engineer'];
const experiences = ['Fresher', 'Intern', 'Experienced'];
const difficulties = ['Easy', 'Medium', 'Hard'];

const HRInterviewStart: React.FC = () => {
  const [role, setRole] = useState('General');
  const [experience, setExperience] = useState('Fresher');
  const [difficulty, setDifficulty] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { logout } = useAuth();

  const start = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.post<any>('/hr-interview/start', { role, experience, difficulty });
      const interview = data?.interview;
      if (!interview?.id || !Array.isArray(interview.questions)) throw new Error('Could not start HR interview.');
      window.localStorage.setItem(`acemock_hr_interview_${interview.id}`, JSON.stringify(interview));
      navigate(`/hr-interview/simulator/${interview.id}`, { state: { interview } });
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err?.message || 'Could not start HR interview.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="border-b border-slate-200 p-6 dark:border-neutral-800 sm:p-8 lg:border-b-0 lg:border-r">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">HR Mock Interview</p>
              <h1 className="max-w-2xl text-3xl font-black text-slate-950 dark:text-neutral-100 sm:text-5xl">Practice real behavioral interview answers.</h1>
              <p className="mt-4 max-w-xl text-base font-semibold leading-relaxed text-slate-500 dark:text-neutral-400">
                Eight HR questions, camera preview, speech practice, timed answers, rule-based follow-ups, and a detailed readiness report.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {['8 questions', '3 min each', 'Rule-based report'].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Role</span>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                    {roles.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Experience</span>
                  <select value={experience} onChange={(e) => setExperience(e.target.value)} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                    {experiences.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Difficulty</span>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                    {difficulties.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                    {error}
                  </div>
                )}

                <button onClick={start} disabled={loading} className="inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-blue-700 disabled:opacity-60">
                  {loading ? 'Preparing...' : 'Start HR Interview'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default HRInterviewStart;
