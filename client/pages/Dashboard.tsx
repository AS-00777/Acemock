import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, ChevronLeft, ChevronRight, FileCheck, Flame, Mic, MonitorCheck, PlayCircle } from 'lucide-react';
import Layout from '../components/Layout';
import BadgeIcon, { badgeIconKeys, defaultBadgeIconByCode } from '../components/BadgeIcon';
import AchievementUnlockedModal from '../components/AchievementUnlockedModal';
import { Icons } from '../constants';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';

const HISTORY_PAGE_SIZE = 4;

type EarnedBadge = {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string | null;
  target_value: number | null;
  earned_at: string;
};

type BadgeItem = {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string | null;
  target_value: number | null;
};

type BadgeShowcaseItem = (EarnedBadge | BadgeItem) & {
  earned: boolean;
  earned_at?: string;
};

type NextBadge = {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string | null;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
} | null;

type BadgeDashboardResponse = {
  earnedBadges: EarnedBadge[];
  lockedBadges?: BadgeItem[];
  allBadges?: BadgeItem[];
  totalEarned: number;
  totalBadges?: number;
  currentStreak: number;
  nextBadge: NextBadge;
  newlyAwardedBadges?: EarnedBadge[];
};

type ActivityDay = {
  date: string;
  count: number;
  totalActivityCount?: number;
  interviewCount: number;
  aptitudeCount: number;
  technicalMcqCount: number;
  resumeScanCount: number;
  spokenPracticeCount: number;
};

type HeatmapCell =
  | {
      date: string;
      totalActivityCount: number;
      isPlaceholder: false;
    }
  | {
      isPlaceholder: true;
    };

type HeatmapMonth = {
  key: string;
  label: string;
  weeks: HeatmapCell[][];
};

type ActivityCalendarResponse = {
  totalActiveDays: number;
  currentStreak: number;
  maxStreak: number;
  totalActivities: number;
  interviewCount: number;
  aptitudeCount: number;
  technicalMcqCount: number;
  resumeScanCount: number;
  spokenPracticeCount: number;
  days: ActivityDay[];
};

type CareerReadinessResponse = {
  avgInterviewScore: number;
  completedInterviewCount: number;
  avgAptitudeScore: number;
  completedAptitudeCount: number;
  bestAtsScore: number;
  resumeScanCount: number;
  currentStreak: number;
};

type AptitudeHistoryItem = {
  testId: number;
  title: string;
  company: string | null;
  section: string | null;
  topic: string | null;
  difficulty: string | null;
  totalQuestions: number;
  durationMinutes: number | null;
  status: string;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
};

type DashboardTab = 'recent' | 'interviews' | 'aptitude' | 'technical' | 'resume';
type InterviewFilter = 'all' | 'mock' | 'resume';

type FocusTask = {
  title: string;
  description: string;
  status: 'Pending' | 'Continue' | 'Suggested' | 'Done' | 'Coming Soon';
  action: string;
  to?: string;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

const emptyCalendar: ActivityCalendarResponse = {
  totalActiveDays: 0,
  currentStreak: 0,
  maxStreak: 0,
  totalActivities: 0,
  interviewCount: 0,
  aptitudeCount: 0,
  technicalMcqCount: 0,
  resumeScanCount: 0,
  spokenPracticeCount: 0,
  days: [],
};

const emptyReadiness: CareerReadinessResponse = {
  avgInterviewScore: 0,
  completedInterviewCount: 0,
  avgAptitudeScore: 0,
  completedAptitudeCount: 0,
  bestAtsScore: 0,
  resumeScanCount: 0,
  currentStreak: 0,
};

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'recent', label: 'Recent Activity' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'aptitude', label: 'Aptitude' },
  { id: 'technical', label: 'Technical MCQ' },
  { id: 'resume', label: 'Resume' },
];

const technicalAptitudeSections = new Set(['React Engineer', 'DevOps Engineer', 'AI & ML', 'SAP Engineer']);

const isTechnicalAptitudeItem = (item: Pick<AptitudeHistoryItem, 'title' | 'section'>) => {
  return technicalAptitudeSections.has(item.section || '') || /technical|mcq/i.test(item.title || '');
};

const getInterviewSource = (item: any) => {
  const raw = item?.interviewSource ?? item?.interview_source ?? item?.techStack?.interview_source ?? item?.techStack?.source;
  return String(raw || 'MOCK_FORM').toUpperCase() === 'RESUME' ? 'RESUME' : 'MOCK_FORM';
};

const getInterviewSourceLabel = (item: any) => getInterviewSource(item) === 'RESUME' ? 'Resume Interview' : 'Mock Interview';

const badgeIconFor = (badge: Pick<BadgeShowcaseItem, 'code' | 'icon'>) => {
  if (badge.icon && badgeIconKeys.has(badge.icon)) return badge.icon;
  return defaultBadgeIconByCode[badge.code] || 'target';
};

