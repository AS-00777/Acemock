import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../services/api';
import type { AptitudeQuestion } from '../aptitudeTypes';
import { CompanyLogo, companyLogoFallbacks, companyLogos, routeCompanyToLogoKey, type CompanyLogoKey } from '../data/companyLogos';

type CountRow = { company: string; section: string; topic: string; difficulty: string; count: number };
type Meta = { companies: string[]; sections: string[]; difficulties: string[]; topicsBySection: Record<string, string[]>; counts: CountRow[] };
type Mode = 'aptitude' | 'technical' | 'company' | 'mock';

const APTITUDE = ['Numerical Ability', 'Logical Reasoning', 'Verbal Ability'];
const TECHNICAL = ['React Engineer', 'DevOps Engineer', 'AI & ML', 'SAP Engineer'];
const COMPANY_ROUTE_MAP: Record<string, string> = {
  tcs: 'TCS',
  'tcs-digital': 'TCS Digital',
  infosys: 'Infosys',
  accenture: 'Accenture',
  cognizant: 'Cognizant',
  wipro: 'Wipro',
  capgemini: 'Capgemini',
  hcl: 'HCL',
  'tech-mahindra': 'Tech Mahindra',
  ibm: 'IBM',
  deloitte: 'Deloitte',
  oracle: 'Oracle',
};
const companyQuestionCounts: Record<string, number> = {
  tcs: 1126,
  'tcs-digital': 884,
  infosys: 984,
  accenture: 1048,
  cognizant: 876,
  wipro: 932,
  capgemini: 889,
  hcl: 815,
  'tech-mahindra': 792,
  deloitte: 734,
  oracle: 768,
};
const topicQuestionCounts: Record<string, number> = {
  quantitative: 1243,
  reasoning: 1041,
  verbal: 845,
  'data-interpretation': 697,
  technical: 3545,
};
const TOPIC_ROUTE_MAP: Record<string, { section: string; topic?: string }> = {
  quantitative: { section: 'Numerical Ability' },
  reasoning: { section: 'Logical Reasoning' },
  verbal: { section: 'Verbal Ability' },
  'data-interpretation': { section: 'Numerical Ability', topic: 'Data Interpretation' },
  'number-system': { section: 'Numerical Ability', topic: 'Number System' },
  'time-and-work': { section: 'Numerical Ability', topic: 'Time and Work' },
  'profit-and-loss': { section: 'Numerical Ability', topic: 'Profit and Loss' },
  percentages: { section: 'Numerical Ability', topic: 'Percentages' },
};
const MODE_COPY: Record<Mode, { title: string; description: string }> = {
  aptitude: { title: 'Aptitude Practice', description: 'Focus on numerical, logical, or verbal ability.' },
  technical: { title: 'Technical MCQ Practice', description: 'Choose an engineering role and sharpen core concepts.' },
  company: { title: 'Company Specific Practice', description: 'Practise the General company bank today; more companies can be added later.' },
  mock: { title: 'Mixed Mock Test', description: 'Combine aptitude and technical questions in one timed test.' },
};

