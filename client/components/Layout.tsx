import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../constants';
import { useAuth } from '../context/AuthContext';
import { CompanyLogo, companyLogoFallbacks, companyLogos, routeCompanyToLogoKey, type CompanyLogoKey } from '../data/companyLogos';
import AccountDropdown from './AccountDropdown';

type MenuKey = 'mock' | 'aptitude' | 'resume';
type MenuItem = { label: string; to: string; description?: string; badge?: string; logoKey?: CompanyLogoKey };
type AptitudeCategory = { id: string; label: string; description: string; items: MenuItem[] };

const mockInterviewItems: MenuItem[] = [
  { label: 'Technical Interview', to: '/interview-form?type=technical', description: 'Role-based technical practice' },
  { label: 'HR Interview', to: '/interview-form?type=hr', description: 'Behavioral and culture fit rounds' },
  { label: 'Spoken English Practice', to: '/interview-form?type=spoken-english', description: 'Fluency and confidence drills' },
];

const aptitudeCategories: AptitudeCategory[] = [
  {
    id: 'all-platforms',
    label: 'All Platforms',
    description: 'Popular hiring platforms and company exam tracks.',
    items: [
      { label: 'TCS NQT', to: '/aptitude/company/tcs', logoKey: 'tcs', description: 'National qualifier test prep' },
      { label: 'TCS Digital', to: '/aptitude/company/tcs-digital', logoKey: 'tata', description: 'Advanced digital hiring track' },
      { label: 'Infosys', to: '/aptitude/company/infosys', logoKey: 'infosys', description: 'Infosys placement practice' },
      { label: 'Accenture', to: '/aptitude/company/accenture', logoKey: 'accenture', description: 'Accenture assessment prep' },
      { label: 'Cognizant GenC', to: '/aptitude/company/cognizant', logoKey: 'cognizant', description: 'GenC aptitude and reasoning' },
      { label: 'Wipro', to: '/aptitude/company/wipro', logoKey: 'wipro', description: 'Wipro placement readiness' },
      { label: 'Capgemini', to: '/aptitude/company/capgemini', logoKey: 'capgemini', description: 'Capgemini aptitude prep' },
      { label: 'HCL', to: '/aptitude/company/hcl', logoKey: 'hcl', description: 'HCL hiring practice' },
      { label: 'Tech Mahindra', to: '/aptitude/company/tech-mahindra', logoKey: 'techMahindra', description: 'Tech Mahindra exam prep' },
      { label: 'IBM', to: '/aptitude/company/ibm', logoKey: 'ibm', description: 'IBM assessment practice' },
      { label: 'Deloitte', to: '/aptitude/company/deloitte', logoKey: 'deloitte', description: 'Deloitte aptitude prep' },
      { label: 'Oracle', to: '/aptitude/company/oracle', logoKey: 'oracle', description: 'Oracle placement prep' },
    ],
  },
  {
    id: 'company-wise',
    label: 'Company Wise Tests',
    description: 'Focused company aptitude tests.',
    items: [
      { label: 'TCS Aptitude Test', to: '/aptitude/company/tcs', logoKey: 'tcs' },
      { label: 'Infosys Aptitude Test', to: '/aptitude/company/infosys', logoKey: 'infosys' },
      { label: 'Accenture Aptitude Test', to: '/aptitude/company/accenture', logoKey: 'accenture' },
      { label: 'Cognizant Aptitude Test', to: '/aptitude/company/cognizant', logoKey: 'cognizant' },
      { label: 'Wipro Aptitude Test', to: '/aptitude/company/wipro', logoKey: 'wipro' },
      { label: 'Capgemini Aptitude Test', to: '/aptitude/company/capgemini', logoKey: 'capgemini' },
      { label: 'HCL Aptitude Test', to: '/aptitude/company/hcl', logoKey: 'hcl' },
      { label: 'Tech Mahindra Aptitude Test', to: '/aptitude/company/tech-mahindra', logoKey: 'techMahindra' },
    ],
  },
  {
    id: 'aptitude',
    label: 'Aptitude Topics',
    description: 'Core aptitude topics for placement exams.',
    items: [
      { label: 'Quantitative Aptitude', to: '/aptitude/topic/quantitative' },
      { label: 'Logical Reasoning', to: '/aptitude/topic/reasoning' },
      { label: 'Verbal Ability', to: '/aptitude/topic/verbal' },
      { label: 'Data Interpretation', to: '/aptitude/topic/data-interpretation' },
      { label: 'Number System', to: '/aptitude/topic/number-system' },
      { label: 'Time and Work', to: '/aptitude/topic/time-and-work' },
      { label: 'Profit and Loss', to: '/aptitude/topic/profit-and-loss' },
      { label: 'Percentages', to: '/aptitude/topic/percentages' },
    ],
  },
  {
    id: 'technical-aptitude',
    label: 'Technical Aptitude',
    description: 'Technical MCQs and CS fundamentals.',
    items: [
      { label: 'Technical MCQ Practice', to: '/aptitude/technical' },
      { label: 'DBMS MCQs', to: '/aptitude/technical/dbms' },
      { label: 'OOP MCQs', to: '/aptitude/technical/oops' },
      { label: 'Operating System MCQs', to: '/aptitude/technical/os' },
      { label: 'Computer Networks MCQs', to: '/aptitude/technical/cn' },
      { label: 'JavaScript MCQs', to: '/aptitude/technical/javascript' },
      { label: 'React MCQs', to: '/aptitude/technical/react' },
      { label: 'Python MCQs', to: '/aptitude/technical/python' },
    ],
  },
  {
    id: 'mock-tests',
    label: 'Mock Tests',
    description: 'Timed tests for exam simulation.',
    items: [
      { label: 'Full Mock Test', to: '/mock-test/full' },
      { label: 'Aptitude Mock Test', to: '/mock-test/aptitude' },
      { label: 'Technical MCQ Mock Test', to: '/mock-test/technical' },
      { label: 'Company Specific Mock Test', to: '/mock-test/company' },
    ],
  },
  {
    id: 'placement-patterns',
    label: 'Placement Patterns',
    description: 'Latest company selection pattern guides.',
    items: [
      { label: 'TCS Placement Pattern', to: '/placement-patterns/tcs', logoKey: 'tcs' },
      { label: 'Infosys Placement Pattern', to: '/placement-patterns/infosys', logoKey: 'infosys' },
      { label: 'Accenture Placement Pattern', to: '/placement-patterns/accenture', logoKey: 'accenture' },
      { label: 'Cognizant Placement Pattern', to: '/placement-patterns/cognizant', logoKey: 'cognizant' },
      { label: 'Wipro Placement Pattern', to: '/placement-patterns/wipro', logoKey: 'wipro' },
      { label: 'Capgemini Placement Pattern', to: '/placement-patterns/capgemini', logoKey: 'capgemini' },
    ],
  },
];

