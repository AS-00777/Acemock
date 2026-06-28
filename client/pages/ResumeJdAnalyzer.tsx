import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, BriefcaseBusiness, FileText, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import Layout from '../components/Layout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

type SkillMatch = { requiredSkill: string; resumeSkill: string; matchType: string; score: number };
type ResumeJdResult = {
  overallMatchScore: number;
  skillMatchScore: number;
  semanticMatchScore: number;
  experienceRelevanceScore: number;
  matchedSkills: SkillMatch[];
  missingSkills: string[];
  partialMatches: SkillMatch[];
  weakProjectAlignment: string[];
  suggestedImprovements: string[];
  suggestionSource?: string;
  semanticModel: string;
  confidenceLabel: string;
};

const tone = (score: number) => score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
const fitLabel = (score: number) => score >= 80 ? 'Strong role fit' : score >= 60 ? 'Moderate role fit' : 'Low role fit';
const fileType = (name: string) => name.split('.').pop()?.toUpperCase() || 'FILE';

const ResumeJdAnalyzer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<ResumeJdResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filePreparing, setFilePreparing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { logout } = useAuth();

  const handleFile = (nextFile: File) => {
    setError('');
    setResult(null);
    setShowSuggestions(false);
    setSuggestionsLoading(false);
    setFilePreparing(true);
    if (!/\.(pdf|docx|txt)$/i.test(nextFile.name)) {
      setFilePreparing(false);
      return setError('Upload a PDF, DOCX, or TXT resume.');
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setFilePreparing(false);
      return setError('Resume file must be 5MB or smaller.');
    }
    setFile(nextFile);
    window.setTimeout(() => setFilePreparing(false), 450);
  };

  const analyze = async () => {
    if (!file) return setError('Choose a resume before analyzing.');
    if (!targetRole.trim()) return setError('Enter a target role.');
    if (!jobDescription.trim()) return setError('Paste a job description.');
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('resume', file);
      form.append('targetRole', targetRole);
      form.append('jobDescription', jobDescription);
      const response = await api.postForm<{ result: ResumeJdResult }>('/api/resume-jd/analyze', form);
      setResult(response.result);
      setShowSuggestions(false);
      setSuggestionsLoading(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err?.message || 'Resume vs JD analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const revealSuggestions = () => {
    if (!result || suggestionsLoading || showSuggestions) return;
    setSuggestionsLoading(true);
    window.setTimeout(() => {
      setSuggestionsLoading(false);
      setShowSuggestions(true);
    }, 2200);
  };

  const partialItems = useMemo(() => {
    if (!result) return [];
    const seen = new Set<string>();
    return result.partialMatches
      .map((item) => {
        const resumeSkill = item.resumeSkill || 'Resume experience';
        const requiredSkill = item.requiredSkill || 'this requirement';
        const lowerResume = resumeSkill.toLowerCase();
        const label = lowerResume.includes('database') || lowerResume.includes('mysql') || lowerResume.includes('sql') || lowerResume.includes('jdbc')
          ? `Database experience partially supports ${requiredSkill} requirement`
          : `${resumeSkill} partially supports ${requiredSkill} requirement`;
        return label;
      })
      .filter((label) => {
        const key = label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [result]);

  return (
    <Layout>
      <style>{`
        .resume-jd-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #2563eb rgba(148, 163, 184, 0.2);
        }
        .resume-jd-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .resume-jd-scrollbar::-webkit-scrollbar-track {
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
        }
        .resume-jd-scrollbar::-webkit-scrollbar-thumb {
          border: 2px solid transparent;
          border-radius: 999px;
          background: #2563eb;
          background-clip: content-box;
        }
        .resume-jd-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #1d4ed8;
          background-clip: content-box;
        }
      `}</style>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">Resume Tools</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-neutral-100 sm:text-4xl">Resume vs Job Description Analyzer</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">Compare a resume against a target role and job description with a clean match summary, skill gaps, and tailored improvement suggestions.</p>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[0.9fr_1.35fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
            <UploadBox file={file} preparing={filePreparing} onChoose={() => inputRef.current?.click()} onRemove={() => { setFile(null); setResult(null); }} />
            <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />

            <label className="mt-5 block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400" htmlFor="targetRole">Target role</label>
            <input id="targetRole" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="Java Backend Developer" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-blue-500 dark:focus:bg-neutral-950" />

            <label className="mt-5 block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400" htmlFor="jobDescription">Job description</label>
            <textarea id="jobDescription" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={10} placeholder="Paste the full job description here." className="resume-jd-scrollbar mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-500 dark:focus:bg-neutral-950" />

            {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">{error}</div>}
            {(loading || filePreparing) && <LoadingBar />}
            <button type="button" onClick={analyze} disabled={loading || filePreparing} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 text-sm font-black uppercase tracking-widest text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Analyzing Match' : 'Analyze Match'}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
            {!result ? (
              <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-neutral-800 dark:bg-neutral-950/60">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-900/40"><BriefcaseBusiness className="h-8 w-8" /></div>
                <h2 className="mt-5 text-xl font-black text-slate-950 dark:text-neutral-100">Match report will appear here</h2>
                <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">Upload a resume, enter a target role, and paste a job description to see the match dashboard.</p>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl">
                <div className={`space-y-5 transition duration-300 ${suggestionsLoading ? 'scale-[0.99] blur-sm opacity-50' : ''}`}>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">Match summary</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-neutral-100">{fitLabel(result.overallMatchScore)}</h2>
                        <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">A focused snapshot of resume alignment, skill coverage, semantic fit, and experience relevance for this role.</p>
                      </div>
                      <div className="rounded-2xl bg-white px-5 py-4 text-left shadow-sm ring-1 ring-slate-200 dark:bg-neutral-900 dark:ring-neutral-800 lg:text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">Overall Match</p>
                        <p className={`mt-1 text-5xl font-black leading-none ${tone(result.overallMatchScore)}`}><AnimatedCounter value={result.overallMatchScore} />%</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Overall Match', result.overallMatchScore],
                      ['Skills Match', result.skillMatchScore],
                      ['Semantic Match', result.semanticMatchScore],
                      ['Experience Relevance', result.experienceRelevanceScore],
                    ].map(([label, score]) => <Score key={label} label={String(label)} score={Number(score)} />)}
                  </div>

                  <ReportList title="Weak Alignment" items={result.weakProjectAlignment} fallback="No major project alignment issues detected." />

                  <div className="rounded-2xl border border-slate-200 p-5 dark:border-neutral-800">
                    <div className="flex flex-col gap-5">
                      <PillList title="Matched Skills" items={result.matchedSkills.map((item) => item.requiredSkill)} empty="No exact skill matches yet." toneClass="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:ring-emerald-900/40" />
                      <PillList title="Missing Skills" items={result.missingSkills} empty="No missing required skills detected." toneClass="bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/20 dark:text-red-300 dark:ring-red-900/40" />
                      <PillList title="Partial Coverage" items={partialItems} empty="No partial coverage detected." toneClass="bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:ring-amber-900/40" />
                    </div>
                  </div>

                  <SuggestionList revealed={showSuggestions} loading={suggestionsLoading} onGenerate={revealSuggestions} items={result.suggestedImprovements} />
                </div>

                {suggestionsLoading && (
                  <div className="absolute inset-0 z-10 grid min-h-[32rem] place-items-center rounded-2xl bg-white/80 backdrop-blur-md dark:bg-neutral-950/80">
                    <div className="mx-4 max-w-sm rounded-2xl border border-slate-200 bg-white px-7 py-6 text-center shadow-2xl shadow-slate-900/10 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/30">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-900/40">
                        <Brain className="h-7 w-7 animate-pulse" />
                      </div>
                      <p className="mt-4 text-sm font-black text-slate-900 dark:text-neutral-100">Generating personalized AI suggestions...</p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-neutral-400">Reviewing skill gaps, alignment signals, and role context.</p>
                      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800">
                        <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
};

const UploadBox = ({ file, preparing, onChoose, onRemove }: { file: File | null; preparing: boolean; onChoose: () => void; onRemove: () => void }) => (
  <div className={`relative rounded-2xl border-2 border-dashed transition ${file ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/20' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-blue-900 dark:hover:bg-blue-950/20'} ${preparing ? 'scale-[0.99] ring-4 ring-blue-500/10' : ''}`}>
    <button type="button" onClick={onChoose} className="flex min-h-32 w-full flex-col items-center justify-center px-5 py-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-blue-400 dark:ring-neutral-800">
        {file ? <FileText className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
      </div>
      <span className="mt-3 max-w-full truncate px-4 text-base font-black text-slate-900 dark:text-neutral-100">{file ? file.name : 'Upload resume'}</span>
      <span className="mt-1 text-sm font-semibold text-slate-500 dark:text-neutral-400">{file ? `${fileType(file.name)} resume file` : 'PDF, DOCX, or TXT'}</span>
    </button>
    {file && (
      <button type="button" onClick={onRemove} aria-label="Remove uploaded file" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:text-red-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-red-900/60 dark:hover:text-red-400">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

const Score = ({ label, score }: { label: string; score: number }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">{label}</p>
    <p className={`mt-3 text-3xl font-black leading-none ${tone(score)}`}><AnimatedCounter value={score} />%</p>
  </div>
);

const PillList = ({ title, items, empty, toneClass }: { title: string; items: string[]; empty: string; toneClass: string }) => (
  <section>
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">{title}</h3>
    <div className="mt-3 flex flex-wrap gap-2">{(items.length ? items : [empty]).map((item) => <span key={item} className={`max-w-full rounded-full px-3 py-2 text-xs font-black leading-5 ${toneClass}`}>{item}</span>)}</div>
  </section>
);

const ReportList = ({ title, items, fallback }: { title: string; items: string[]; fallback: string }) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-amber-950/15">
    <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">{title}</h3>
    <ul className="mt-3 grid gap-2">{(items.length ? items : [fallback]).map((item) => <li key={item} className="rounded-xl border border-amber-100 bg-white/70 px-4 py-3 text-sm font-bold leading-6 text-slate-700 dark:border-amber-900/30 dark:bg-neutral-950/40 dark:text-neutral-300">{item}</li>)}</ul>
  </div>
);

const SuggestionList = ({ revealed, loading, onGenerate, items }: { revealed: boolean; loading: boolean; onGenerate: () => void; items: string[] }) => {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-neutral-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">AI Suggestions</h3>
        {!revealed && (
          <button type="button" onClick={onGenerate} disabled={loading} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate AI Suggestions
          </button>
        )}
      </div>
      {!revealed ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">Generate tailored improvement suggestions based on this resume and job description.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          {(items.length ? items : ['No suggestions returned.']).map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold leading-6 text-slate-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AnimatedCounter = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const duration = 1050;
    const start = performance.now();
    const animate = (now: number) => {
      frame = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - frame, 3);
      setDisplay(Math.round(value * eased));
      if (frame < 1) requestAnimationFrame(animate);
    };
    setDisplay(0);
    requestAnimationFrame(animate);
  }, [value]);
  return <>{display}</>;
};

const LoadingBar = () => (
  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800">
    <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
  </div>
);

export default ResumeJdAnalyzer;