const shuffleQuestions = (questions: AptitudeQuestion[]) => {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const AptitudeSetup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { company: routeCompany, topic: routeTopic, technicalTopic, mockType } = useParams<{ company?: string; topic?: string; technicalTopic?: string; mockType?: string }>();
  const [params] = useSearchParams();
  const rawMode = params.get('mode');
  const companyName = routeCompany ? COMPANY_ROUTE_MAP[routeCompany.toLowerCase()] ?? routeCompany.charAt(0).toUpperCase() + routeCompany.slice(1) : 'General';
  const routeMode: Mode | null = routeCompany ? 'company' : routeTopic ? 'aptitude' : technicalTopic || location.pathname === '/aptitude/technical' ? 'technical' : location.pathname === '/aptitude/mock' || location.pathname.startsWith('/mock-test') ? 'mock' : null;
  const mode: Mode = routeMode ?? (rawMode === 'technical' || rawMode === 'company' || rawMode === 'mock' ? rawMode : 'aptitude');
  const topicPreset = routeTopic ? TOPIC_ROUTE_MAP[routeTopic] : undefined;
  const initialSection = mode === 'aptitude' ? APTITUDE[0] : mode === 'technical' ? TECHNICAL[0] : '';
  const [meta, setMeta] = useState<Meta | null>(null);
  const [company, setCompany] = useState(companyName);
  const [section, setSection] = useState(topicPreset?.section ?? initialSection);
  const [topic, setTopic] = useState(topicPreset?.topic ?? '');
  const [difficulty, setDifficulty] = useState('');
  const [requestedQuestions, setRequestedQuestions] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCompany(companyName);
    setSection(topicPreset?.section ?? initialSection);
    setTopic(topicPreset?.topic ?? '');
    setDifficulty('');
  }, [mode, companyName, routeTopic, initialSection, topicPreset?.section, topicPreset?.topic]);

  useEffect(() => {
    api.get<Meta>('/aptitude/meta').then(setMeta).catch((e) => setError(e.message));
  }, []);

  const sections = mode === 'aptitude' ? APTITUDE : mode === 'technical' ? TECHNICAL : meta?.sections ?? [];
  const topics = section ? meta?.topicsBySection[section] ?? [] : [];
  const available = useMemo(() => meta?.counts
    .filter((row) => row.company === company)
    .filter((row) => !section || row.section === section)
    .filter((row) => !topic || row.topic === topic)
    .filter((row) => !difficulty || row.difficulty.toLowerCase() === difficulty.toLowerCase())
    .reduce((sum, row) => sum + row.count, 0) ?? 0, [meta, company, section, topic, difficulty]);
  const fallbackAvailable = routeCompany ? companyQuestionCounts[routeCompany] ?? 800 : routeTopic ? topicQuestionCounts[routeTopic] ?? 900 : mode === 'technical' ? topicQuestionCounts.technical : mode === 'mock' ? 2400 : 1000;
  const displayAvailable = available || fallbackAvailable;
  const effectiveQuestions = Math.min(Math.max(1, requestedQuestions), displayAvailable);
  const limited = displayAvailable > 0 && requestedQuestions > displayAvailable;
  const companyTitle = `${companyName} Aptitude Test`;
  const topicLabel = routeTopic ? routeTopic.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : '';
  const topicTitle = routeTopic
    ? `${topicLabel === 'Quantitative' ? 'Quantitative Aptitude' : topicLabel} Practice`
    : MODE_COPY[mode].title;
  const mockTitle = mockType ? `${mockType.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')} Mock Test` : MODE_COPY[mode].title;
  const pageCopy = routeCompany
    ? { title: companyTitle, description: `You are preparing for the ${companyName} company-specific aptitude round.` }
    : routeTopic
      ? { title: topicTitle, description: routeTopic === 'quantitative' ? 'Practice numerical ability questions with timed test options.' : `Practice ${topicTitle.replace(' Practice', '').toLowerCase()} questions with timed test options.` }
      : mockType
        ? { title: mockTitle, description: 'Practice a timed test with questions selected for this track.' }
        : MODE_COPY[mode];
  const logoKey: CompanyLogoKey | undefined = routeCompany ? routeCompanyToLogoKey[routeCompany] : undefined;
  const logoSrc = logoKey ? companyLogos[logoKey] : undefined;
  const logoFallback = logoKey ? companyLogoFallbacks[logoKey] : companyName;

  const preset = (questions: number) => {
    setRequestedQuestions(questions);
    setDurationMinutes(questions);
  };

  const start = async () => {
    if (!displayAvailable || loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await api.post<{ testId: number; questions: AptitudeQuestion[] }>('/aptitude/tests/start', {
        title: pageCopy.title,
        company: available ? company : 'General',
        section: section || undefined,
        topic: topic || undefined,
        difficulty: difficulty || undefined,
        totalQuestions: effectiveQuestions,
        durationMinutes,
        shuffle: shuffleEnabled,
      });
      const questions = shuffleEnabled ? shuffleQuestions(response.questions) : response.questions;
      localStorage.setItem(`aptitude-test-${response.testId}`, JSON.stringify({ ...response, questions, title: pageCopy.title, durationMinutes, startedAt: Date.now() }));
      navigate(`/preparation/aptitude/test/${response.testId}`);
    } catch (e: any) {
      setError(e.message || 'Unable to start this test');
    } finally {
      setLoading(false);
    }
  };

  const selectClass = 'w-full px-4 py-3.5 rounded-[14px] border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-100 outline-none transition hover:border-blue-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20';

  return <Layout><main className="bg-slate-50 dark:bg-neutral-950"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <section className="bg-white dark:bg-neutral-900 rounded-[24px] border border-gray-200 dark:border-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.06)] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-5">
          {logoKey && <CompanyLogo src={logoSrc} alt={`${companyName} logo`} variant="header" fallback={logoFallback} />}
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">Test setup</span>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-neutral-100 mt-4">{pageCopy.title}</h1>
            <p className="text-slate-500 dark:text-neutral-400 mt-3 leading-relaxed">{pageCopy.description}</p>
          </div>
        </div>
        <div className="mt-10">
          <h2 className="text-sm font-black text-slate-800 dark:text-neutral-200 mb-3">Quick presets</h2>
          <div className="grid sm:grid-cols-4 gap-3">{[10, 20, 30, 50].map((value) => <button key={value} onClick={() => preset(value)} className={`rounded-[14px] border p-4 text-left transition ${requestedQuestions === value && durationMinutes === value ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-950/30' : 'border-gray-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-700'}`}><strong className="block text-slate-900 dark:text-neutral-100">{value} questions</strong><span className="text-xs text-slate-500 dark:text-neutral-400">{value} minutes</span></button>)}</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mt-10">
          {mode === 'company' && <div className="text-sm font-black text-slate-700 dark:text-neutral-300">Company<div className="mt-2 flex min-h-[3.65rem] items-center gap-3 rounded-[14px] border border-gray-200 bg-white px-4 py-3 transition dark:border-neutral-700 dark:bg-neutral-900">{logoKey && <CompanyLogo src={logoSrc} alt={`${companyName} logo`} variant="menu" fallback={logoFallback} />}<span className="text-base font-black text-slate-900 dark:text-neutral-100">{companyName}</span></div></div>}
          {mode !== 'mock' && <label className="text-sm font-black text-slate-700 dark:text-neutral-300">Section<select value={section} onChange={(e) => { setSection(e.target.value); setTopic(''); }} className={`${selectClass} mt-2`}>{mode === 'company' && <option value="">All sections</option>}{sections.map((item) => <option key={item}>{item}</option>)}</select></label>}
          {mode === 'mock' && <div className="sm:col-span-2 p-5 rounded-[14px] bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30"><p className="font-black text-blue-700 dark:text-blue-300">All sections mixed</p><p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Questions are randomly drawn from aptitude and technical sections.</p></div>}
          {mode !== 'mock' && <label className="text-sm font-black text-slate-700 dark:text-neutral-300">Topic<select value={topic} onChange={(e) => setTopic(e.target.value)} className={`${selectClass} mt-2`}><option value="">All Topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>}
        </div>
        <div className="mt-10"><h2 className="text-sm font-black text-slate-800 dark:text-neutral-200 mb-3">Difficulty</h2><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['', 'Mixed'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']].map(([value, label]) => <button key={label} onClick={() => setDifficulty(value)} className={`rounded-[14px] border px-4 py-4 font-black transition ${difficulty === value ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/30 dark:text-blue-300' : 'border-gray-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:border-blue-200 dark:hover:border-blue-700'}`}>{label}</button>)}</div></div>
        <div className="grid sm:grid-cols-2 gap-5 mt-10"><label className="text-sm font-black text-slate-700 dark:text-neutral-300">Number of questions<input type="number" min="1" max="100" value={requestedQuestions} onChange={(e) => setRequestedQuestions(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} className={`${selectClass} mt-2`} /></label><label className="text-sm font-black text-slate-700 dark:text-neutral-300">Duration in minutes<input type="number" min="1" max="240" value={durationMinutes} onChange={(e) => setDurationMinutes(Math.min(240, Math.max(1, Number(e.target.value) || 1)))} className={`${selectClass} mt-2`} /></label></div>
        <label className="mt-10 flex cursor-pointer items-center justify-between gap-4 rounded-[14px] border border-gray-200 bg-slate-50 p-4 transition hover:border-blue-200 dark:border-neutral-800 dark:bg-neutral-950/50">
          <span>
            <span className="block text-sm font-black text-slate-900 dark:text-neutral-100">Shuffle Questions</span>
            <span className="block text-xs font-semibold text-slate-500 dark:text-neutral-400 mt-1">Randomize question order when the test starts.</span>
          </span>
          <input type="checkbox" checked={shuffleEnabled} onChange={(e) => setShuffleEnabled(e.target.checked)} className="h-5 w-5 accent-blue-600" />
        </label>
      </section>
      <aside className="relative overflow-hidden rounded-[24px] border border-gray-200 bg-gradient-to-b from-blue-50 to-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)] lg:sticky lg:top-24 dark:border-neutral-800 dark:from-blue-950/25 dark:to-neutral-900">
        <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
        <div className="flex items-start justify-between gap-4 pt-2">
          <p className="text-[10px] uppercase tracking-[0.25em] font-black text-blue-600 dark:text-blue-300">Ready when you are</p>
          {logoKey && <CompanyLogo src={logoSrc} alt={`${companyName} logo`} variant="overview" fallback={logoFallback} />}
        </div>
        <h2 className="text-xl font-black mt-5 leading-tight text-slate-950 dark:text-neutral-100">{pageCopy.title}</h2>
        <div className="mt-5 flex items-end gap-2">
          <span className="text-5xl font-black tabular-nums text-slate-950 dark:text-neutral-100">{displayAvailable.toLocaleString()}</span>
          <span className="text-sm font-bold text-slate-500 dark:text-neutral-400 pb-1">available</span>
        </div>
        <div className="mt-6 space-y-3 rounded-[16px] border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex justify-between gap-4"><span className="text-slate-500 dark:text-neutral-400">Test questions</span><strong className="text-slate-950 dark:text-neutral-100">{effectiveQuestions || 0}</strong></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500 dark:text-neutral-400">Duration</span><strong className="text-slate-950 dark:text-neutral-100">{durationMinutes} min</strong></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500 dark:text-neutral-400">Difficulty</span><strong className="text-slate-950 dark:text-neutral-100">{difficulty || 'Mixed'}</strong></div>
        </div>
        {limited && <div className="mt-5 rounded-[14px] bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 font-semibold dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-200">Only {displayAvailable} questions available for this selection. Start with {displayAvailable} questions.</div>}
        {!meta && <p className="mt-5 text-sm text-slate-400">Checking question availability...</p>}
        {meta && available === 0 && !fallbackAvailable && <div className="mt-5 rounded-[14px] bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-semibold dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-200">No questions match these filters. Try Mixed difficulty or All Topics.</div>}
        {error && <p className="mt-5 rounded-[14px] bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-semibold dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-200">{error}</p>}
        <button onClick={start} disabled={loading} className="w-full mt-6 h-[52px] rounded-[14px] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest shadow-sm transition dark:disabled:bg-neutral-800">{loading ? 'Building test...' : `Start ${effectiveQuestions || ''} Question Test`}</button>
      </aside>
    </div>
  </div></main></Layout>;
};

export default AptitudeSetup;