const resumeToolItems: MenuItem[] = [
  { label: 'Resume Builder', to: '/resume-builder', description: 'Create polished, ATS-ready resumes' },
  { label: 'ATS Score Checker', to: '/ats-checker', description: 'Find parsing and keyword gaps' },
  { label: 'Resume vs Job Description Analyzer', to: '/resume-analyzer', description: 'Compare your resume against a role' },
];

const ChevronIcon = ({ open }: { open?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const PreparationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

const getLogoKeyFromRoute = (to: string): CompanyLogoKey | undefined => {
  const companyMatch = to.match(/\/(?:aptitude\/company|placement-patterns)\/([^/?]+)/);
  return companyMatch ? routeCompanyToLogoKey[companyMatch[1]] : undefined;
};

const MenuItemIconShell = ({ children, active }: { children: React.ReactNode; active: boolean }) => (
  <span className={`grid h-10 w-12 flex-shrink-0 place-items-center rounded-xl border text-current transition ${
    active
      ? 'border-[#3b82f6] bg-blue-50 text-blue-700 dark:bg-[#202020] dark:text-white'
      : 'border-slate-200 bg-slate-50 text-slate-600 group-hover:border-blue-200 group-hover:bg-blue-50 dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#f5f5f5] dark:group-hover:border-[#3a3a3a] dark:group-hover:bg-[#202020]'
  }`}>
    {children}
  </span>
);

const CalculatorIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 7h8" />
    <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
  </svg>
);

const BrainIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4.5A3 3 0 0 0 6 7.4 3.6 3.6 0 0 0 4 14a3.4 3.4 0 0 0 4.5 4.6" />
    <path d="M15 4.5a3 3 0 0 1 3 2.9 3.6 3.6 0 0 1 2 6.6 3.4 3.4 0 0 1-4.5 4.6" />
    <path d="M9 4.5v15M15 4.5v15" />
    <path d="M9 9h3M12 15h3" />
  </svg>
);

const TextIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 4h14" />
    <path d="M12 4v16" />
    <path d="M8 20h8" />
  </svg>
);

const BarChartIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19h16" />
    <rect x="6" y="10" width="3" height="6" rx="1" />
    <rect x="11" y="6" width="3" height="10" rx="1" />
    <rect x="16" y="12" width="3" height="4" rx="1" />
  </svg>
);

const HashIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const TrendingIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m4 16 6-6 4 4 6-7" />
    <path d="M14 7h6v6" />
  </svg>
);

const PercentIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m19 5-14 14" />
    <circle cx="7" cy="7" r="2" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4h6l1 2h3v15H5V6h3l1-2Z" />
    <path d="m8.5 13 2 2 5-5" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);

const CodeIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m8 9-4 3 4 3" />
    <path d="m16 9 4 3-4 3" />
    <path d="m14 5-4 14" />
  </svg>
);

const DatabaseIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="7" ry="3" />
    <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
    <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
  </svg>
);

const LayersIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
    <path d="m4 12 8 4.5 8-4.5" />
    <path d="m4 16.5 8 4.5 8-4.5" />
  </svg>
);

const MonitorIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8" />
    <path d="M12 16v4" />
  </svg>
);

const NetworkIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.2 2.6 3.3 5.6 3.3 9S14.2 18.4 12 21" />
    <path d="M12 3c-2.2 2.6-3.3 5.6-3.3 9S9.8 18.4 12 21" />
  </svg>
);

const JavaScriptIcon = () => (
  <span className="grid h-6 w-6 place-items-center rounded bg-yellow-300 text-[10px] font-black tracking-tight text-slate-950" aria-hidden="true">JS</span>
);

const ReactLogoIcon = () => (
  <svg className="h-6 w-6 text-cyan-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="currentColor" strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" />
  </svg>
);

const PythonIcon = () => (
  <span className="relative grid h-6 w-6 place-items-center overflow-hidden rounded-md text-[9px] font-black text-white" aria-hidden="true">
    <span className="absolute inset-x-0 top-0 h-1/2 bg-[#3776ab]" />
    <span className="absolute inset-x-0 bottom-0 h-1/2 bg-yellow-400" />
    <span className="relative text-[9px] text-slate-950">PY</span>
  </span>
);