const heatColor = (count: number) => {
  if (count <= 0) return 'bg-slate-100 border-slate-200 dark:bg-neutral-900 dark:border-neutral-800';
  if (count === 1) return 'bg-blue-100 border-blue-200 dark:bg-blue-950 dark:border-blue-900';
  if (count === 2) return 'bg-blue-300 border-blue-300 dark:bg-blue-700 dark:border-blue-700';
  return 'bg-blue-700 border-blue-700 dark:bg-blue-400 dark:border-blue-400';
};

const focusStatusClass = (status: FocusTask['status']) => {
  if (status === 'Done') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (status === 'Continue' || status === 'Pending') return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
  if (status === 'Coming Soon') return 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400';
  return 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300';
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const useResponsivePageSize = () => {
  const getSize = () => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 4;
  };
  const [pageSize, setPageSize] = useState(getSize);

  useEffect(() => {
    const onResize = () => setPageSize(getSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return pageSize;
};

const useResponsiveBadgeCount = () => {
  const getCount = () => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 2;
    if (window.innerWidth < 1024) return 3;
    return 4;
  };
  const [count, setCount] = useState(getCount);

  useEffect(() => {
    const onResize = () => setCount(getCount());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return count;
};

const EmptyState = ({ title, button, to }: { title: string; button: string; to: string }) => (
  <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
      <Icons.Interview />
    </div>
    <p className="text-lg font-black text-slate-900 dark:text-neutral-100">{title}</p>
    <Link to={to} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 text-sm font-black uppercase tracking-widest text-white transition hover:bg-blue-700">
      {button}
    </Link>
  </div>
);

const Dashboard: React.FC = () => {
  const { profile, logout } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [aptitudeHistory, setAptitudeHistory] = useState<AptitudeHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('recent');
  const [interviewFilter, setInterviewFilter] = useState<InterviewFilter>('all');
  const [badgeIndex, setBadgeIndex] = useState(0);
  const [selectedBadgeCode, setSelectedBadgeCode] = useState<string | null>(null);
  const [activeAchievement, setActiveAchievement] = useState<EarnedBadge | null>(null);
  const [toastBadge, setToastBadge] = useState<EarnedBadge | null>(null);
  const [newBadgeCodes, setNewBadgeCodes] = useState<Set<string>>(() => new Set());
  const [badgeData, setBadgeData] = useState<BadgeDashboardResponse>({
    earnedBadges: [],
    lockedBadges: [],
    allBadges: [],
    totalEarned: 0,
    totalBadges: 0,
    currentStreak: 0,
    nextBadge: null,
    newlyAwardedBadges: [],
  });
  const [activityCalendar, setActivityCalendar] = useState<ActivityCalendarResponse>(emptyCalendar);
  const [careerReadiness, setCareerReadiness] = useState<CareerReadinessResponse>(emptyReadiness);
  const navigate = useNavigate();
  const pageSize = useResponsivePageSize();
  const visibleBadgeCount = useResponsiveBadgeCount();
  const badgeCardRef = useRef<HTMLDivElement | null>(null);

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scrollToBadgeCard = () => {
    badgeCardRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    });
    badgeCardRef.current?.focus({ preventScroll: true });
  };

  const handleViewAchievementBadges = () => {
    setActiveAchievement(null);
    setToastBadge(null);
    scrollToBadgeCard();
  };

  const handleBadgeAchievements = (badges: BadgeDashboardResponse) => {
    if (typeof window === 'undefined' || !profile?.id) return;

    const earned = Array.isArray(badges?.earnedBadges) ? badges.earnedBadges : [];
    if (earned.length === 0) return;

    const storageKey = `acemock_seen_badges_${profile.id}`;
    const storedValue = window.localStorage.getItem(storageKey);
    let seenCodes = new Set<string>();

    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue);
        if (Array.isArray(parsed)) seenCodes = new Set(parsed.filter((code): code is string => typeof code === 'string'));
      } catch {
        seenCodes = new Set();
      }
    }

    const newlyAwarded = Array.isArray(badges?.newlyAwardedBadges) ? badges.newlyAwardedBadges : [];
    const newlyAwardedCodes = new Set(newlyAwarded.map((badge) => badge.code));
    const badgesToShow =
      storedValue === null
        ? earned.filter((badge) => newlyAwardedCodes.has(badge.code))
        : earned.filter((badge) => !seenCodes.has(badge.code));

    if (badgesToShow.length > 0) {
      const latestBadge = badgesToShow[0];
      setActiveAchievement(latestBadge);
      setToastBadge(latestBadge);
      setSelectedBadgeCode(latestBadge.code);
      setNewBadgeCodes(new Set(badgesToShow.map((badge) => badge.code)));
    }

    const allSeenCodes = new Set([...seenCodes, ...earned.map((badge) => badge.code)]);
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(allSeenCodes)));
  };

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      setHistoryLoading(true);
      try {
        const [data, recent, aptitude, badges, calendar, readiness] = await Promise.all([
          api.get<{ items: any[]; total: number; page: number; limit: number }>(
            `/interview/history?page=${historyPage}&limit=${pageSize}`
          ),
          api.get<{ items: any[]; total: number }>(`/interview/history?page=1&limit=5`),
          api.get<{ items: AptitudeHistoryItem[] }>('/aptitude/tests/history').catch((aptitudeErr) => {
            if (aptitudeErr instanceof ApiError && aptitudeErr.status === 401) throw aptitudeErr;
            console.warn('Aptitude history fetch failed:', aptitudeErr);
            return null;
          }),
          api.get<BadgeDashboardResponse>('/dashboard/badges').catch((badgeErr) => {
            if (badgeErr instanceof ApiError && badgeErr.status === 401) throw badgeErr;
            console.warn('Badge dashboard fetch failed:', badgeErr);
            return null;
          }),
          api.get<ActivityCalendarResponse>('/dashboard/activity-calendar').catch((calendarErr) => {
            if (calendarErr instanceof ApiError && calendarErr.status === 401) throw calendarErr;
            console.warn('Activity calendar fetch failed:', calendarErr);
            return null;
          }),
          api.get<CareerReadinessResponse>('/dashboard/career-readiness').catch((readinessErr) => {
            if (readinessErr instanceof ApiError && readinessErr.status === 401) throw readinessErr;
            console.warn('Career readiness fetch failed:', readinessErr);
            return null;
          }),
        ]);
        setSessions(Array.isArray(data.items) ? data.items : []);
        setRecentItems(Array.isArray(recent.items) ? recent.items : []);
        if (aptitude) setAptitudeHistory(Array.isArray(aptitude.items) ? aptitude.items : []);
        setHistoryTotal(Number(data.total ?? 0));
        if (badges) {
          setBadgeData(badges);
          handleBadgeAchievements(badges);
        }
        if (calendar) setActivityCalendar({ ...emptyCalendar, ...calendar, days: Array.isArray(calendar.days) ? calendar.days : [] });
        if (readiness) setCareerReadiness({ ...emptyReadiness, ...readiness });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logout();
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    };

    fetchData();
  }, [profile, navigate, logout, historyPage, pageSize]);

  useEffect(() => {
    if (!activeAchievement) return;
    const timeoutId = window.setTimeout(() => setActiveAchievement(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [activeAchievement]);

  useEffect(() => {
    if (!toastBadge) return;
    const timeoutId = window.setTimeout(() => setToastBadge(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toastBadge]);

  useEffect(() => {
    if (newBadgeCodes.size === 0) return;
    const timeoutId = window.setTimeout(() => setNewBadgeCodes(new Set()), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [newBadgeCodes]);

  useEffect(() => {
    if (!activeAchievement || prefersReducedMotion()) return;

    let cancelled = false;
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return;
        confetti({
          particleCount: 45,
          spread: 58,
          startVelocity: 34,
          ticks: 120,
          origin: { y: 0.62 },
          colors: ['#2563eb', '#60a5fa', '#f59e0b'],
        });
        window.setTimeout(() => {
          if (cancelled) return;
          confetti({
            particleCount: 28,
            spread: 72,
            startVelocity: 28,
            ticks: 100,
            origin: { y: 0.58 },
            colors: ['#2563eb', '#93c5fd', '#fbbf24'],
          });
        }, 350);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeAchievement]);

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeRecentItems = Array.isArray(recentItems) ? recentItems : [];
  const safeAptitudeHistory = Array.isArray(aptitudeHistory) ? aptitudeHistory : [];
  const completedAptitudeItems = safeAptitudeHistory.filter(
    (item) => item.status === 'COMPLETED' && !isTechnicalAptitudeItem(item)
  );
  const completedTechnicalItems = safeAptitudeHistory.filter(
    (item) => item.status === 'COMPLETED' && isTechnicalAptitudeItem(item)
  );
  const unfinishedInterview = [...safeRecentItems, ...safeSessions].find((item) => item?.id && item?.status !== 'COMPLETED');
  const todayFocusTasks: FocusTask[] = [
    unfinishedInterview
      ? {
          title: 'Continue Mock Interview',
          description: 'Resume your unfinished interview',
          status: 'Continue',
          action: 'Continue',
          to: `/interview-session/${unfinishedInterview.id}`,
          icon: PlayCircle,
        }
      : {
          title: 'Start Mock Interview',
          description: 'Practice a fresh interview round',
          status: 'Suggested',
          action: 'Start',
          to: '/interview-form',
          icon: Mic,
        },
    {
      title: 'Aptitude Practice',
      description: 'Improve speed and accuracy',
      status: completedAptitudeItems.length > 0 ? 'Done' : 'Suggested',
      action: 'Start',
      to: '/aptitude',
      icon: Brain,
    },
  ].slice(0, 3);
  const safeHistoryTotal = Number.isFinite(Number(historyTotal)) ? Number(historyTotal) : 0;
  const filteredSessions = safeSessions.filter((item) => {
    const source = getInterviewSource(item);
    if (interviewFilter === 'resume') return source === 'RESUME';
    if (interviewFilter === 'mock') return source !== 'RESUME';
    return true;
  });
  const earnedBadges = Array.isArray(badgeData?.earnedBadges) ? badgeData.earnedBadges : [];
  const allBadges = Array.isArray(badgeData?.allBadges) ? badgeData.allBadges : [];
  const lockedBadges = Array.isArray(badgeData?.lockedBadges)
    ? badgeData.lockedBadges
    : allBadges.filter((badge) => !earnedBadges.some((earned) => earned.code === badge.code));
  const nextBadge = badgeData?.nextBadge ?? null;
  const badgeEarnedCount = Number.isFinite(Number(badgeData?.totalEarned)) ? Number(badgeData.totalEarned) : earnedBadges.length;
  const totalBadgeCount = Number.isFinite(Number(badgeData?.totalBadges)) ? Number(badgeData.totalBadges) : allBadges.length;
  const badgeShowcase: BadgeShowcaseItem[] = [
    ...earnedBadges.map((badge) => ({ ...badge, earned: true })),
    ...lockedBadges.map((badge) => ({ ...badge, earned: false, earned_at: '' })),
  ];
  const selectedBadge = badgeShowcase.find((badge) => badge.code === selectedBadgeCode) ?? badgeShowcase[badgeIndex] ?? badgeShowcase[0] ?? null;
  const visibleBadges = badgeShowcase.slice(badgeIndex, badgeIndex + visibleBadgeCount);
  const calendarDays = Array.isArray(activityCalendar?.days) ? activityCalendar.days : [];
  const currentStreak = Math.max(
    Number(careerReadiness?.currentStreak ?? 0),
    Number(activityCalendar?.currentStreak ?? 0),
    Number(badgeData?.currentStreak ?? 0),
    Number(profile?.streakCount ?? 0)
  );
  const totalPages = Math.max(1, Math.ceil(safeHistoryTotal / pageSize));
  const pageStart = safeHistoryTotal === 0 ? 0 : (historyPage - 1) * pageSize + 1;
  const pageEnd = Math.min(historyPage * pageSize, safeHistoryTotal);
  const interviewProgress = Number(careerReadiness?.avgInterviewScore ?? 0);
  const aptitudeProgress = Number(careerReadiness?.avgAptitudeScore ?? 0);
  const resumeProgress = Number(careerReadiness?.bestAtsScore ?? 0);
  const streakProgress = Math.min((currentStreak / 7) * 100, 100);
  const careerReadinessScore = Math.round(
    interviewProgress * 0.4 +
    aptitudeProgress * 0.25 +
    resumeProgress * 0.2 +
    streakProgress * 0.15
  );

  const heatmapMonths = useMemo<HeatmapMonth[]>(() => {
    const formatDateKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const addDays = (date: Date, count: number) => {
      const next = new Date(date);
      next.setDate(next.getDate() + count);
      return next;
    };

    const getRollingMonthDays = () => {
      const today = new Date();
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 8, 1);
      const days: Date[] = [];
      for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
        days.push(new Date(cursor));
      }
      return days;
    };

    const realDays = getRollingMonthDays();
    const activityMap = new Map<string, number>();

    calendarDays.forEach((day) => {
      if (!day?.date) return;
      const rawCount = Number((day as ActivityDay & { totalActivityCount?: number }).totalActivityCount ?? day.count ?? 0);
      activityMap.set(day.date, (activityMap.get(day.date) ?? 0) + rawCount);
    });

    const byMonth = new Map<string, Date[]>();
    realDays.forEach((day) => {
      const monthKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;
      const existing = byMonth.get(monthKey) ?? [];
      existing.push(day);
      byMonth.set(monthKey, existing);
    });

    return Array.from(byMonth.entries()).map(([key, days]) => {
      const monthWeeks: HeatmapCell[][] = [];
      let currentWeek: HeatmapCell[] = [];
      const firstDay = days[0];

      for (let i = 0; i < firstDay.getDay(); i += 1) {
        currentWeek.push({ isPlaceholder: true });
      }

      days.forEach((day) => {
        const dateKey = formatDateKey(day);
        currentWeek.push({
          date: dateKey,
          totalActivityCount: activityMap.get(dateKey) ?? 0,
          isPlaceholder: false,
        });

        if (currentWeek.length === 7) {
          monthWeeks.push(currentWeek);
          currentWeek = [];
        }
      });

      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push({ isPlaceholder: true });
        }
        monthWeeks.push(currentWeek);
      }

      return {
        key,
        label: firstDay.toLocaleDateString(undefined, { month: 'short' }),
        weeks: monthWeeks,
      };
    });
  }, [calendarDays]);

  const moveBadges = (direction: -1 | 1) => {
    if (!badgeShowcase.length) return;
    const maxStart = Math.max(0, badgeShowcase.length - visibleBadgeCount);
    const nextIndex = Math.max(0, Math.min(maxStart, badgeIndex + direction));
    setBadgeIndex(nextIndex);
    setSelectedBadgeCode(badgeShowcase[nextIndex]?.code ?? null);
  };

  const handleDeleteInterview = async (interviewId: number) => {
    const ok = window.confirm('Delete this interview and all related answers/results?');
    if (!ok) return;

    setDeletingId(interviewId);
    try {
      await api.delete<{ deleted: boolean }>(`/interview/${interviewId}`);
      const remainingOnPage = safeSessions.length - 1;
      if (remainingOnPage <= 0 && historyPage > 1) {
        setHistoryPage((page) => page - 1);
      } else {
        const data = await api.get<{ items: any[]; total: number }>(
          `/interview/history?page=${historyPage}&limit=${pageSize}`
        );
        setSessions(Array.isArray(data.items) ? data.items : []);
        setHistoryTotal(Number(data.total ?? 0));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      console.error('Delete interview failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const renderInterviewCards = (items: any[]) => {
    if (items.length === 0) {
      return <EmptyState title="No interview history yet." button="Start Mock Interview" to="/interview-form" />;
    }

    return (
      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 transition-opacity ${historyLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {items.map((s: any) => (
          <div key={String(s.id)} className="relative flex min-h-[310px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-xl hover:shadow-slate-200/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:shadow-black/20">
            <div className="absolute right-0 top-0 -z-0 h-40 w-40 rounded-bl-[5rem] bg-slate-50 opacity-50 transition-transform group-hover:scale-110 dark:bg-neutral-800"></div>
            <div className="relative z-10 flex-grow">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="inline-block w-fit rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                    {s?.role || 'Interview'}
                  </div>
                  {s?.status !== 'COMPLETED' && (
                    <div className="inline-block w-fit rounded-xl border border-red-100 bg-red-50 px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                      In Progress
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500">{s?.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Recent'}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteInterview(Number(s.id))}
                    disabled={deletingId === Number(s.id)}
                    aria-label="Delete interview"
                    title="Delete interview"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>

              <h4 className="mb-7 text-xl font-bold capitalize text-slate-900 sm:text-2xl dark:text-neutral-100">
                {(s?.techStack && (s.techStack.difficulty || s.techStack.level)) ? (s.techStack.difficulty || s.techStack.level) : 'Mock'} Session
              </h4>
              <div className="mb-5 inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                {getInterviewSourceLabel(s)}
              </div>

              <div className="mb-7 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors group-hover:bg-white sm:p-5 dark:border-neutral-800 dark:bg-neutral-950 dark:group-hover:bg-neutral-900">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">AI Score</div>
                  <div className="text-2xl font-black text-slate-900 sm:text-3xl dark:text-neutral-100">{s?.result?.overallScore ?? 0}%</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors group-hover:bg-white sm:p-5 dark:border-neutral-800 dark:bg-neutral-950 dark:group-hover:bg-neutral-900">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Rating</div>
                  <div className="mt-1 flex text-yellow-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className={`h-4 w-4 ${i < Math.round(((s?.result?.overallScore ?? 0) / 100) * 5) ? 'fill-current' : 'text-slate-200 dark:text-neutral-600'}`} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ))}
                  </div>
                </div>
              </div>

              {s?.status === 'COMPLETED' ? (
                <Link to={`/result/${s.id}`} className="block rounded-2xl bg-slate-900 py-4 text-center text-xs font-bold uppercase tracking-widest text-white shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-1 hover:bg-blue-600 active:scale-95 dark:bg-neutral-800 dark:hover:bg-blue-500">
                  View Deep Analysis
                </Link>
              ) : (
                <Link to={`/interview-session/${s.id}`} className="block rounded-2xl bg-blue-600 py-4 text-center text-xs font-bold uppercase tracking-widest text-white shadow-xl shadow-blue-500/10 transition-all hover:-translate-y-1 active:scale-95">
                  Resume Interview
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAptitudeRows = (items: AptitudeHistoryItem[], emptyTitle: string, emptyButton: string, emptyTo: string) => {
    if (items.length === 0) {
      return <EmptyState title={emptyTitle} button={emptyButton} to={emptyTo} />;
    }

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-neutral-800">
        {items.map((item) => (
          <div key={String(item.testId)} className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 last:border-b-0 dark:border-neutral-800 md:grid-cols-[1.4fr_0.8fr_150px_144px] md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <Brain className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-slate-900 dark:text-neutral-100">{item.title || 'Practice Test'}</p>
                <p className="text-xs font-bold text-slate-400 dark:text-neutral-500">
                  {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {item.section || 'Practice'}
            </span>
            <div className="whitespace-nowrap text-sm font-black text-slate-700 dark:text-neutral-300">
              {Math.round(Number(item.score ?? 0))}% · Completed
            </div>
            <Link to={`/preparation/aptitude/result/${item.testId}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-600 dark:bg-neutral-800 dark:hover:bg-blue-500">
              View Result
            </Link>
          </div>
        ))}
      </div>
    );
  };

  const renderTodayFocusCard = () => (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/20">
      <div className="mb-3">
        <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Today&apos;s Focus</p>
        <p className="text-sm font-bold text-slate-500 dark:text-neutral-400">Your next best practice steps</p>
      </div>

      <div className="space-y-3">
        {todayFocusTasks.map((task) => {
          const Icon = task.icon;
          const actionClass = task.disabled
            ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-neutral-800 dark:text-neutral-500'
            : 'bg-blue-600 text-white hover:bg-blue-700';

          return (
            <div key={task.title} className="flex min-h-[118px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-blue-900">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-black leading-tight text-slate-900 dark:text-neutral-100">{task.title}</p>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${focusStatusClass(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs font-semibold leading-4 text-slate-500 dark:text-neutral-400">{task.description}</p>
                </div>
              </div>
              {task.to && !task.disabled ? (
                <Link to={task.to} className={`mt-2 inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 text-[10px] font-black uppercase tracking-widest transition ${actionClass}`}>
                  {task.action}
                </Link>
              ) : (
                <button type="button" disabled className={`mt-2 inline-flex min-h-8 w-full items-center justify-center rounded-xl px-3 text-[10px] font-black uppercase tracking-widest ${actionClass}`}>
                  {task.action}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const PaginationControls = () => (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={historyPage <= 1 || historyLoading} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:border-blue-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-blue-900">Previous</button>
      <div className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black tabular-nums text-white dark:bg-neutral-800">{historyPage}/{totalPages}</div>
      <button type="button" onClick={() => setHistoryPage((page) => Math.min(totalPages, page + 1))} disabled={historyPage >= totalPages || historyLoading} className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
    </div>
  );

  if (loading) return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-4 font-bold text-slate-500 dark:text-neutral-400">Loading your dashboard...</p>
      </div>
    </Layout>
  );

  if (!profile) return null;

  const profileName = profile?.name || 'AceMock User';
  const profileEmail = profile?.email || '';
  const profileSkills = Array.isArray(profile?.skills) ? profile.skills : [];
  const profileCity = profile?.city || '';
  const profileCountry = profile?.country || '';
  const profileImage =
    profile?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profileName)}`;

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 transition-colors duration-200 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-8">
          <aside className="space-y-6 lg:col-span-1">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/20">
              <div className="mb-8 text-center">
                <div className="relative mb-6 inline-block">
                  <img
                    src={profileImage}
                    className="h-24 w-24 rounded-3xl object-cover shadow-xl ring-4 ring-blue-50 dark:ring-neutral-950 sm:h-28 sm:w-28"
                    alt="User"
                  />
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-4 border-white bg-emerald-500 dark:border-neutral-900"></div>
                </div>
                <h2 className="mb-1 text-2xl font-black leading-tight text-slate-900 dark:text-neutral-100">{profileName}</h2>
                <p className="mb-6 text-xs font-bold tracking-tight text-slate-400 dark:text-neutral-400">{profileEmail}</p>
                <Link to="/profile-setup" className="inline-flex items-center gap-2 rounded-xl bg-blue-50/70 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-all hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50">
                  <Icons.Edit /> Update Profile
                </Link>
                {(profileCity || profileCountry) && (
                  <p className="mt-6 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                    <Icons.MapPin /> {[profileCity, profileCountry].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Weekly Streak</p>
                  <p className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-neutral-100">
                    <BadgeIcon icon="flame" earned size="sm" /> {currentStreak} Days
                  </p>
                </div>

                <div>
                  <h4 className="mb-4 px-1 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Top Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {profileSkills.map((s, i) => (
                      <span key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-tighter text-slate-600 transition-colors hover:border-blue-200 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-blue-900">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:pt-5">
              {renderTodayFocusCard()}
            </div>
          </aside>

          <main className="space-y-6 lg:col-span-3 lg:space-y-8">
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="self-start rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:p-4">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <h2 className="whitespace-nowrap text-xl font-black tracking-tight text-slate-900 dark:text-neutral-100">Career Readiness</h2>
                </div>

                <div className="grid items-center gap-4 lg:grid-cols-[1fr_148px] lg:gap-5">
                  <div className="flex justify-center">
                  <div className="h-[130px] w-[130px] shrink-0 sm:h-[155px] sm:w-[155px] lg:h-[190px] lg:w-[190px]">
                    <div className="relative h-full w-full">
                      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
                        <circle cx="64" cy="64" r="49" strokeWidth="12" className="fill-none stroke-slate-100 dark:stroke-neutral-800" />
                        <circle
                          cx="64"
                          cy="64"
                          r="49"
                          strokeWidth="12"
                          strokeLinecap="round"
                          className="fill-none stroke-blue-600 transition-[stroke-dashoffset] duration-1000 ease-out dark:stroke-blue-400"
                          strokeDasharray={`${2 * Math.PI * 49}`}
                          strokeDashoffset={`${2 * Math.PI * 49 * (1 - careerReadinessScore / 100)}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black leading-none text-slate-900 dark:text-neutral-100">{careerReadinessScore}%</span>
                        <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Ready Score</span>
                      </div>
                    </div>
                  </div>
                  </div>

                  <div className="grid w-full gap-1.5 justify-self-center lg:w-[148px] lg:justify-self-end">
                  {[
                    { label: 'Interviews', value: `${Math.round(interviewProgress)}%`, icon: Mic },
                    { label: 'Aptitude', value: `${Math.round(aptitudeProgress)}%`, icon: Brain },
                    { label: 'Resume', value: `${Math.round(resumeProgress)}%`, icon: FileCheck },
                    { label: 'Streak', value: `${currentStreak}`, icon: Flame },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-950">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-xs font-bold leading-none text-slate-500 dark:text-neutral-400">{item.label}</p>
                          <p className="mt-1.5 text-lg font-black leading-none text-slate-900 dark:text-neutral-100">{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>

              <div ref={badgeCardRef} tabIndex={-1} className="flex h-full rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm outline-none dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
                <div className="flex min-h-full w-full flex-col justify-between gap-4">
                <div className="flex min-h-[50px] items-start justify-between gap-4">
                  <div>
                    <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Badges</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-black leading-none text-slate-900 dark:text-neutral-100">{badgeEarnedCount} / {totalBadgeCount || badgeShowcase.length || 9}</span>
                      <span className="mb-0.5 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">Earned</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => moveBadges(-1)} disabled={badgeIndex <= 0} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/30" aria-label="Previous badge"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveBadges(1)} disabled={badgeIndex >= Math.max(0, badgeShowcase.length - visibleBadgeCount)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/30" aria-label="Next badge"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>

                {badgeShowcase.length > 0 ? (
                  <div className="grid min-h-[94px] items-center gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleBadges.length)}, minmax(0, 1fr))` }}>
                    {visibleBadges.map((badge) => {
                      const isNewBadge = newBadgeCodes.has(badge.code);
                      return (
                      <button
                        key={`${badge.code}-${badge.earned ? 'earned' : 'locked'}`}
                        type="button"
                        onClick={() => setSelectedBadgeCode(badge.code)}
                        className={`relative rounded-2xl p-1 text-center transition duration-200 hover:scale-[1.04] ${selectedBadge?.code === badge.code ? 'scale-[1.04]' : 'scale-100'} ${isNewBadge ? 'motion-safe:animate-pulse' : ''} ${badge.earned ? '' : 'opacity-75'}`}
                      >
                        {isNewBadge && (
                          <span className="absolute right-0 top-0 z-10 rounded-full bg-blue-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
                            New
                          </span>
                        )}
                        <div className={`mx-auto mb-2 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full border p-1 transition ${selectedBadge?.code === badge.code ? 'border-blue-500 ring-2 ring-blue-500/20' : badge.earned ? 'border-amber-300/80' : 'border-slate-200 dark:border-neutral-700'} ${badge.earned ? 'bg-gradient-to-br from-blue-50 via-white to-amber-50 dark:from-blue-950/40 dark:via-neutral-900 dark:to-amber-950/20' : 'bg-slate-50 dark:bg-neutral-900'}`}>
                          <BadgeIcon icon={badge.earned ? badgeIconFor(badge) : badge.icon || defaultBadgeIconByCode[badge.code] || 'target'} earned={badge.earned} size="lg" />
                        </div>
                        <span className={`block text-[10px] font-black uppercase tracking-widest ${badge.earned ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400 dark:text-neutral-500'}`}>
                          {badge.earned ? 'Earned' : 'Locked'}
                        </span>
                      </button>
                    )})}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
                    <p className="text-base font-black text-slate-900 dark:text-neutral-100">No badges yet</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-neutral-400">Complete your first mock interview to unlock your first badge.</p>
                  </div>
                )}

                {selectedBadge && (
                  <div className="min-h-[78px] max-h-[90px] rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-slate-900 dark:text-neutral-100">{selectedBadge.name}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${selectedBadge.earned ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{selectedBadge.earned ? 'Earned' : 'Locked'}</span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-neutral-400">{selectedBadge.description}</p>
                        {!selectedBadge.earned && <p className="mt-1 truncate text-[11px] font-bold text-blue-600 dark:text-blue-300">Unlock by reaching this badge requirement.</p>}
                        {selectedBadge.earned && selectedBadge.earned_at && <p className="mt-1 truncate text-[11px] font-bold text-slate-400 dark:text-neutral-500">Earned {formatDate(String(selectedBadge.earned_at).slice(0, 10))}</p>}
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-7">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Activity Calendar</p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-neutral-100">365-day preparation heatmap</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500 dark:text-neutral-400">{activityCalendar?.totalActiveDays ?? 0} active days in the past year</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div><p className="text-xl font-black text-slate-900 dark:text-neutral-100">{currentStreak}</p><p className="text-[11px] font-black uppercase text-slate-400 dark:text-neutral-500">Current streak</p></div>
                  <div><p className="text-xl font-black text-slate-900 dark:text-neutral-100">{activityCalendar?.maxStreak ?? 0}</p><p className="text-[11px] font-black uppercase text-slate-400 dark:text-neutral-500">Max streak</p></div>
                </div>
              </div>
              <div className="overflow-hidden pb-0">
                <div className="inline-block min-w-max">
                  <div className="flex flex-nowrap items-end gap-4">
                    {heatmapMonths.map((month) => (
                      <div key={month.key} className="flex flex-col items-center gap-2">
                        <div className="flex gap-1">
                          {month.weeks.map((week, weekIndex) => (
                            <div key={`${month.key}-${weekIndex}`} className="grid grid-rows-7 gap-1">
                              {week.map((day, dayIndex) => (
                                day.isPlaceholder ? (
                                  <div key={`empty-${month.key}-${weekIndex}-${dayIndex}`} className="invisible h-3 w-3 rounded-[3px] border-0 bg-transparent" />
                                ) : (
                                  <div
                                    key={day.date}
                                    title={day.totalActivityCount > 0 ? `${day.totalActivityCount} activities on ${formatDate(day.date)}` : `No activity on ${formatDate(day.date)}`}
                                    className={`h-3 w-3 rounded-[3px] border ${heatColor(day.totalActivityCount)}`}
                                  />
                                )
                              ))}
                            </div>
                          ))}
                        </div>
                        <div className="h-4 whitespace-nowrap text-xs font-medium leading-4 text-slate-400 dark:text-neutral-500">
                          {month.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 dark:border-neutral-800">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-h-11 rounded-2xl px-4 text-xs font-black uppercase tracking-widest transition ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-neutral-400 dark:hover:bg-blue-950/30 dark:hover:text-blue-300'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 sm:p-7">
                {activeTab === 'recent' && (
                  <div>
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-neutral-100">Recent Activity</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-neutral-400">Latest practice rounds across your career prep.</p>
                      </div>
                      <button type="button" onClick={() => setActiveTab('interviews')} className="min-h-11 rounded-2xl border border-slate-200 px-5 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/30">View all</button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-neutral-800">
                      {safeRecentItems.length === 0 ? (
                        <div className="p-8 text-center text-sm font-bold text-slate-500 dark:text-neutral-400">No recent activity yet.</div>
                      ) : (
                        safeRecentItems.slice(0, 5).map((item: any) => {
                          const completed = item?.status === 'COMPLETED';
                          return (
                            <div key={String(item?.id)} className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 last:border-b-0 dark:border-neutral-800 md:grid-cols-[1.4fr_0.8fr_150px_144px] md:items-center">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"><MonitorCheck className="h-5 w-5" /></div>
                                <div className="min-w-0">
                                  <p className="font-black text-slate-900 dark:text-neutral-100">{item?.role || 'Interview'}</p>
                                  <p className="text-xs font-bold text-slate-400 dark:text-neutral-500">{item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}</p>
                                </div>
                              </div>
                              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{getInterviewSourceLabel(item)}</span>
                              <div className="whitespace-nowrap text-sm font-black text-slate-700 dark:text-neutral-300">{item?.result?.overallScore ?? 0}% · {completed ? 'Completed' : 'In Progress'}</div>
                              {completed ? (
                                <Link to={`/result/${item.id}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-600 dark:bg-neutral-800 dark:hover:bg-blue-500">View Analysis</Link>
                              ) : (
                                <Link to={`/interview-session/${item.id}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700">Resume</Link>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'interviews' && (
                  <div>
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-neutral-100">Interviews</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-neutral-400">Showing {pageStart}-{pageEnd} of {safeHistoryTotal} sessions</p>
                      </div>
                      <PaginationControls />
                    </div>
                    <div className="mb-5 flex flex-wrap gap-2">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'mock', label: 'Mock Interviews' },
                        { id: 'resume', label: 'Resume Interviews' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setInterviewFilter(item.id as InterviewFilter)}
                          className={`min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-widest transition ${interviewFilter === item.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-blue-950/30 dark:hover:text-blue-300'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    {renderInterviewCards(filteredSessions)}
                  </div>
                )}

                {activeTab === 'aptitude' && renderAptitudeRows(completedAptitudeItems, 'No aptitude tests completed yet.', 'Start Aptitude Practice', '/aptitude')}
                {activeTab === 'technical' && renderAptitudeRows(completedTechnicalItems, 'No technical MCQ practice completed yet.', 'Start MCQ Practice', '/aptitude/technical')}
                {activeTab === 'resume' && <EmptyState title="No resume scans yet." button="Check ATS Score" to="/resume-analyzer" />}
              </div>
            </section>
          </main>
        </div>
      </div>
      {toastBadge && (
        <div className="fixed inset-x-4 bottom-4 z-[110] sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-24">
          <div className="mx-auto flex max-w-sm items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/30">
            <div className="flex min-w-0 items-center gap-3">
              <BadgeIcon icon={badgeIconFor(toastBadge)} earned size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Badge Unlocked</p>
                <p className="truncate text-sm font-black text-slate-900 dark:text-neutral-100">{toastBadge.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveAchievement(toastBadge);
                setToastBadge(null);
              }}
              className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-700"
            >
              View
            </button>
          </div>
        </div>
      )}
      <AchievementUnlockedModal
        open={Boolean(activeAchievement)}
        badge={activeAchievement}
        onClose={() => setActiveAchievement(null)}
        onViewBadges={handleViewAchievementBadges}
      />
    </Layout>
  );
};

export default Dashboard;
