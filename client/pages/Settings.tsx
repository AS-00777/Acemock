import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../constants';

const Settings: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!profile) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-16 transition-colors duration-200">
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-2 font-poppins">Account Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Manage your profile and application preferences.</p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Profile Section */}
          <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl p-8 md:p-12 transition-all hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-slate-950/50">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl ring-2 ring-blue-50 dark:ring-blue-900/20">
                  <img 
                    src={profile.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} 
                    className="w-full h-full object-cover" 
                    alt="Profile"
                  />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{profile.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{profile.email}</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                    {profile.skills.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-[10px] font-black uppercase tracking-tighter bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                        {s}
                      </span>
                    ))}
                    {profile.skills.length > 3 && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">+{profile.skills.length - 3} more</span>}
                  </div>
                </div>
              </div>
              <Link 
                to="/profile-setup" 
                className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-700 transition shadow-xl shadow-blue-500/20 dark:shadow-none active:scale-95 flex items-center justify-center gap-3"
              >
                <Icons.Edit /> Update Profile
              </Link>
            </div>
            
            <div className="mt-10 pt-8 border-t border-slate-50 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Experience</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{profile.experienceLevel || 'Not Set'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Language</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{profile.preferredLanguage || 'English'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Location</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{profile.city || 'N/A'}, {profile.country || 'N/A'}</p>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl p-8 md:p-12 transition-colors">
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 mb-8">
              <Icons.Settings />
              <h2 className="text-xs font-black uppercase tracking-[0.2em]">Account Actions</h2>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-red-50 dark:bg-red-950/20 rounded-[2rem] border border-red-100 dark:border-red-900/30">
              <div className="text-center md:text-left">
                <h4 className="text-lg font-bold text-red-700 dark:text-red-400 mb-1">Session Management</h4>
                <p className="text-sm text-red-600/70 dark:text-red-400/60 font-medium">Log out from your current browser session. All progress is saved.</p>
              </div>
              <button 
                onClick={() => setShowConfirm(true)}
                className="w-full md:w-auto bg-red-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-red-700 transition shadow-xl shadow-red-500/20 dark:shadow-none active:scale-95 flex items-center justify-center gap-3"
              >
                <Icons.LogOut /> Logout
              </button>
            </div>
          </section>
        </div>

        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowConfirm(false)}></div>
            <div className="relative bg-white dark:bg-slate-800 rounded-[3rem] p-10 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-700 animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                <Icons.LogOut />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-4 text-center">Ready to Leave?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-10 font-medium">You can always log back in to continue your interview practice journey.</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleLogout}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 transition active:scale-95 shadow-xl shadow-red-500/10"
                >
                  Confirm Logout
                </button>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="w-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 py-4 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95"
                >
                  Stay Signed In
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-16 text-center text-slate-400 dark:text-slate-600 font-bold text-xs uppercase tracking-widest">
          Auth Persistence Managed via Browser Cache
          <div className="mt-2 text-[10px] opacity-50 max-w-xs mx-auto">
            Future updates will include Firebase Authentication for cross-device sync and PostgreSQL storage for historical data.
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