const getMenuItemIcon = (to: string) => {
  if (to.endsWith('/quantitative')) return <CalculatorIcon />;
  if (to.endsWith('/reasoning')) return <BrainIcon />;
  if (to.endsWith('/verbal')) return <TextIcon />;
  if (to.endsWith('/data-interpretation')) return <BarChartIcon />;
  if (to.endsWith('/number-system')) return <HashIcon />;
  if (to.endsWith('/time-and-work')) return <ClockIcon />;
  if (to.endsWith('/profit-and-loss')) return <TrendingIcon />;
  if (to.endsWith('/percentages')) return <PercentIcon />;
  if (to === '/aptitude/technical') return <CodeIcon />;
  if (to.endsWith('/dbms')) return <DatabaseIcon />;
  if (to.endsWith('/oops')) return <LayersIcon />;
  if (to.endsWith('/os')) return <MonitorIcon />;
  if (to.endsWith('/cn')) return <NetworkIcon />;
  if (to.endsWith('/javascript')) return <JavaScriptIcon />;
  if (to.endsWith('/react')) return <ReactLogoIcon />;
  if (to.endsWith('/python')) return <PythonIcon />;
  if (to === '/mock-test/full') return <ClipboardIcon />;
  if (to === '/mock-test/aptitude') return <CalculatorIcon />;
  if (to === '/mock-test/technical') return <CodeIcon />;
  if (to === '/mock-test/company') return <BriefcaseIcon />;
  return null;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuestDropdownOpen, setIsGuestDropdownOpen] = useState(false);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<MenuKey | null>(null);
  const [openMobileSections, setOpenMobileSections] = useState<Record<MenuKey, boolean>>({
    mock: false,
    aptitude: false,
    resume: false,
  });
  const [activeAptitudeCategoryId, setActiveAptitudeCategoryId] = useState(aptitudeCategories[0].id);
  const [openMobileAptitudeCategoryId, setOpenMobileAptitudeCategoryId] = useState(aptitudeCategories[0].id);
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const guestDropdownRef = useRef<HTMLDivElement>(null);
  const closeHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pathname = location.pathname;
  const currentPathWithSearch = `${location.pathname}${location.search}`;

  const closeAllMenus = useCallback(() => {
    setIsMobileMenuOpen(false);
    setIsGuestDropdownOpen(false);
    setOpenDesktopMenu(null);
  }, []);

  useEffect(() => {
    closeAllMenus();
    setOpenMobileSections({ mock: false, aptitude: false, resume: false });
  }, [pathname, closeAllMenus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (navRef.current && !navRef.current.contains(target)) {
        setOpenDesktopMenu(null);
      }
      if (guestDropdownRef.current && !guestDropdownRef.current.contains(target)) {
        setIsGuestDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAllMenus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeAllMenus]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = () => {
    logout();
    closeAllMenus();
    navigate('/login');
  };

  const isRouteActive = useCallback((to: string) => {
    const [route, query] = to.split('?');
    if (query) return currentPathWithSearch === to;
    if (route === '/') return pathname === '/';
    return pathname === route || pathname.startsWith(`${route}/`);
  }, [currentPathWithSearch, pathname]);

  const matchedAptitudeCategory = useMemo(() => {
    return aptitudeCategories.find((category) => category.items.some((item) => isRouteActive(item.to))) ?? null;
  }, [isRouteActive]);

  const visibleAptitudeCategory = useMemo(() => {
    return aptitudeCategories.find((category) => category.id === activeAptitudeCategoryId) ?? matchedAptitudeCategory ?? aptitudeCategories[0];
  }, [activeAptitudeCategoryId, matchedAptitudeCategory]);

  useEffect(() => {
    if (matchedAptitudeCategory) {
      setActiveAptitudeCategoryId(matchedAptitudeCategory.id);
      setOpenMobileAptitudeCategoryId(matchedAptitudeCategory.id);
    }
  }, [matchedAptitudeCategory]);

  const isMenuActive = useCallback((key: MenuKey) => {
    if (key === 'mock') return pathname.startsWith('/interview') || pathname === '/resume-interview';
    if (key === 'aptitude') return pathname.startsWith('/aptitude') || pathname.startsWith('/mock-test') || pathname.startsWith('/placement-patterns');
    return pathname === '/resume-builder' || pathname === '/ats-checker' || pathname === '/resume-analyzer' || pathname === '/resume-interview';
  }, [pathname]);

  const openMenuWithHover = (key: MenuKey) => {
    if (closeHoverTimer.current) window.clearTimeout(closeHoverTimer.current);
    setOpenDesktopMenu(key);
  };

  const delayCloseDesktopMenu = () => {
    if (closeHoverTimer.current) window.clearTimeout(closeHoverTimer.current);
    closeHoverTimer.current = setTimeout(() => setOpenDesktopMenu(null), 120);
  };

  const toggleMobileSection = (key: MenuKey) => {
    setOpenMobileSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const desktopNavClass = (active: boolean) =>
    `group inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-black tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
      active
        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-[#202020] dark:text-white dark:ring-transparent'
        : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700 hover:ring-1 hover:ring-blue-100 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-white dark:hover:ring-transparent'
    }`;

  const linkClass = (active: boolean) =>
    `block rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] ${
      active
        ? 'bg-blue-50 text-blue-700 dark:bg-[#202020] dark:text-white'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
    }`;

  const dropdownItemClass = (active: boolean) =>
    `block rounded-[14px] border px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] ${
      active
        ? 'border-[#3b82f6] bg-blue-50 text-blue-700 dark:bg-[#202020] dark:text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-slate-950 dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#f5f5f5] dark:hover:border-[#3a3a3a] dark:hover:bg-[#202020]'
    }`;

  const mobileBaseLinks = useMemo(() => [
    { label: 'Home', to: '/', icon: <Icons.Home /> },
    { label: 'Dashboard', to: '/dashboard', icon: <Icons.Dashboard /> },
  ], []);

  const DesktopDropdown = ({ menuKey, children, className = 'w-80' }: { menuKey: MenuKey; children: React.ReactNode; className?: string }) => {
    if (openDesktopMenu !== menuKey) return null;
    const baseClass = menuKey === 'aptitude'
      ? 'absolute left-1/2 top-[calc(100%+0.85rem)] z-[90] -translate-x-1/2 rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 dark:border-[#2a2a2a] dark:bg-[#111111] dark:shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
      : 'absolute left-1/2 top-[calc(100%+0.85rem)] z-[90] -translate-x-1/2 rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 dark:border-[#2a2a2a] dark:bg-[#111111] dark:shadow-[0_10px_30px_rgba(0,0,0,0.18)]';
    return (
      <div
        onMouseEnter={() => openMenuWithHover(menuKey)}
        onMouseLeave={delayCloseDesktopMenu}
        className={`${baseClass} ${className}`}
      >
        {children}
      </div>
    );
  };

  const DesktopMenuButton = ({ menuKey, label, icon }: { menuKey: MenuKey; label: string; icon: React.ReactNode }) => {
    const active = isMenuActive(menuKey);
    const open = openDesktopMenu === menuKey;
    return (
      <div className="relative" onMouseEnter={() => openMenuWithHover(menuKey)} onMouseLeave={delayCloseDesktopMenu}>
        <button
          type="button"
          className={desktopNavClass(active || open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={`${menuKey}-desktop-menu`}
          onClick={() => setOpenDesktopMenu(open ? null : menuKey)}
          onFocus={() => setOpenDesktopMenu(menuKey)}
        >
          <span className={active || open ? 'text-blue-600 dark:text-white' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'}>{icon}</span>
          {label}
          <ChevronIcon open={open} />
        </button>
      </div>
    );
  };

  const SimpleDesktopLink = ({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) => {
    const active = isRouteActive(to);
    return (
      <Link to={to} className={desktopNavClass(active)}>
        <span className={active ? 'text-blue-600 dark:text-white' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'}>{icon}</span>
        {label}
      </Link>
    );
  };

  const MobileLink = ({ item, icon }: { item: MenuItem; icon?: React.ReactNode }) => {
    const active = isRouteActive(item.to);
    const logoKey = item.logoKey ?? getLogoKeyFromRoute(item.to);
    return (
      <Link
        to={item.to}
        onClick={closeAllMenus}
        className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
          active
            ? 'bg-blue-50 text-blue-700 dark:bg-[#202020] dark:text-white'
            : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
        }`}
      >
        {icon && <span className={active ? 'text-blue-600 dark:text-white' : 'text-slate-400'}>{icon}</span>}
        {logoKey && <CompanyLogo src={companyLogos[logoKey]} alt={`${item.label} logo`} variant="menu" fallback={companyLogoFallbacks[logoKey]} active={active} />}
        {!logoKey && item.badge && (
          <span className={`grid h-9 w-11 flex-shrink-0 place-items-center rounded-xl text-[10px] font-black tracking-tight ${
            active ? 'bg-blue-50 text-blue-700 dark:bg-[#202020] dark:text-white' : 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-300'
          }`}>
            {item.badge}
          </span>
        )}
        <span>{item.label}</span>
      </Link>
    );
  };

  const LogoChip = ({ item, active, compact = false }: { item: MenuItem; active: boolean; compact?: boolean }) => {
    const logoKey = item.logoKey ?? getLogoKeyFromRoute(item.to);
    if (logoKey) return <CompanyLogo src={companyLogos[logoKey]} alt={`${item.label} logo`} variant="menu" fallback={companyLogoFallbacks[logoKey]} active={active} />;
    const menuIcon = getMenuItemIcon(item.to);
    if (menuIcon) return <MenuItemIconShell active={active}>{menuIcon}</MenuItemIconShell>;
    if (!item.badge) return null;
    return (
      <span className={`grid flex-shrink-0 place-items-center rounded-xl font-black tracking-tight shadow-sm transition-all ${
        compact ? 'h-9 w-11 text-[10px]' : 'h-11 w-12 text-[10px]'
      } ${
        active
          ? 'bg-blue-50 text-blue-700 ring-1 ring-[#3b82f6] dark:bg-[#202020] dark:text-white'
          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-[#171717] dark:text-[#f5f5f5] dark:ring-[#2a2a2a]'
      }`}>
        {item.badge}
      </span>
    );
  };

  const AptitudeItemCard = ({ item, compact = false }: { item: MenuItem; compact?: boolean }) => {
    const active = isRouteActive(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={closeAllMenus}
        className={`group flex min-h-[4.25rem] items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          active
            ? 'border-[#3b82f6] bg-blue-50 text-slate-950 dark:bg-[#202020] dark:text-white'
            : 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50 dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#f5f5f5] dark:hover:border-[#3a3a3a] dark:hover:bg-[#202020]'
        }`}
      >
        <LogoChip item={item} active={active} compact={compact} />
        <span className="min-w-0">
          <span className={`block truncate font-black ${compact ? 'text-sm' : 'text-[14px]'}`}>{item.label}</span>
          {item.description && <span className="mt-1.5 block truncate text-xs font-semibold text-slate-500 dark:text-[#9ca3af]">{item.description}</span>}
        </span>
      </Link>
    );
  };

  const MobileAccordion = ({ menuKey, label, icon, children }: { menuKey: MenuKey; label: string; icon: React.ReactNode; children: React.ReactNode }) => {
    const open = openMobileSections[menuKey];
    const active = isMenuActive(menuKey);
    return (
      <section className="rounded-[1.35rem] border border-slate-100 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => toggleMobileSection(menuKey)}
          className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
            active || open ? 'bg-slate-50 text-slate-950 dark:bg-neutral-800 dark:text-neutral-100' : 'text-slate-600 dark:text-neutral-300'
          }`}
          aria-expanded={open}
        >
          <span className="flex items-center gap-3">
            <span className={active || open ? 'text-[#3b82f6]' : 'text-slate-400'}>{icon}</span>
            {label}
          </span>
          <ChevronIcon open={open} />
        </button>
        <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="space-y-1 px-2 pb-2 pt-1">{children}</div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-slate-50/30 text-slate-900 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-100">
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-[60] bg-slate-950/45 animate-in fade-in duration-200 md:hidden"
          onClick={closeAllMenus}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[70] flex w-[min(22rem,calc(100vw-1.5rem))] transform flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden dark:bg-neutral-900 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-neutral-800">
          <Link to="/" onClick={closeAllMenus} className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#2563eb] text-[11px] font-black text-white shadow-lg shadow-[rgba(37,99,235,0.2)]">AM</div>
            <span className="truncate font-poppins text-lg font-black uppercase tracking-tight">AceMock AI</span>
          </Link>
          <button
            type="button"
            onClick={closeAllMenus}
            className="grid h-11 w-11 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="Close navigation menu"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {mobileBaseLinks.map((item) => (
            <MobileLink key={item.to} item={item} icon={item.icon} />
          ))}

          <MobileAccordion menuKey="mock" label="Mock Interview" icon={<Icons.Interview />}>
            {mockInterviewItems.map((item) => <MobileLink key={item.to} item={item} />)}
          </MobileAccordion>

          <MobileAccordion menuKey="aptitude" label="Aptitude" icon={<PreparationIcon />}>
            {aptitudeCategories.map((category) => {
              const open = openMobileAptitudeCategoryId === category.id;
              const active = category.items.some((item) => isRouteActive(item.to));
              return (
                <div key={category.id} className="rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setOpenMobileAptitudeCategoryId(open ? '' : category.id)}
                    className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                      active || open ? 'bg-blue-50 text-blue-700 dark:bg-[#202020] dark:text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                    aria-expanded={open}
                  >
                    <span>{category.label}</span>
                    <ChevronIcon open={open} />
                  </button>
                  <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="space-y-2 px-2 pb-3 pt-2">
                        {category.items.map((item) => <AptitudeItemCard key={item.to} item={item} compact />)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </MobileAccordion>

          <MobileAccordion menuKey="resume" label="Resume Tools" icon={<Icons.Resume />}>
            {resumeToolItems.map((item) => <MobileLink key={item.to} item={item} />)}
          </MobileAccordion>
        </div>

        {profile && (
          <div className="border-t border-slate-100 p-4 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Icons.LogOut />
              Log Out
            </button>
          </div>
        )}
      </aside>

      <nav className="sticky top-0 z-50 h-20 border-b border-slate-100 bg-white shadow-sm shadow-slate-200/20 transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-slate-950/20">
        <div ref={navRef} className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 lg:gap-5">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] md:hidden dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <MenuIcon />
            </button>

            <Link to="/" className="group flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-[#2563eb] text-[11px] font-black text-white shadow-lg shadow-[rgba(37,99,235,0.2)] transition-transform duration-300 group-hover:rotate-6 dark:shadow-none">AM</div>
              <span className="truncate font-poppins text-lg font-black uppercase tracking-tight text-slate-900 sm:text-xl dark:text-neutral-100">AceMock AI</span>
            </Link>
          </div>

          <div className="hidden flex-1 items-center justify-center gap-1 md:flex" role="menubar" aria-label="Primary navigation">
            <SimpleDesktopLink to="/" label="Home" icon={<Icons.Home />} />
            <DesktopMenuButton menuKey="mock" label="Mock Interview" icon={<Icons.Interview />} />
            <DesktopMenuButton menuKey="aptitude" label="Aptitude" icon={<PreparationIcon />} />
            <DesktopMenuButton menuKey="resume" label="Resume Tools" icon={<Icons.Resume />} />
            {profile && <SimpleDesktopLink to="/dashboard" label="Dashboard" icon={<Icons.Dashboard />} />}
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            {profile ? (
              <AccountDropdown profile={profile} onLogout={handleLogout} />
            ) : (
              <div className="relative" ref={guestDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsGuestDropdownOpen((open) => !open)}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-transparent px-3 text-slate-500 transition-all hover:border-slate-100 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] dark:text-neutral-400 dark:hover:border-neutral-800 dark:hover:bg-neutral-800"
                  aria-haspopup="menu"
                  aria-expanded={isGuestDropdownOpen}
                >
                  <Icons.Profile />
                  <span className="hidden text-sm font-black sm:block">Account</span>
                </button>

                {isGuestDropdownOpen && (
                  <div className="absolute right-0 z-[100] mt-3 w-48 rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-neutral-800 dark:bg-neutral-900">
                    <Link to="/login" onClick={closeAllMenus} className={linkClass(pathname.startsWith('/login'))}>Login</Link>
                    <Link to="/signup" onClick={closeAllMenus} className={linkClass(pathname.startsWith('/signup'))}>Sign Up</Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <DesktopDropdown menuKey="mock">
            <div id="mock-desktop-menu" role="menu" className="space-y-2">
              {mockInterviewItems.map((item) => (
                <Link key={item.to} to={item.to} onClick={closeAllMenus} className={dropdownItemClass(isRouteActive(item.to))}>
                  <span className="block font-semibold">{item.label}</span>
                  {item.description && <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-[#9ca3af]">{item.description}</span>}
                </Link>
              ))}
            </div>
          </DesktopDropdown>

          <DesktopDropdown menuKey="aptitude" className="aptitude-mega-menu w-[min(72rem,calc(100vw-2rem))] p-0">
            <div id="aptitude-desktop-menu" role="menu" className="aptitude-mega-shell grid grid-cols-[15rem_1fr] overflow-hidden text-slate-900 dark:text-white">
              <aside className="aptitude-mega-scroll border-r border-slate-200 bg-slate-50 p-4 dark:border-[#2a2a2a] dark:bg-[#111111]">
                <p className="px-3 pb-4 pt-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-[#9ca3af]">Aptitude Prep</p>
                <div className="space-y-2">
                  {aptitudeCategories.map((category) => {
                    const selected = visibleAptitudeCategory.id === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onMouseEnter={() => setActiveAptitudeCategoryId(category.id)}
                        onFocus={() => setActiveAptitudeCategoryId(category.id)}
                        onClick={() => setActiveAptitudeCategoryId(category.id)}
                        className={`relative w-full rounded-xl border px-4 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          selected
                            ? 'border-[#3b82f6] border-l-[3px] bg-white text-slate-950 shadow-sm dark:bg-[#202020] dark:text-white'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50 dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#f5f5f5] dark:hover:border-[#3a3a3a] dark:hover:bg-[#202020]'
                        }`}
                      >
                        <span className="block text-sm font-black">{category.label}</span>
                        <span className="mt-1.5 block pr-4 text-xs font-semibold text-slate-500 dark:text-[#9ca3af]">{category.description}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>
              <section className="aptitude-mega-scroll aptitude-mega-content min-w-0 bg-white p-6 dark:bg-[#111111]">
                <div className="aptitude-mega-content-inner">
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-950 dark:text-white">{visibleAptitudeCategory.label}</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-[#9ca3af]">{visibleAptitudeCategory.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ring-1 ring-slate-200 dark:bg-[#171717] dark:text-[#9ca3af] dark:ring-[#2a2a2a]">AceMock AI</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {visibleAptitudeCategory.items.map((item) => <AptitudeItemCard key={item.to} item={item} />)}
                  </div>
                </div>
              </section>
            </div>
          </DesktopDropdown>

          <DesktopDropdown menuKey="resume">
            <div id="resume-desktop-menu" role="menu" className="space-y-2">
              {resumeToolItems.map((item) => (
                <Link key={item.to} to={item.to} onClick={closeAllMenus} className={dropdownItemClass(isRouteActive(item.to))}>
                  <span className="block font-semibold">{item.label}</span>
                  {item.description && <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-[#9ca3af]">{item.description}</span>}
                </Link>
              ))}
            </div>
          </DesktopDropdown>
        </div>
      </nav>

      <main className="min-w-0 flex-grow">{children}</main>

      <footer className="mt-20 border-t border-slate-100 bg-white py-16 transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <h3 className="mb-6 flex items-center gap-3 text-2xl font-black text-[#2563eb]">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-[10px] font-black text-white">AM</div>
              AceMock AI
            </h3>
            <p className="max-w-sm text-base font-medium leading-relaxed text-slate-500 dark:text-neutral-400">
              Revolutionizing professional preparation through Generative AI. The most trusted interview simulation platform for global tech talent.
            </p>
          </div>
          <div>
            <h4 className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-neutral-100">Navigation</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-500 dark:text-neutral-400">
              <li><Link to="/dashboard" className="transition-colors hover:text-[#2563eb] dark:hover:text-[#60a5fa]">Performance Center</Link></li>
              <li><Link to="/interview-form" className="transition-colors hover:text-[#2563eb] dark:hover:text-[#60a5fa]">Mock Engine</Link></li>
              <li><Link to="/resume-interview" className="transition-colors hover:text-[#2563eb] dark:hover:text-[#60a5fa]">Resume Analysis</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-neutral-100">Company</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-500 dark:text-neutral-400">
              <li><Link to="/help" className="transition-colors hover:text-[#2563eb] dark:hover:text-[#60a5fa]">Support</Link></li>
              <li><Link to="/pricing" className="transition-colors hover:text-[#2563eb] dark:hover:text-[#60a5fa]">Pricing</Link></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-7xl border-t border-slate-50 px-6 pt-8 text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:border-neutral-800 dark:text-neutral-500">
          © 2026 ACEMOCK AI. MADE FOR THE NEXT GENERATION OF LEADERS.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
