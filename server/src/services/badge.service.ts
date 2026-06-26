import type { RowDataPacket } from "mysql2/promise";
import { exec, pool, query } from "../config/db";

export type ActivityType =
  | "interview"
  | "aptitude"
  | "technical_mcq"
  | "resume_scan"
  | "spoken_practice";

type BadgeRow = RowDataPacket & {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string | null;
  target_value: number | null;
};

type UserBadgeRow = BadgeRow & {
  earned_at: Date;
};

type BadgeStats = {
  totalInterviews: number;
  bestInterviewScore: number;
  totalAptitudeTests: number;
  bestAptitudeScore: number;
  totalResumeScans: number;
  bestAtsScore: number;
  currentStreak: number;
};

type RecordDailyActivityOptions = {
  sourceType?: string;
  sourceId?: string | number;
  activityDate?: Date | string;
};

type CompletedInterviewActivityRow = RowDataPacket & {
  id: number;
  activity_date: Date | string;
};

export type NextBadgeProgress = {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string | null;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
} | null;

export type ActivityCalendarDay = {
  date: string;
  count: number;
  interviewCount: number;
  aptitudeCount: number;
  technicalMcqCount: number;
  resumeScanCount: number;
  spokenPracticeCount: number;
};

export type ActivityCalendar = {
  totalActiveDays: number;
  currentStreak: number;
  maxStreak: number;
  totalActivities: number;
  interviewCount: number;
  aptitudeCount: number;
  technicalMcqCount: number;
  resumeScanCount: number;
  spokenPracticeCount: number;
  days: ActivityCalendarDay[];
};

export type CareerReadinessStats = {
  avgInterviewScore: number;
  completedInterviewCount: number;
  avgAptitudeScore: number;
  completedAptitudeCount: number;
  bestAtsScore: number;
  resumeScanCount: number;
  currentStreak: number;
};

const activityColumns: Record<ActivityType, string> = {
  interview: "interview_count",
  aptitude: "aptitude_count",
  technical_mcq: "technical_mcq_count",
  resume_scan: "resume_scan_count",
  spoken_practice: "spoken_practice_count",
};

const badgeProgress: Record<string, (stats: BadgeStats) => { current: number; target: number }> = {
  FIRST_INTERVIEW: (stats) => ({ current: stats.totalInterviews, target: 1 }),
  THREE_DAY_STREAK: (stats) => ({ current: stats.currentStreak, target: 3 }),
  SEVEN_DAY_STREAK: (stats) => ({ current: stats.currentStreak, target: 7 }),
  TEN_INTERVIEWS: (stats) => ({ current: stats.totalInterviews, target: 10 }),
  SCORE_80_INTERVIEW: (stats) => ({ current: stats.bestInterviewScore, target: 80 }),
  FIRST_APTITUDE: (stats) => ({ current: stats.totalAptitudeTests, target: 1 }),
  SCORE_90_APTITUDE: (stats) => ({ current: stats.bestAptitudeScore, target: 90 }),
  ATS_80: (stats) => ({ current: stats.bestAtsScore, target: 80 }),
  ALL_ROUNDER: (stats) => ({
    current:
      (stats.totalInterviews >= 1 ? 1 : 0) +
      (stats.totalAptitudeTests >= 1 ? 1 : 0) +
      (stats.totalResumeScans >= 1 ? 1 : 0),
    target: 3,
  }),
};

const aptitudeBadgeCodes = ["FIRST_APTITUDE", "SCORE_90_APTITUDE"];

function isMissingTableError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
}

