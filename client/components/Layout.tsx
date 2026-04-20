import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icons } from '../constants';
import { useAuth } from '../context/AuthContext';
import AccountDropdown from './AccountDropdown';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuestDropdownOpen, setIsGuestDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const guestDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close mobile menu on route change
    setIsMobileMenuOpen(false);
    setIsGuestDropdownOpen(false);
  }, [location]);

  // Handle click outside for guest dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (guestDropdownRef.current && !guestDropdownRef.current.contains(event.target as Node)) {
        setIsGuestDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const NavLink: React.FC<{ to: string; label: string; icon: React.ReactNode }> = ({ to, label, icon }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`relative flex items-center gap-2 py-2 transition-all duration-300 group whitespace-nowrap`}
      >
        <span className={`${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400'}`}>
          {icon}
        </span>
        <span className={`text-[13px] font-bold tracking-tight ${
          isActive 
          ? 'text-slate-900 dark:text-slate-100' 
          : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
        }`}>
          {label}
        </span>
        {isActive && (
          <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-blue-600 rounded-full animate-in fade-in zoom-in duration-300"></span>
        )}
      </Link>
    );
  };

  const MobileNavLink: React.FC<{ 
    to: string; 
    label: string; 
    icon: React.ReactNode; 
    onClick?: () => void;
  }> = ({ to, label, icon, onClick }) => {
    const isActive = location.pathname === to;
    
    return (
      <Link 
        to={to} 
        onClick={onClick}
        className={`flex items-center gap-4 px-6 py-3.5 rounded-2xl transition-all duration-200 ${
          isActive
            ? 'text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700/50'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }`}
      >
        <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
        <span className="font-bold">{label}</span>
      </Link>
    );
  };

  const PricingIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/30 dark:bg-slate-900 transition-colors duration-200">
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm md:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Side Drawer (Left Side) */}
      <aside className={`fixed top-0 left-0 bottom-0 z-[70] w-72 bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20">
                <span className="block font-black text-xs">AM</span>
              </div>
              <span className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">AceMock</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Drawer Links */}
          <div className="flex-grow p-4 space-y-1 overflow-y-auto">
            <MobileNavLink to="/" label="Home" icon={<Icons.Home />} />
            
            {profile && (
              <>
                <MobileNavLink to="/dashboard" label="Dashboard" icon={<Icons.Dashboard />} />
                <div className="px-6 pt-4 pb-1 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Practice</div>
                <MobileNavLink to="/interview-form" label="Start Mock" icon={<Icons.Interview />} />
                <MobileNavLink to="/resume-interview" label="Resume Mock" icon={<Icons.Resume />} />
                <div className="px-6 pt-4 pb-1 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mt-4">Subscription</div>
                <MobileNavLink to="/pricing" label="Pricing" icon={<PricingIcon />} />
              </>
            )}
          </div>

          {/* Drawer Footer Logout */}
          {profile && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-700">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Icons.LogOut />
                <span className="font-bold">Log Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Navbar */}
      <nav className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-700 sticky top-0 z-50 h-20 flex items-center shadow-sm shadow-slate-200/20 dark:shadow-slate-950/20 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between relative">
          
          {/* Left Group */}
          <div className="flex items-center gap-4 md:gap-8">
            {/* Hamburger (Mobile Only) */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none group-hover:rotate-6 transition-all duration-300">
                <span className="block w-5 h-5 flex items-center justify-center font-black text-[10px]">AM</span>
              </div>
              <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-slate-100 font-poppins uppercase">AceMock</span>
            </Link>
          </div>
          
          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-8 lg:gap-10">
            {profile && (
              <>
                <NavLink to="/" label="Home" icon={<Icons.Home />} />
                <NavLink to="/dashboard" label="Dashboard" icon={<Icons.Dashboard />} />
                <NavLink to="/interview-form" label="Start Mock" icon={<Icons.Interview />} />
                <NavLink to="/resume-interview" label="Resume Mock" icon={<Icons.Resume />} />
                <NavLink to="/pricing" label="Pricing" icon={<PricingIcon />} />
              </>
            )}
          </div>
          
          {/* Right Group: Account Group */}
          <div className="flex items-center gap-4 lg:gap-8">
            {/* Home link on the right only when not signed in */}
            {!profile && (
              <div className="hidden md:block">
                <NavLink to="/" label="Home" icon={<Icons.Home />} />
              </div>
            )}
            
            <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
              {profile ? (
                <AccountDropdown profile={profile} onLogout={handleLogout} />
              ) : (
                <div className="relative" ref={guestDropdownRef}>
                  <button 
                    onClick={() => setIsGuestDropdownOpen(!isGuestDropdownOpen)}
                    className="flex items-center justify-center p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <Icons.Profile />
                      <span className="hidden sm:block text-sm font-bold">Account</span>
                    </div>
                  </button>
                  
                  {isGuestDropdownOpen && (
                    <div className="absolute right-0 mt-3 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 p-2 z-[100] animate-in zoom-in-95 duration-200">
                      <Link to="/login" className="block w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Login</Link>
                      <Link to="/signup" className="block w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">Sign Up</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 py-16 mt-20 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-black text-blue-600 mb-6 flex items-center gap-3">
              <div className="bg-blue-600 text-white p-1.5 rounded-xl">
                <span className="block w-4 h-4 flex items-center justify-center font-black text-[10px]">AM</span>
              </div>
              AceMock AI
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm text-base leading-relaxed font-medium">
              Revolutionizing professional preparation through Generative AI. 
              The most trusted interview simulation platform for global tech talent.
            </p>
          </div>
          <div>
            <h4 className="font-black mb-6 text-slate-900 dark:text-slate-100 uppercase text-[10px] tracking-[0.2em]">Navigation</h4>
            <ul className="space-y-4 text-slate-500 dark:text-slate-400 font-bold text-sm">
              <li><Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Performance Center</Link></li>
              <li><Link to="/interview-form" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Mock Engine</Link></li>
              <li><Link to="/resume-interview" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Resume Analysis</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black mb-6 text-slate-900 dark:text-slate-100 uppercase text-[10px] tracking-[0.2em]">Company</h4>
            <ul className="space-y-4 text-slate-500 dark:text-slate-400 font-bold text-sm">
              <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Support</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 text-center mt-16 pt-8 border-t border-slate-50 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
          © 2025 ACEMOCK AI. MADE FOR THE NEXT GENERATION OF LEADERS.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
