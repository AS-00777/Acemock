import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileCheck, FileText, Loader2, UploadCloud, X } from 'lucide-react';
import Layout from '../components/Layout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

type AtsResult = {
  atsScore: number;
  parseScore: number;
  readabilityScore: number;
  sectionCoverageScore: number;
  formattingScore: number;
  keywordQualityScore: number;
  contactDetection: Record<string, boolean>;
  strengths: string[];
  improvements: string[];
  formattingIssues: string[];
  sectionIssues: string[];
  sectionsFound: string[];
  wordCount: number;
  summary: string;
  documentType?: 'resume' | 'offer_letter' | 'certificate' | 'unreadable' | 'unknown';
  documentConfidence?: number;
  documentReasons?: string[];
  status?: 'ok' | 'invalid_document' | 'unreadable';
  message?: string;
  overallScore?: number;
};

const scoreTone = (score: number) => score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
const fileType = (name: string) => name.split('.').pop()?.toUpperCase() || 'FILE';

const AtsChecker: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [localTextHint, setLocalTextHint] = useState('');
  const [result, setResult] = useState<AtsResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filePreparing, setFilePreparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { logout } = useAuth();

  const handleFile = async (nextFile: File) => {
    setError('');
    setResult(null);
    setLocalTextHint('');
    setFilePreparing(true);
    if (!/\.(pdf|docx|txt)$/i.test(nextFile.name)) {
      setError('Upload a PDF, DOCX, or TXT resume.');
      setFilePreparing(false);
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setError('Resume file must be 5MB or smaller.');
      setFilePreparing(false);
      return;
    }
    setFile(nextFile);
    if (/\.txt$/i.test(nextFile.name) || nextFile.type.startsWith('text/')) {
      try {
        setLocalTextHint((await nextFile.text()).toLowerCase());
      } catch {
        setLocalTextHint('');
      }
    }
    window.setTimeout(() => setFilePreparing(false), 450);
  };

  const runCheck = async () => {
    if (!file) {
      setError('Choose a resume before running the ATS check.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('resume', file);
      const response = await api.postForm<{ result: AtsResult }>('/api/ats/check', form);
      setResult(response.result);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err?.message || 'ATS check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">Resume Tools</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-neutral-100 sm:text-4xl">ATS Score Checker</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">
              Upload one resume to check parsing quality, formatting, sections, readability, and contact detection.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            <FileCheck className="h-4 w-4 text-blue-600" />
            Resume Only
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[0.86fr_1.34fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
            <UploadBox file={file} preparing={filePreparing} onChoose={() => fileInputRef.current?.click()} onRemove={() => { setFile(null); setResult(null); setLocalTextHint(''); }} />
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />

            {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">{error}</div>}

            {(loading || filePreparing) && <LoadingBar />}
            <button type="button" onClick={runCheck} disabled={loading || filePreparing} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 text-sm font-black uppercase tracking-widest text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Analyzing Resume...' : 'Check ATS Score'}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
            {loading ? (
              <LoadingPanel />
            ) : !result ? (
              <EmptyPanel />
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">ATS Summary</p>
                      <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-neutral-100">{result.summary}</h2>
                      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">
                        Parsed {result.wordCount} words. Sections found: {result.sectionsFound.join(', ') || 'none'}.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200 dark:bg-neutral-900 dark:ring-neutral-800">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">ATS Score</p>
                      <p className={`mt-1 text-5xl font-black leading-none ${scoreTone(result.atsScore)}`}><AnimatedCounter value={result.atsScore} />%</p>
                    </div>
                  </div>
                </div>

                <ScoreGrid scores={[
                  ['ATS', result.atsScore],
                  ['Parse', result.parseScore],
                  ['Sections', result.sectionCoverageScore],
                  ['Format', result.formattingScore],
                  ['Readability', result.readabilityScore],
                  ['Keywords', result.keywordQualityScore],
                ]} />

                <ContactDetection contacts={result.contactDetection} localTextHint={localTextHint} summary={result.summary} sectionsFound={result.sectionsFound} />

                <div className="grid gap-5 lg:grid-cols-2">
                  <ReportList title="Strengths" items={result.strengths} variant="success" />
                  <ReportList title="Improvements" items={result.improvements} variant="info" />
                  <ReportList title="Formatting Issues" items={result.formattingIssues.length ? result.formattingIssues : ['No major formatting issues detected.']} variant="warning" />
                  <ReportList title="Section Issues" items={result.sectionIssues.length ? result.sectionIssues : ['Core sections are visible.']} variant="warning" />
                </div>
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
    <button type="button" onClick={onChoose} className="flex min-h-36 w-full flex-col items-center justify-center px-5 py-7 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-blue-400 dark:ring-neutral-800">
        {file ? <FileText className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
      </div>
      <span className="mt-4 max-w-full truncate px-4 text-base font-black text-slate-900 dark:text-neutral-100">{file ? file.name : 'Upload resume'}</span>
      <span className="mt-2 text-sm font-semibold text-slate-500 dark:text-neutral-400">{file ? `${fileType(file.name)} resume file` : 'PDF, DOCX, or TXT'}</span>
      <span className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Max size 5MB</span>
    </button>
    {file && (
      <button type="button" onClick={onRemove} aria-label="Remove uploaded file" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:text-red-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-red-900/60 dark:hover:text-red-400">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

const EmptyPanel = () => (
  <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-neutral-800 dark:bg-neutral-950/60">
    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-900/40"><FileCheck className="h-8 w-8" /></div>
    <h2 className="mt-5 text-xl font-black text-slate-950 dark:text-neutral-100">ATS report will appear here</h2>
    <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">This check does not use a job description or target role.</p>
  </div>
);

const LoadingPanel = () => (
  <div className="min-h-[28rem] rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-950/60">
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-black text-slate-950 dark:text-neutral-100">Analyzing Resume...</p>
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-neutral-400">Checking parse quality, sections, formatting, and contact signals.</p>
      </div>
    </div>
    <LoadingBar />
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-neutral-900 dark:ring-neutral-800" />)}
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-neutral-900 dark:ring-neutral-800" />)}
    </div>
  </div>
);

const ScoreGrid = ({ scores }: { scores: Array<[string, number]> }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {scores.map(([label, score]) => (
      <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">{label}</p>
        <p className={`mt-3 text-3xl font-black leading-none ${scoreTone(score)}`}><AnimatedCounter value={score} />%</p>
      </div>
    ))}
  </div>
);

const ContactDetection = ({ contacts, localTextHint, summary, sectionsFound }: { contacts: Record<string, boolean>; localTextHint: string; summary: string; sectionsFound: string[] }) => {
  const searchableText = `${localTextHint} ${summary || ''} ${(sectionsFound || []).join(' ')}`.toLowerCase();
  const labels = Array.from(new Set([...Object.keys(contacts), 'email', 'phone', 'linkedin', 'github']));

  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-neutral-800">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">Contact Detection</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {labels.map((label) => {
          const lower = label.toLowerCase();
          const hinted = lower === 'linkedin'
            ? /\blinkedin\b|\blinked\s*in\b|linkedin\.com/.test(searchableText)
            : lower === 'github'
              ? /\bgithub\b|github\.com/.test(searchableText)
              : false;
          const detected = Boolean(contacts[label] ?? contacts[lower]) || hinted;
          return (
            <div key={label} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-black capitalize ${detected ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400'}`}>
              <span>{label}</span>
              {detected ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0 text-slate-300 dark:text-neutral-700" />}
            </div>
          );
        })}
      </div>
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
    <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600 shadow-sm shadow-blue-600/30" />
  </div>
);

const reportTone = {
  success: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/15',
  info: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/15',
  warning: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/15',
};

const ReportList = ({ title, items, variant }: { title: string; items: string[]; variant: keyof typeof reportTone }) => (
  <div className={`rounded-2xl border p-5 ${reportTone[variant]}`}>
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-neutral-300">{title}</h3>
    <ul className="mt-3 space-y-2">
      {items.map((item) => <li key={item} className="rounded-xl border border-white/70 bg-white/75 px-4 py-3 text-sm font-bold leading-6 text-slate-700 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-950/45 dark:text-neutral-300">{item}</li>)}
    </ul>
  </div>
);

export default AtsChecker;