function toDateOnly(value: Date | string | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function safeNumber(sql: string, params: unknown[] = []) {
  try {
    const rows = await query<(RowDataPacket & { value: number | string | null })[]>(sql, params);
    return Number(rows[0]?.value ?? 0);
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function tableExists(tableName: string) {
  const rows = await query<(RowDataPacket & { value: number })[]>(
    `SELECT COUNT(*) AS value
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.value ?? 0) > 0;
}

async function columnExists(tableName: string, columnName: string) {
  const rows = await query<(RowDataPacket & { value: number })[]>(
    `SELECT COUNT(*) AS value
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.value ?? 0) > 0;
}

async function resolveInternalUserId(userId: string | number) {
  const numericUserId = Number(userId);
  if (Number.isInteger(numericUserId) && numericUserId > 0) return numericUserId;

  const rows = await query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM users WHERE clerk_id = ? AND deleted_at IS NULL LIMIT 1",
    [String(userId)]
  );
  return rows[0]?.id ?? null;
}

async function getCompletedInterviewDateExpression() {
  const dateColumns = ["completed_at", "ended_at", "updated_at", "created_at"];
  const existing: string[] = [];
  for (const column of dateColumns) {
    if (await columnExists("interviews", column)) existing.push(`i.${column}`);
  }
  if (await columnExists("results", "created_at")) existing.push("r.created_at");
  return `DATE(COALESCE(${existing.length ? existing.join(", ") : "NOW()"}))`;
}

function completedInterviewWhere(alias = "i") {
  return `LOWER(COALESCE(${alias}.status, '')) IN ('completed', 'finished')`;
}

function completedAptitudeWhere(alias = "at") {
  return `LOWER(COALESCE(${alias}.status, '')) IN ('completed', 'submitted', 'finished')
    AND ${alias}.completed_at IS NOT NULL
    AND ${alias}.score IS NOT NULL
    AND COALESCE(${alias}.section, '') NOT IN ('React Engineer', 'DevOps Engineer', 'AI & ML', 'SAP Engineer')
    AND LOWER(COALESCE(${alias}.title, '')) NOT LIKE '%technical%'
    AND LOWER(COALESCE(${alias}.title, '')) NOT LIKE '%mcq%'
    AND EXISTS (
      SELECT 1
      FROM aptitude_attempts aa
      WHERE aa.test_id = ${alias}.id
      LIMIT 1
    )`;
}

async function syncInterviewDailyActivityFromEvents(userId: string | number) {
  const userKey = String(userId);

  await exec(
    `UPDATE user_daily_activity
     SET interview_count = 0,
         total_activity_count =
           aptitude_count + technical_mcq_count + resume_scan_count + spoken_practice_count
     WHERE user_id = ?`,
    [userKey]
  );

  await exec(
    `INSERT INTO user_daily_activity (user_id, activity_date, interview_count, total_activity_count)
     SELECT user_id, activity_date, COUNT(*) AS interview_count, COUNT(*) AS total_activity_count
     FROM user_activity_events
     WHERE user_id = ? AND activity_type = 'interview'
     GROUP BY user_id, activity_date
     ON DUPLICATE KEY UPDATE
       interview_count = VALUES(interview_count),
       total_activity_count =
         VALUES(interview_count) + aptitude_count + technical_mcq_count + resume_scan_count + spoken_practice_count`,
    [userKey]
  );
}

export async function recordDailyActivity(
  userId: string | number,
  activityType: ActivityType,
  options: RecordDailyActivityOptions = {}
) {
  const column = activityColumns[activityType];
  const activityDate = toDateOnly(options.activityDate);
  const hasSource = Boolean(options.sourceType && options.sourceId !== undefined && options.sourceId !== null);

  if (hasSource) {
    try {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [eventResult] = await connection.execute<any>(
          `INSERT IGNORE INTO user_activity_events
             (user_id, activity_type, source_type, source_id, activity_date)
           VALUES (?, ?, ?, ?, ?)`,
          [
            String(userId),
            activityType,
            String(options.sourceType),
            String(options.sourceId),
            activityDate,
          ]
        );

        if (Number(eventResult.affectedRows ?? 0) > 0) {
          await connection.execute(
            `INSERT INTO user_daily_activity (user_id, activity_date, ${column}, total_activity_count)
             VALUES (?, ?, 1, 1)
             ON DUPLICATE KEY UPDATE
               ${column} = ${column} + 1,
               total_activity_count = total_activity_count + 1`,
            [String(userId), activityDate]
          );
        }

        await connection.commit();
        return Number(eventResult.affectedRows ?? 0) > 0;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (isMissingTableError(error)) return false;
      throw error;
    }
  }

  await exec(
    `INSERT INTO user_daily_activity (user_id, activity_date, ${column}, total_activity_count)
     VALUES (?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE
       ${column} = ${column} + 1,
       total_activity_count = total_activity_count + 1`,
    [String(userId), activityDate]
  );
  return true;
}

export async function backfillUserActivitiesFromCompletedData(userId: string | number) {
  try {
    const internalUserId = await resolveInternalUserId(userId);
    if (!internalUserId) return;

    const activityDateExpression = await getCompletedInterviewDateExpression();
    const rows = await query<CompletedInterviewActivityRow[]>(
      `SELECT i.id, ${activityDateExpression} AS activity_date
       FROM interviews i
       JOIN results r ON r.interview_id = i.id
       WHERE i.user_id = ?
         AND ${completedInterviewWhere("i")}
         AND r.overall_score IS NOT NULL`,
      [internalUserId]
    );

    for (const row of rows) {
      await recordDailyActivity(userId, "interview", {
        sourceType: "interview",
        sourceId: row.id,
        activityDate: row.activity_date,
      });
    }

    await syncInterviewDailyActivityFromEvents(userId);
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

export async function getCurrentStreak(userId: string | number) {
  try {
    const rows = await query<(RowDataPacket & { activity_date: Date | string })[]>(
      `SELECT activity_date
       FROM user_daily_activity
       WHERE user_id = ? AND total_activity_count > 0
       ORDER BY activity_date DESC`,
      [String(userId)]
    );

    let streak = 0;
    let expected: string | null = null;
    for (const row of rows) {
      const date = new Date(row.activity_date);
      const yyyyMmDd = date.toISOString().slice(0, 10);
      if (expected === null) {
        expected = yyyyMmDd;
      }
      if (yyyyMmDd !== expected) break;
      streak += 1;
      date.setUTCDate(date.getUTCDate() - 1);
      expected = date.toISOString().slice(0, 10);
    }
    return streak;
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getActivityCalendar(userId: string | number): Promise<ActivityCalendar> {
  try {
    const today = startOfUtcDay(new Date());
    const start = addDays(today, -364);
    const startDate = toDateOnly(start);

    const rows = await query<(RowDataPacket & {
      activity_date: Date | string;
      interview_count: number | string | null;
      aptitude_count: number | string | null;
      technical_mcq_count: number | string | null;
      resume_scan_count: number | string | null;
      spoken_practice_count: number | string | null;
      total_activity_count: number | string | null;
    })[]>(
      `SELECT activity_date, interview_count, aptitude_count, technical_mcq_count,
              resume_scan_count, spoken_practice_count, total_activity_count
       FROM user_daily_activity
       WHERE user_id = ? AND activity_date >= ?
       ORDER BY activity_date ASC`,
      [String(userId), startDate]
    );

    const byDate = new Map<string, ActivityCalendarDay>();
    for (const row of rows) {
      const date = toDateOnly(row.activity_date);
      byDate.set(date, {
        date,
        count: Number(row.total_activity_count ?? 0),
        interviewCount: Number(row.interview_count ?? 0),
        aptitudeCount: Number(row.aptitude_count ?? 0),
        technicalMcqCount: Number(row.technical_mcq_count ?? 0),
        resumeScanCount: Number(row.resume_scan_count ?? 0),
        spokenPracticeCount: Number(row.spoken_practice_count ?? 0),
      });
    }

    const days: ActivityCalendarDay[] = [];
    for (let offset = 0; offset < 365; offset += 1) {
      const date = toDateOnly(addDays(start, offset));
      days.push(byDate.get(date) ?? {
        date,
        count: 0,
        interviewCount: 0,
        aptitudeCount: 0,
        technicalMcqCount: 0,
        resumeScanCount: 0,
        spokenPracticeCount: 0,
      });
    }

    let maxStreak = 0;
    let runningStreak = 0;
    for (const day of days) {
      if (day.count > 0) {
        runningStreak += 1;
        maxStreak = Math.max(maxStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }

    return {
      totalActiveDays: days.filter((day) => day.count > 0).length,
      currentStreak: await getCurrentStreak(userId),
      maxStreak,
      totalActivities: days.reduce((sum, day) => sum + day.count, 0),
      interviewCount: days.reduce((sum, day) => sum + day.interviewCount, 0),
      aptitudeCount: days.reduce((sum, day) => sum + day.aptitudeCount, 0),
      technicalMcqCount: days.reduce((sum, day) => sum + day.technicalMcqCount, 0),
      resumeScanCount: days.reduce((sum, day) => sum + day.resumeScanCount, 0),
      spokenPracticeCount: days.reduce((sum, day) => sum + day.spokenPracticeCount, 0),
      days,
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      const today = startOfUtcDay(new Date());
      const start = addDays(today, -364);
      const days = Array.from({ length: 365 }, (_, index) => ({
        date: toDateOnly(addDays(start, index)),
        count: 0,
        interviewCount: 0,
        aptitudeCount: 0,
        technicalMcqCount: 0,
        resumeScanCount: 0,
        spokenPracticeCount: 0,
      }));
      return {
        totalActiveDays: 0,
        currentStreak: 0,
        maxStreak: 0,
        totalActivities: 0,
        interviewCount: 0,
        aptitudeCount: 0,
        technicalMcqCount: 0,
        resumeScanCount: 0,
        spokenPracticeCount: 0,
        days,
      };
    }
    throw error;
  }
}

async function getBestAtsScore(userIds: Array<string | number>) {
  const candidates = [
    { table: "resume_scans", scoreColumn: "ats_score" },
    { table: "resume_analyses", scoreColumn: "ats_score" },
    { table: "ats_results", scoreColumn: "score" },
  ];

  let best = 0;
  for (const candidate of candidates) {
    if (!(await tableExists(candidate.table))) continue;
    const placeholders = userIds.map(() => "?").join(", ");
    best = Math.max(
      best,
      await safeNumber(
        `SELECT COALESCE(MAX(${candidate.scoreColumn}), 0) AS value
         FROM ${candidate.table}
         WHERE user_id IN (${placeholders})`,
        userIds
      )
    );
  }
  return best;
}

export async function getUserBadgeStats(userId: string | number): Promise<BadgeStats> {
  const internalUserId = await resolveInternalUserId(userId);
  const progressUserIds = internalUserId ? [String(userId), internalUserId] : [String(userId)];
  const interviewUserId = internalUserId ?? -1;
  const totalInterviews = await safeNumber(
    `SELECT COUNT(*) AS value
     FROM interviews i
     JOIN results r ON r.interview_id = i.id
     WHERE i.user_id = ?
       AND ${completedInterviewWhere("i")}
       AND r.overall_score IS NOT NULL`,
    [interviewUserId]
  );
  const bestInterviewScore = await safeNumber(
    `SELECT COALESCE(MAX(r.overall_score), 0) AS value
     FROM results r
     JOIN interviews i ON i.id = r.interview_id
     WHERE i.user_id = ?
       AND ${completedInterviewWhere("i")}
       AND r.overall_score IS NOT NULL`,
    [interviewUserId]
  );
  const totalAptitudeTests = await safeNumber(
    `SELECT COUNT(*) AS value
     FROM aptitude_tests at
     WHERE at.user_id = ?
       AND ${completedAptitudeWhere("at")}`,
    [interviewUserId]
  );
  const bestAptitudeScore = await safeNumber(
    `SELECT COALESCE(MAX(at.score), 0) AS value
     FROM aptitude_tests at
     WHERE at.user_id = ?
       AND ${completedAptitudeWhere("at")}`,
    [interviewUserId]
  );
  const totalResumeScans = await safeNumber(
    "SELECT COALESCE(SUM(resume_scan_count), 0) AS value FROM user_daily_activity WHERE user_id = ?",
    [String(userId)]
  );

  return {
    totalInterviews,
    bestInterviewScore,
    totalAptitudeTests,
    bestAptitudeScore,
    totalResumeScans,
    bestAtsScore: await getBestAtsScore(progressUserIds),
    currentStreak: await getCurrentStreak(userId),
  };
}

export async function getCareerReadinessStats(userId: string | number): Promise<CareerReadinessStats> {
  const internalUserId = await resolveInternalUserId(userId);
  const progressUserIds = internalUserId ? [String(userId), internalUserId] : [String(userId)];
  const interviewUserId = internalUserId ?? -1;

  const avgInterviewScore = await safeNumber(
    `SELECT COALESCE(AVG(r.overall_score), 0) AS value
     FROM results r
     JOIN interviews i ON i.id = r.interview_id
     WHERE i.user_id = ?
       AND ${completedInterviewWhere("i")}
       AND r.overall_score IS NOT NULL`,
    [interviewUserId]
  );
  const completedInterviewCount = await safeNumber(
    `SELECT COUNT(*) AS value
     FROM interviews i
     JOIN results r ON r.interview_id = i.id
     WHERE i.user_id = ?
       AND ${completedInterviewWhere("i")}
       AND r.overall_score IS NOT NULL`,
    [interviewUserId]
  );
  const avgAptitudeScore = await safeNumber(
    `SELECT COALESCE(AVG(at.score), 0) AS value
     FROM aptitude_tests at
     WHERE at.user_id = ?
       AND ${completedAptitudeWhere("at")}`,
    [interviewUserId]
  );
  const completedAptitudeCount = await safeNumber(
    `SELECT COUNT(*) AS value
     FROM aptitude_tests at
     WHERE at.user_id = ?
       AND ${completedAptitudeWhere("at")}`,
    [interviewUserId]
  );
  const resumeScanCount = await safeNumber(
    "SELECT COALESCE(SUM(resume_scan_count), 0) AS value FROM user_daily_activity WHERE user_id = ?",
    [String(userId)]
  );

  return {
    avgInterviewScore: Math.round(avgInterviewScore),
    completedInterviewCount,
    avgAptitudeScore: Math.round(avgAptitudeScore),
    completedAptitudeCount,
    bestAtsScore: Math.round(await getBestAtsScore(progressUserIds)),
    resumeScanCount,
    currentStreak: await getCurrentStreak(userId),
  };
}

async function removeInvalidAptitudeBadges(userId: string | number, stats: BadgeStats) {
  if (stats.totalAptitudeTests < 1) {
    await exec(
      `DELETE FROM user_badges
       WHERE user_id = ? AND badge_code IN (?, ?)`,
      [String(userId), "FIRST_APTITUDE", "SCORE_90_APTITUDE"]
    );
    return;
  }

  if (stats.bestAptitudeScore < 90) {
    await exec(
      "DELETE FROM user_badges WHERE user_id = ? AND badge_code = ?",
      [String(userId), "SCORE_90_APTITUDE"]
    );
  }
}

export async function awardBadgeIfNotExists(userId: string | number, badgeCode: string) {
  try {
    await exec(
      "INSERT IGNORE INTO user_badges (user_id, badge_code) VALUES (?, ?)",
      [String(userId), badgeCode]
    );
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

export async function checkAndAwardBadges(userId: string | number) {
  const stats = await getUserBadgeStats(userId);
  const earned: string[] = [];

  try {
    await removeInvalidAptitudeBadges(userId, stats);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  const checks: Array<[string, boolean]> = [
    ["FIRST_INTERVIEW", stats.totalInterviews >= 1],
    ["THREE_DAY_STREAK", stats.currentStreak >= 3],
    ["SEVEN_DAY_STREAK", stats.currentStreak >= 7],
    ["TEN_INTERVIEWS", stats.totalInterviews >= 10],
    ["SCORE_80_INTERVIEW", stats.bestInterviewScore >= 80],
    ["FIRST_APTITUDE", stats.totalAptitudeTests >= 1],
    ["SCORE_90_APTITUDE", stats.bestAptitudeScore >= 90],
    ["ATS_80", stats.bestAtsScore >= 80],
    [
      "ALL_ROUNDER",
      stats.totalInterviews >= 1 && stats.totalAptitudeTests >= 1 && stats.totalResumeScans >= 1,
    ],
  ];

  for (const [code, shouldAward] of checks) {
    if (!shouldAward) continue;
    await awardBadgeIfNotExists(userId, code);
    earned.push(code);
  }

  return earned;
}

function canShowNextBadge(code: string, stats: BadgeStats) {
  if (aptitudeBadgeCodes.includes(code)) return stats.totalAptitudeTests > 0;
  return true;
}

export async function getUserBadges(userId: string | number) {
  try {
    return query<UserBadgeRow[]>(
      `SELECT b.code, b.name, b.description, b.icon, b.category, b.target_value, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON b.code = ub.badge_code
       WHERE ub.user_id = ? AND b.is_active = TRUE
       ORDER BY ub.earned_at DESC`,
      [String(userId)]
    );
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export async function getAllActiveBadges() {
  try {
    return query<BadgeRow[]>(
      `SELECT code, name, description, icon, category, target_value
       FROM badges
       WHERE is_active = TRUE
       ORDER BY id`
    );
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export async function getLockedBadges(userId: string | number) {
  const [earnedBadges, allBadges, stats] = await Promise.all([
    getUserBadges(userId),
    getAllActiveBadges(),
    getUserBadgeStats(userId),
  ]);
  const earnedCodes = new Set(earnedBadges.map((badge) => badge.code));
  return allBadges.filter(
    (badge) => !earnedCodes.has(badge.code) && canShowNextBadge(badge.code, stats)
  );
}

export async function getNextBadgeProgress(userId: string | number): Promise<NextBadgeProgress> {
  try {
    const [stats, earnedBadges, badges] = await Promise.all([
      getUserBadgeStats(userId),
      getUserBadges(userId),
      getAllActiveBadges(),
    ]);
    const earnedCodes = new Set(earnedBadges.map((badge) => badge.code));

    const candidates = badges
      .filter((badge) => !earnedCodes.has(badge.code) && badgeProgress[badge.code] && canShowNextBadge(badge.code, stats))
      .map((badge) => {
        const progress = badgeProgress[badge.code](stats);
        const targetValue = Math.max(1, Number(badge.target_value ?? progress.target));
        const currentValue = Math.max(0, Math.min(progress.current, targetValue));
        return {
          code: badge.code,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          currentValue,
          targetValue,
          progressPercent: Math.min(100, Math.round((currentValue / targetValue) * 100)),
        };
      })
      .sort((a, b) => b.progressPercent - a.progressPercent || a.targetValue - b.targetValue);

    return candidates[0] ?? null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}
