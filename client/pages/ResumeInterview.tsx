import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Icons } from '../constants';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

type ResumeProfile = {
  candidateName: string | null;
  detectedRole: string;
  detectedExperience: 'Fresher' | 'Intern' | 'Experienced';
  detectedDifficulty: 'Easy' | 'Medium' | 'Hard';
  skills: string[];
  programmingLanguages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  projects: Array<{ name: string; description: string; technologies: string[] }>;
  education: string[];
  certifications: string[];
  questionFocusAreas: string[];
};

type AnalyzeResponse = {
  success: boolean;
  resumeId: number;
  profile: ResumeProfile;
  signals?: {
    hasLinkedin?: boolean;
    hasGithub?: boolean;
    readableWordCount?: number;
    sectionSignals?: string[];
  };
};

const formatBytes = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return 'PDF file';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const ResumeInterview: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    api
      .get<{ banned: boolean; message: string | null }>('/proctoring/check-ban')
      .then((status) => {
        if (status.banned && status.message) setError(status.message);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout();
      });
  }, [logout]);

  const analyzeFile = async (selectedFile: File) => {
    setError('');
    setAnalysis(null);

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF resume.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }

    setFile(selectedFile);
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append('resume', selectedFile);
      const result = await api.postForm<AnalyzeResponse>('/resume/analyze', form);
      setAnalysis(result);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err?.message || 'Could not analyze this resume. Please try another text-readable PDF.');
    } finally {
      setAnalyzing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      analyzeFile(e.dataTransfer.files[0]);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setAnalysis(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartInterview = async () => {
    if (!analysis?.resumeId) return;
    setLoadingQuestions(true);
    setError('');
    try {
      const resp = await api.post<any>(`/resume/${analysis.resumeId}/start-interview`);
      const newId = resp?.interview?.id ?? resp?.interviewId;
      if (!newId) throw new Error('Failed to start interview.');
      navigate(`/interview-session/${newId}`);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err?.message || 'Failed to prepare session. Please try again.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const profile = analysis?.profile;
  const detectedStack = profile
    ? Array.from(new Set([
        ...profile.skills,
        ...profile.programmingLanguages,
        ...profile.frameworks,
        ...profile.databases,
        ...profile.tools,
      ]))
    : [];
  const visibleSkills = detectedStack.slice(0, 12);
  const hiddenSkillCount = Math.max(0, detectedStack.length - visibleSkills.length);
  const readableWordCount = Number(analysis?.signals?.readableWordCount ?? 0);
  const hasRealError = Boolean(error);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-10">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-4 py-6 shadow-2xl shadow-black/20 sm:px-6 lg:px-8">
          <div className="mb-7 sm:mb-9">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-blue-400">Resume Interview</p>
            <h1 className="mb-3 break-words font-poppins text-3xl font-black text-white sm:text-4xl">
              Resume analysis ready
            </h1>
            <p className="max-w-2xl text-base font-semibold text-slate-400 sm:text-lg">
              Confirm the extracted profile, then start an interview tailored to the resume.
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr] xl:gap-6">
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`min-w-0 rounded-[1.75rem] border bg-neutral-900 p-5 shadow-sm transition sm:p-6 ${
                !file && !analyzing ? 'border-dashed' : ''
              } ${
                isDragging
                  ? 'border-blue-400 bg-neutral-900/95'
                  : analysis
                    ? 'border-emerald-500/35'
                    : 'border-neutral-800'
              }`}
            >
              {!file && !analyzing && (
                <div className="flex min-h-[410px] flex-col items-center justify-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                    <Icons.CloudUpload />
                  </div>
                  <h3 className="mb-2 text-xl font-black text-white">Upload Resume PDF</h3>
                  <p className="mb-8 max-w-sm text-sm font-semibold text-slate-400">
                    Drop your resume here or choose a text-based PDF up to 5MB.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:from-blue-500 hover:to-blue-400 active:scale-[0.98]"
                  >
                    Select PDF
                  </button>
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    accept=".pdf,application/pdf"
                    onChange={(e) => e.target.files?.[0] && analyzeFile(e.target.files[0])}
                  />
                </div>
              )}

              {analyzing && (
                <div className="flex min-h-[410px] flex-col justify-center">
                  <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-blue-500/20 bg-blue-500/10">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-300 border-t-transparent"></div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-2xl font-black text-white">Analyzing your resume...</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-400">
                        Extracting skills, projects and role information
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 w-2/3 animate-pulse rounded-full bg-neutral-800"></div>
                    <div className="h-24 animate-pulse rounded-3xl bg-neutral-800"></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="h-20 animate-pulse rounded-2xl bg-neutral-800"></div>
                      <div className="h-20 animate-pulse rounded-2xl bg-neutral-800"></div>
                      <div className="h-20 animate-pulse rounded-2xl bg-neutral-800"></div>
                    </div>
                  </div>
                </div>
              )}

              {file && !analyzing && (
                <div className="flex min-h-[410px] flex-col">
                  {analysis && (
                    <div className="mb-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-black text-white">Resume Analyzed Successfully</h2>
                      <p className="mt-1 text-sm font-semibold text-emerald-100/80">
                        Your resume has been extracted and analyzed.
                      </p>
                    </div>
                  )}

                  <div className="mb-5 rounded-3xl border border-neutral-800 bg-neutral-950/70 p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                        <Icons.Resume />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Uploaded PDF</p>
                        <h3 className="mt-1 break-words text-base font-black leading-snug text-white">{file.name}</h3>
                        <p className="mt-1 text-xs font-bold text-slate-500">PDF / {formatBytes(file.size)}</p>
                      </div>
                    </div>
                  </div>

                  {profile && (
                    <div className="mb-5 space-y-2">
                      {[
                        ['Detected Role', profile.detectedRole],
                        ['Experience', profile.detectedExperience],
                        ['Interview Level', profile.detectedDifficulty],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-3">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
                          <span className={`min-w-0 break-words text-right text-sm font-black ${label === 'Interview Level' ? 'text-amber-300' : 'text-slate-100'}`}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {analysis && (
                    <div className="mb-6">
                      <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">What we found</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">LinkedIn</p>
                          <p className="mt-1 text-sm font-black text-slate-100">{analysis.signals?.hasLinkedin ? 'Detected' : 'Not found'}</p>
                        </div>
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GitHub</p>
                          <p className="mt-1 text-sm font-black text-slate-100">{analysis.signals?.hasGithub ? 'Detected' : 'Not found'}</p>
                        </div>
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Readable Text</p>
                          <p className="mt-1 text-sm font-black text-slate-100">{readableWordCount ? `${readableWordCount} words` : 'Found'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto space-y-3">
                    <button
                      onClick={handleStartInterview}
                      disabled={!analysis || loadingQuestions}
                      className="inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingQuestions ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Starting...
                        </>
                      ) : (
                        'Start Resume Interview'
                      )}
                    </button>
                    <button
                      onClick={resetUpload}
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-neutral-700 px-5 text-sm font-black text-slate-300 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-200"
                    >
                      Change Resume
                    </button>
                    <p className="pt-2 text-center text-xs font-semibold leading-relaxed text-slate-500">
                      Your data is secure and will only be used for interview preparation.
                    </p>
                  </div>
                </div>
              )}

              {hasRealError && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-[1.75rem] border border-neutral-800 bg-neutral-900 p-5 shadow-sm sm:p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-white">Profile Preview</h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">Generated from your uploaded resume</p>
              </div>

              {profile ? (
                <div className="space-y-7">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Detected Role</p>
                      <p className="mt-2 break-words text-base font-black text-white">{profile.detectedRole}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Experience</p>
                      <p className="mt-2 text-base font-black text-white">{profile.detectedExperience}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/70">Interview Level</p>
                      <p className="mt-2 text-base font-black text-amber-300">{profile.detectedDifficulty}</p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-300">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </span>
                        Detected Skills
                      </h3>
                      {hiddenSkillCount > 0 && <span className="text-xs font-black text-slate-500">+{hiddenSkillCount} more</span>}
                    </div>
                    {visibleSkills.length ? (
                      <div className="flex max-w-full flex-wrap gap-2 overflow-hidden">
                        {visibleSkills.map((skill) => (
                          <span key={skill} className="max-w-full truncate rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-black text-blue-200">
                            {skill}
                          </span>
                        ))}
                        {hiddenSkillCount > 0 && (
                          <span className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-black text-slate-400">
                            +{hiddenSkillCount} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                        No strong skills detected. Try uploading a more detailed resume.
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-300">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 7h16M4 12h16M4 17h10" />
                        </svg>
                      </span>
                      Projects
                    </h3>
                    {profile.projects.length ? (
                      <div className="max-h-[340px] space-y-3 overflow-y-auto pr-2 [scrollbar-color:#2563eb_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb:hover]:bg-blue-500 [&::-webkit-scrollbar-track]:bg-transparent">
                        {profile.projects.map((project) => (
                          <div key={`${project.name}-${project.description}`} className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                            <p className="break-words text-sm font-black text-white">{project.name}</p>
                            <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-400">
                              {project.description || 'Project details detected from resume.'}
                            </p>
                            {project.technologies?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {project.technologies.slice(0, 6).map((tech) => (
                                  <span key={`${project.name}-${tech}`} className="max-w-full truncate rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] font-black text-slate-300">
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4 text-sm font-bold text-slate-400">
                        No projects detected from resume.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[410px] flex-col justify-center rounded-3xl border border-dashed border-neutral-800 p-8 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-950 text-slate-500">
                    <Icons.Interview />
                  </div>
                  <p className="text-base font-black text-slate-200">Waiting for resume analysis</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Your detected role, skills, and projects will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default ResumeInterview;
