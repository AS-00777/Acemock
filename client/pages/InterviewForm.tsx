import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { DOMAINS, DIFFICULTIES } from '../constants';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

const InterviewForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const startInFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    domain: DOMAINS[0],
    experience: 1,
    skills: '',
    difficulty: DIFFICULTIES[1]
  });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const requestSnapshot = {
        domain: formData.domain.trim(),
        experience: formData.experience,
        difficulty: String(formData.difficulty).trim(),
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (!requestSnapshot.domain) {
        throw new Error("Please select an interview domain.");
      }
      if (!requestSnapshot.difficulty) {
        throw new Error("Please select a difficulty level.");
      }
      const skillsArray = requestSnapshot.skills;
      if (skillsArray.length === 0) {
        throw new Error("Please select at least one skill before starting the interview.");
      }

      const resp = await api.post<any>('/interview/start', {
        role: requestSnapshot.domain,
        experience: String(requestSnapshot.experience),
        difficulty: requestSnapshot.difficulty,
        techStack: { skills: [...skillsArray], difficulty: requestSnapshot.difficulty, domain: requestSnapshot.domain },
      });
      const newId = resp?.interviewId ?? resp?.interview?.id;
      if (!newId) throw new Error("Failed to start interview.");
      navigate(`/interview-session/${newId}`);
    } catch (err: any) {
      console.error("Form Submission Error:", err);
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err.message || 'An unexpected error occurred. Please check your internet and try again.');
    } finally {
      startInFlightRef.current = false;
      setLoading(false);
    }
  };

  const labelClass = "text-sm font-black text-gray-700 dark:text-neutral-400 uppercase tracking-widest ml-1";
  const inputClass = "w-full bg-gray-50/80 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-all text-gray-900 dark:text-neutral-100 font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-16 bg-gray-50/30 dark:bg-neutral-950 transition-colors duration-200">
        <div className="bg-white dark:bg-neutral-900 rounded-[3rem] border border-gray-100 dark:border-neutral-800 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.1)] p-10 md:p-16 relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50/50 dark:bg-neutral-950 rounded-bl-[10rem] opacity-70 -z-0"></div>
          
          <div className="relative z-10 text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-neutral-100 mb-3">Customize Your Mock</h1>
            <p className="text-gray-500 dark:text-neutral-400 text-xl font-medium">Configure your experience and let Gemini AI build your session.</p>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-100 dark:border-red-900/30 rounded-3xl text-red-600 dark:text-red-400 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <p className="font-black uppercase text-[10px] tracking-widest mb-1">Configuration Error</p>
                <p className="font-bold">{error}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <label className={labelClass}>Target Domain</label>
                <select 
                  className={inputClass + " appearance-none cursor-pointer"}
                  value={formData.domain}
                  disabled={loading}
                  onChange={e => setFormData({...formData, domain: e.target.value})}
                >
                  {DOMAINS.map(d => <option key={d} value={d} className="bg-white dark:bg-neutral-900">{d}</option>)}
                </select>
              </div>
              
              <div className="space-y-3">
                <label className={labelClass}>Relevant Experience (Years)</label>
                <input 
                  type="number"
                  min="0"
                  max="50"
                  className={inputClass}
                  value={formData.experience}
                  disabled={loading}
                  onChange={e => setFormData({...formData, experience: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className={labelClass}>Keywords & Tech Stack (e.g. React, SQL, Logic)</label>
              <textarea 
                placeholder="List specific technologies or concepts you want to be tested on..."
                className={inputClass + " h-44 resize-none placeholder-gray-400 dark:placeholder-neutral-500"}
                value={formData.skills}
                disabled={loading}
                onChange={e => setFormData({...formData, skills: e.target.value})}
                required
              />
            </div>

            <div className="space-y-4">
              <label className={labelClass}>Challenge Level</label>
              <div className="flex gap-5">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    type="button"
                    disabled={loading}
                    onClick={() => setFormData({...formData, difficulty: d as any})}
                    className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all transform active:scale-95 shadow-md ${
                      formData.difficulty === d 
                      ? 'bg-blue-600 text-white shadow-blue-200 dark:shadow-none ring-4 ring-blue-50 dark:ring-blue-900/20' 
                      : 'bg-white dark:bg-neutral-950 text-gray-500 dark:text-neutral-400 border border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={loading}
              className={`w-full py-5 rounded-[2rem] text-white font-black text-2xl transition-all transform hover:-translate-y-1 active:scale-[0.98] shadow-2xl ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 dark:shadow-none'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-4">
                  <svg className="animate-spin h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Preparing interview...
                </span>
              ) : 'Start Interview Now'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default InterviewForm;
