import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Icons } from '../constants';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';

const HISTORY_PAGE_SIZE = 4;

const Dashboard: React.FC = () => {
  const { profile, logout } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setHistoryLoading(true);
      try {
        const data = await api.get<{ items: any[]; total: number; page: number; limit: number }>(
          `/interview/history?page=${historyPage}&limit=${HISTORY_PAGE_SIZE}`
        );
        setSessions(data.items || []);
        setHistoryTotal(data.total || 0);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout();
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    };

    fetchData();
  }, [profile, navigate, logout, historyPage]);

  const totalPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));
  const pageStart = historyTotal === 0 ? 0 : (historyPage - 1) * HISTORY_PAGE_SIZE + 1;
  const pageEnd = Math.min(historyPage * HISTORY_PAGE_SIZE, historyTotal);

  const handleDeleteInterview = async (interviewId: number) => {
    const ok = window.confirm('Delete this interview and all related answers/results?');
    if (!ok) return;

    setDeletingId(interviewId);
    try {
      await api.delete<{ deleted: boolean }>(`/interview/${interviewId}`);
      const remainingOnPage = sessions.length - 1;
      if (remainingOnPage <= 0 && historyPage > 1) {
        setHistoryPage((page) => page - 1);
      } else {
        const data = await api.get<{ items: any[]; total: number }>(
          `/interview/history?page=${historyPage}&limit=${HISTORY_PAGE_SIZE}`
        );
        setSessions(data.items || []);
        setHistoryTotal(data.total || 0);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      console.error('Delete interview failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-slate-500 dark:text-neutral-400 font-bold">Loading your dashboard...</p>
      </div>
    </Layout>
  );

  if (!profile) return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors duration-200">
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-xl shadow-slate-200/40 dark:shadow-slate-950/20 p-10 transition-colors">
              <div className="text-center mb-8">
                <div className="relative inline-block mb-6">
                  <img 
                    src={profile.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} 
                    className="w-28 h-28 rounded-3xl object-cover ring-4 ring-blue-50 dark:ring-neutral-950 shadow-xl"
                    alt="User"
                  />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white dark:border-neutral-800 rounded-full"></div>
                </div>
                <h2 className="text-2xl font-black font-poppins text-slate-900 dark:text-neutral-100 leading-tight mb-1">{profile.name}</h2>
                <p className="text-slate-400 dark:text-neutral-400 text-xs font-bold tracking-tight mb-6">{profile.email}</p>
                
                <Link to="/profile-setup" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all">
                  <Icons.Edit /> Update Profile
                </Link>

                {(profile.city || profile.country) && (
                   <p className="text-slate-400 dark:text-neutral-400 text-[10px] mt-6 flex items-center justify-center gap-1.5 font-black uppercase tracking-widest">
                      <Icons.MapPin /> {profile.city}, {profile.country}
                   </p>
                )}
              </div>
              
              <div className="space-y-6">
                <div className="p-5 bg-slate-50 dark:bg-neutral-950/50 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-sm transition-colors">
                  <p className="text-[10px] font-black text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-1">Weekly Streak</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                    🔥 {profile.streakCount} Days
                  </p>
                </div>
                
                <div>
                  <h4 className="font-black text-[10px] text-slate-400 dark:text-neutral-400 mb-4 uppercase tracking-widest px-1">Top Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {(profile.skills || []).map((s, i) => (
                      <span key={i} className="px-3 py-1.5 bg-slate-50 dark:bg-neutral-950 text-slate-600 dark:text-neutral-400 rounded-xl text-[10px] font-black border border-slate-100 dark:border-neutral-800 uppercase tracking-tighter hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-neutral-800">
                  <h4 className="font-black text-[10px] text-slate-400 dark:text-neutral-400 mb-4 uppercase tracking-widest px-1">Accomplishments</h4>
                  <div className="flex gap-2">
                    {(profile.badges || []).map((b, i) => (
                      <div key={i} className="w-12 h-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-yellow-100/50 dark:border-yellow-900/20 hover:scale-110 transition-transform cursor-help" title={b}>
                        🏆
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-neutral-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-sm gap-6 transition-colors">
              <div className="text-center sm:text-left">
                <h1 className="text-3xl font-black font-poppins text-slate-900 dark:text-neutral-100 tracking-tight">Performance Center</h1>
                <p className="text-slate-500 dark:text-neutral-400 font-medium text-lg">Analytics for your AI-evaluated sessions.</p>
              </div>
              <Link to="/interview-form" className="w-full sm:w-auto bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-95 hover:-translate-y-1">
                Launch Mock AI
              </Link>
            </div>

            {sessions.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 border-4 border-dashed border-slate-100 dark:border-neutral-800 rounded-[3rem] p-24 text-center transition-colors">
                <div className="bg-slate-50 dark:bg-neutral-950 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-300 dark:text-neutral-500">
                  <Icons.Interview />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 mb-4 font-poppins">No Interview History</h3>
                <p className="text-slate-500 dark:text-neutral-400 max-w-sm mx-auto mb-10 font-medium text-lg">
                  Start your first mock session to begin generating performance data and insights.
                </p>
                <Link to="/interview-form" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black uppercase text-xs tracking-[0.2em] hover:gap-4 transition-all">
                  Launch Interview Engine →
                </Link>
              </div>
            ) : (
              <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-neutral-100 font-poppins">Interview History</h2>
                  <p className="text-sm font-semibold text-slate-500 dark:text-neutral-400 mt-1">
                    Showing {pageStart}-{pageEnd} of {historyTotal} sessions
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    disabled={historyPage <= 1 || historyLoading}
                    className="px-5 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 font-black text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    Previous
                  </button>
                  <div className="px-4 py-3 rounded-2xl bg-slate-900 dark:bg-neutral-800 text-white font-black text-xs tabular-nums">
                    {historyPage}/{totalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryPage((page) => Math.min(totalPages, page + 1))}
                    disabled={historyPage >= totalPages || historyLoading}
                    className="px-5 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 transition-opacity ${historyLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {sessions.map((s: any) => (
                  <div key={String(s.id)} className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-slate-100 dark:border-neutral-800 p-6 sm:p-7 hover:shadow-2xl hover:shadow-slate-200/60 dark:hover:shadow-slate-950/60 transition-all group relative overflow-hidden flex flex-col min-h-[330px]">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-slate-50 dark:bg-neutral-950/50 rounded-bl-[5rem] -z-0 opacity-50 group-hover:scale-110 transition-transform"></div>
                    
                    <div className="relative z-10 flex-grow">
                      <div className="flex justify-between items-start gap-4 mb-7">
                        <div className="flex flex-col gap-2">
                           <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/50 inline-block w-fit">
                            {s.role || 'Interview'}
                          </div>
                          {s.status !== 'COMPLETED' && (
                             <div className="px-4 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900/30 inline-block w-fit animate-pulse">
                               In Progress
                             </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 dark:text-neutral-400 font-bold uppercase whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString()}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteInterview(Number(s.id))}
                            disabled={deletingId === Number(s.id)}
                            aria-label="Delete interview"
                            title="Delete interview"
                            className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-900/30 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      </div>
                      
                      <h4 className="text-xl sm:text-2xl font-bold mb-7 text-slate-900 dark:text-neutral-100 font-poppins">
                        {(s.techStack && (s.techStack.difficulty || s.techStack.level)) ? (s.techStack.difficulty || s.techStack.level) : 'Mock'} Session
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4 mb-7">
                        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-neutral-950/50 rounded-2xl border border-slate-100 dark:border-neutral-800 group-hover:bg-white dark:group-hover:bg-neutral-800 transition-colors">
                          <div className="text-[10px] font-black text-slate-400 dark:text-neutral-400 uppercase mb-1 tracking-widest">AI Score</div>
                          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-neutral-100">{s.result?.overallScore ?? 0}%</div>
                        </div>
                        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-neutral-950/50 rounded-2xl border border-slate-100 dark:border-neutral-800 group-hover:bg-white dark:group-hover:bg-neutral-800 transition-colors">
                          <div className="text-[10px] font-black text-slate-400 dark:text-neutral-400 uppercase mb-1 tracking-widest">Rating</div>
                          <div className="flex text-yellow-400 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <svg key={i} className={`w-4 h-4 ${i < Math.round(((s.result?.overallScore ?? 0) / 100) * 5) ? 'fill-current' : 'text-slate-200 dark:text-neutral-500'}`} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {s.status === 'COMPLETED' ? (
                        <Link to={`/result/${s.id}`} className="block text-center py-4 bg-slate-900 dark:bg-neutral-800 text-white rounded-2xl font-bold group-hover:bg-blue-600 dark:group-hover:bg-blue-500 transition-all active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-none text-xs sm:text-sm uppercase tracking-widest hover:-translate-y-1">
                          View Deep Analysis
                        </Link>
                      ) : (
                        <Link to={`/interview-session/${s.id}`} className="block text-center py-4 bg-blue-600 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-xl shadow-blue-500/10 dark:shadow-none text-xs sm:text-sm uppercase tracking-widest hover:-translate-y-1">
                          Resume Interview
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
