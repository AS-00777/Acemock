import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Icons, DOMAINS } from '../constants';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ResumeInterview: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleFile = (selectedFile: File) => {
    setError('');
    setExtractedSkills([]);
    
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF, DOC, or DOCX file.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }

    setFile(selectedFile);
    startUploadSimulation();
  };

  const startUploadSimulation = () => {
    setUploading(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          setExtractedSkills(['React', 'Node.js', 'System Design', 'Team Leadership', 'Python', 'AWS']);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartInterview = async () => {
    setLoadingQuestions(true);
    try {
      const domain = DOMAINS[0]; 
      const resp = await api.post<any>('/interview/start', {
        role: domain,
        experience: String(3),
        techStack: { skills: extractedSkills, difficulty: 'Medium', source: 'resume' },
      });
      const newId = resp?.interviewId ?? resp?.interview?.id;
      if (!newId) throw new Error("Failed to start interview.");
      navigate(`/interview-session/${newId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError('Failed to prepare session. Please try again.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-16 transition-colors duration-200">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-4 font-poppins">Interview by Resume</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium max-w-xl mx-auto">
            Upload your professional profile. Our AI will analyze your experience and skills to create a bespoke interview journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div 
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative bg-white dark:bg-slate-800 border-4 border-dashed rounded-[3rem] p-12 transition-all group flex flex-col items-center justify-center text-center ${
                isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]' : 'border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800'
              } ${file ? 'border-emerald-200 dark:border-emerald-900/50' : ''}`}
            >
              {!file && !uploading && (
                <>
                  <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icons.CloudUpload />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Drag & Drop Resume</h3>
                  <p className="text-slate-400 dark:text-slate-500 mb-8 font-medium">Supports PDF, DOC, DOCX up to 5MB</p>
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-xl shadow-blue-500/20 dark:shadow-none active:scale-95"
                  >
                    Select File
                  </button>
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </>
              )}

              {uploading && (
                <div className="w-full max-w-sm">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Parsing Resume Content...</h3>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-4 rounded-full overflow-hidden mb-2">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <span>{progress}%</span>
                    <span>Gemini AI Analyzing</span>
                  </div>
                </div>
              )}

              {file && !uploading && (
                <div className="w-full">
                  <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <Icons.Resume />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{file.name}</h3>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-6 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Ready for Analysis
                  </p>
                  
                  <button 
                    onClick={() => { setFile(null); setExtractedSkills([]); }}
                    className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 font-bold text-sm transition-colors"
                  >
                    Change File
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 p-8 shadow-sm transition-colors h-full">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Extraction Preview</h4>
              
              {extractedSkills.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {extractedSkills.map(skill => (
                      <span key={skill} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold border border-blue-100 dark:border-blue-900/50">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="pt-6 border-t border-slate-50 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">
                      Our AI detected these core competencies. The interview questions will focus on real-world applications of these skills.
                    </p>
                    <button 
                      onClick={handleStartInterview}
                      disabled={loadingQuestions}
                      className="w-full bg-slate-900 dark:bg-slate-700 text-white py-4 rounded-2xl font-bold hover:bg-black dark:hover:bg-slate-600 transition shadow-xl dark:shadow-none active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loadingQuestions ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          Launch Session
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center opacity-30">
                  <Icons.Interview />
                  <p className="text-xs font-bold mt-4">Waiting for upload...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-16 bg-blue-50/50 dark:bg-blue-900/10 rounded-[3rem] p-10 border border-blue-100 dark:border-blue-900/20 transition-colors">
          <h4 className="text-blue-700 dark:text-blue-400 font-black text-xs uppercase tracking-widest mb-4">Architecture Insight</h4>
          <p className="text-blue-900/70 dark:text-slate-400 text-sm font-medium leading-relaxed">
            This module is built for scalability. The UI is decoupled from the storage layer. 
            When migrating to a live backend, simply swap the <code>startUploadSimulation</code> function for 
            a Firebase SDK <code>uploadBytesResumable</code> call and a PostgreSQL API endpoint to store the file URL against 
            the user profile. The UI components will remain consistent.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default ResumeInterview;
