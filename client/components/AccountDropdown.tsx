
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile } from '../types';
import { Icons } from '../constants';

interface AccountDropdownProps {
  profile: UserProfile;
  onLogout: () => void;
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({ profile, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus:outline-none group"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex flex-col items-end hidden sm:flex">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{profile.name}</span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Account</span>
        </div>
        <div className="relative">
          <img 
            src={profile.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} 
            className="w-10 h-10 rounded-xl object-cover ring-2 ring-white dark:ring-slate-700 shadow-md group-hover:ring-blue-500/30 transition-all duration-300"
            alt="Profile"
          />
          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] dark:shadow-slate-950/60 overflow-hidden animate-in fade-in zoom-in slide-in-from-top-2 duration-200 z-[100] border border-slate-100 dark:border-slate-700">
          {/* Top Section */}
          <div className="p-7 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
            <div className="w-14 h-14 rounded-2xl overflow-hidden ring-4 ring-blue-500/10 dark:ring-blue-400/10 shadow-sm">
              <img 
                src={profile.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} 
                className="w-full h-full object-cover" 
                alt="Avatar" 
              />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-black text-lg leading-none mb-1 tracking-tight truncate text-slate-900 dark:text-slate-100">{profile.name}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest truncate">{profile.email}</span>
            </div>
          </div>

          {/* Menu Options */}
          <div className="p-4 space-y-1">
            <Link 
              to="/pricing" 
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3.5 px-4 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group"
            >
              <div className="text-amber-500 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">Upgrade Plan</span>
              <span className="ml-auto text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg font-black uppercase tracking-widest border border-amber-200 dark:border-amber-800">Pro</span>
            </Link>

            <Link 
              to="/profile-setup" 
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3.5 px-4 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group"
            >
              <div className="text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-110 transition-all">
                <Icons.Profile />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">Personalization</span>
            </Link>

            <Link 
              to="/settings" 
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3.5 px-4 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group"
            >
              <div className="text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-110 transition-all">
                <Icons.Settings />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">Settings</span>
            </Link>

            <Link 
              to="/help" 
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3.5 px-4 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group"
            >
              <div className="text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-110 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">Help</span>
            </Link>

            <div className="my-2 border-t border-slate-100 dark:border-slate-700 mx-2"></div>

            <button 
              onClick={() => { setIsOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-all group"
            >
              <div className="group-hover:scale-110 transition-transform">
                <Icons.LogOut />
              </div>
              <span className="text-sm font-bold tracking-tight">Log Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;
