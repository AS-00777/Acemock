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

export type NewlyAwardedBadge = UserBadgeRow;

export type BadgeAwardResult = {
  newlyAwardedBadges: NewlyAwardedBadge[];
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

type CompletedAptitudeActivityRow = RowDataPacket & {
  id: number;
  title: string | null;
  section: string | null;
  activity_date: Date | string;
};

type InterviewActivityAggregateRow = RowDataPacket & {
  activity_date: Date | string;
  interview_count: number | string;
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
  totalActivityCount: number;
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
const technicalAptitudeSections = new Set(["React Engineer", "DevOps Engineer", "AI & ML", "SAP Engineer"]);
const activeBackfillsByUserId = new Set<string>();

function isMissingTableError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
}

function isDeadlockError(error: unknown) {
  const err = error as { code?: string; errno?: number };
  return err?.code === "ER_LOCK_DEADLOCK" || err?.errno === 1213;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithDeadlockRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [100, 250, 500];
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isDeadlockError(error) || attempt === delays.length) break;
      console.warn(`[badge] ${label} deadlocked; retrying`, { attempt: attempt + 1, nextDelayMs: delays[attempt] });
      await delay(delays[attempt]);
    }
  }
  throw lastError;
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return formatLocalDateKey(value);
  return String(value).slice(0, 10);
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDaysToDateKey(value: string, amount: number) {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + amount);
  return formatLocalDateKey(date);
}

async function getDatabaseDateKey() {
  const rows = await query<(RowDataPacket & { value: string })[]>(
    "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS value"
  );
  return rows[0]?.value ?? formatLocalDateKey(new Date());
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
  return `DATE_FORMAT(DATE(COALESCE(${existing.length ? existing.join(", ") : "NOW()"})), '%Y-%m-%d')`;
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

function isTechnicalAptitudeActivity(row: Pick<CompletedAptitudeActivityRow, "title" | "section">) {
  return technicalAptitudeSections.has(row.section || "") || /technical|mcq/i.test(row.title || "");
}

async function syncInterviewDailyActivityFromEvents(userId: string | number) {
  const userKey = String(userId);

  await runWithDeadlockRetry(async () => {
    const aggregates = await query<InterviewActivityAggregateRow[]>(
      `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date,
              COUNT(*) AS interview_count
       FROM user_activity_events
       WHERE user_id = ? AND activity_type = 'interview'
       GROUP BY activity_date
       ORDER BY activity_date ASC`,
      [userKey]
    );

    const activeDates = aggregates.map((row) => toDateOnly(row.activity_date));
    const existingDates = await query<(RowDataPacket & { activity_date: Date | string })[]>(
      `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date
       FROM user_daily_activity
       WHERE user_id = ? AND interview_count > 0
       ORDER BY activity_date ASC`,
      [userKey]
    );

    const activeDateSet = new Set(activeDates);
    for (const row of existingDates) {
      const activityDate = toDateOnly(row.activity_date);
      if (activeDateSet.has(activityDate)) continue;
      await exec(
        `UPDATE user_daily_activity
         SET interview_count = 0,
             total_activity_count =
               aptitude_count + technical_mcq_count + resume_scan_count + spoken_practice_count
         WHERE user_id = ? AND activity_date = ?`,
        [userKey, activityDate]
      );
    }

    for (const row of aggregates) {
      const activityDate = toDateOnly(row.activity_date);
      const interviewCount = Number(row.interview_count ?? 0);
      await exec(
        `INSERT INTO user_daily_activity (user_id, activity_date, interview_count, total_activity_count)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           interview_count = VALUES(interview_count),
           total_activity_count =
             VALUES(interview_count) + aptitude_count + technical_mcq_count + resume_scan_count + spoken_practice_count`,
        [userKey, activityDate, interviewCount, interviewCount]
      );
    }
  }, `syncInterviewDailyActivityFromEvents:${userKey}`);
}

export async function recordDailyActivity(
  userId: string | number,
  activityType: ActivityType,
  options: RecordDailyActivityOptions = {}
) {
  const column = activityColumns[activityType];
  const activityDate = options.activityDate ? toDateOnly(options.activityDate) : await getDatabaseDateKey();
  const hasSource = Boolean(options.sourceType && options.sourceId !== undefined && options.sourceId !== null);

  if (hasSource) {
    try {
      return await runWithDeadlockRetry(async () => {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const sourceType = String(options.sourceType);
          const sourceId = String(options.sourceId);
          const [existingEvents] = await connection.execute<(RowDataPacket & { activity_date: string })[]>(
            `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date
             FROM user_activity_events
             WHERE user_id = ? AND activity_type = ? AND source_type = ? AND source_id = ?
             LIMIT 1
             FOR UPDATE`,
            [
              String(userId),
              activityType,
              sourceType,
              sourceId,
            ]
          );

          const previousDate = existingEvents[0]?.activity_date ?? null;

          if (!previousDate) {
            await connection.execute(
              `INSERT INTO user_activity_events
                 (user_id, activity_type, source_type, source_id, activity_date)
               VALUES (?, ?, ?, ?, ?)`,
              [String(userId), activityType, sourceType, sourceId, activityDate]
            );

            await connection.execute(
              `INSERT INTO user_daily_activity (user_id, activity_date, ${column}, total_activity_count)
               VALUES (?, ?, 1, 1)
               ON DUPLICATE KEY UPDATE
                 ${column} = ${column} + 1,
                 total_activity_count = total_activity_count + 1`,
              [String(userId), activityDate]
            );

            await connection.commit();
            return true;
          }

          if (previousDate !== activityDate) {
            await connection.execute(
              `UPDATE user_activity_events
               SET activity_date = ?
               WHERE user_id = ? AND activity_type = ? AND source_type = ? AND source_id = ?`,
              [activityDate, String(userId), activityType, sourceType, sourceId]
            );

            const orderedDates = [previousDate, activityDate].sort();
            for (const orderedDate of orderedDates) {
              if (orderedDate === previousDate) {
                await connection.execute(
                  `UPDATE user_daily_activity
                   SET ${column} = GREATEST(${column} - 1, 0),
                       total_activity_count = GREATEST(total_activity_count - 1, 0)
                   WHERE user_id = ? AND activity_date = ?`,
                  [String(userId), previousDate]
                );
              } else {
                await connection.execute(
                  `INSERT INTO user_daily_activity (user_id, activity_date, ${column}, total_activity_count)
                   VALUES (?, ?, 1, 1)
                   ON DUPLICATE KEY UPDATE
                     ${column} = ${column} + 1,
                     total_activity_count = total_activity_count + 1`,
                  [String(userId), activityDate]
                );
              }
            }

            await connection.commit();
            return true;
          }

          await connection.commit();
          return false;
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }, `recordDailyActivity:${String(userId)}:${activityType}`);
    } catch (error) {
      if (isMissingTableError(error)) return false;
      throw error;
    }
  }

  await runWithDeadlockRetry(
    () => exec(
      `INSERT INTO user_daily_activity (user_id, activity_date, ${column}, total_activity_count)
       VALUES (?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE
         ${column} = ${column} + 1,
         total_activity_count = total_activity_count + 1`,
      [String(userId), activityDate]
    ),
    `recordDailyActivity:${String(userId)}:${activityType}`
  );
  return true;
}

export async function backfillUserActivitiesFromCompletedData(userId: string | number) {
  const userKey = String(userId);
  if (activeBackfillsByUserId.has(userKey)) return;
  activeBackfillsByUserId.add(userKey);
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
         AND r.overall_score IS NOT NULL
       ORDER BY activity_date ASC, i.id ASC`,
      [internalUserId]
    );

    for (const row of rows) {
      await runWithDeadlockRetry(
        () => recordDailyActivity(userId, "interview", {
          sourceType: "interview",
          sourceId: row.id,
          activityDate: row.activity_date,
        }),
        `backfillInterviewActivity:${userKey}:${row.id}`
      );
    }

    await syncInterviewDailyActivityFromEvents(userId);

    const aptitudeRows = await query<CompletedAptitudeActivityRow[]>(
      `SELECT at.id,
              at.title,
              at.section,
              DATE_FORMAT(DATE(COALESCE(at.completed_at, at.updated_at, at.created_at)), '%Y-%m-%d') AS activity_date
       FROM aptitude_tests at
       WHERE at.user_id = ?
         AND LOWER(COALESCE(at.status, '')) IN ('completed', 'submitted', 'finished')
         AND at.completed_at IS NOT NULL
         AND at.score IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM aptitude_attempts aa
           WHERE aa.test_id = at.id
           LIMIT 1
         )
       ORDER BY activity_date ASC, at.id ASC`,
      [internalUserId]
    );

    for (const row of aptitudeRows) {
      const activityType: ActivityType = isTechnicalAptitudeActivity(row) ? "technical_mcq" : "aptitude";
      await runWithDeadlockRetry(
        () => recordDailyActivity(userId, activityType, {
          sourceType: activityType === "technical_mcq" ? "technical_mcq_test" : "aptitude_test",
          sourceId: row.id,
          activityDate: row.activity_date,
        }),
        `backfillAptitudeActivity:${userKey}:${row.id}`
      );
    }
  } catch (error) {
    if (isMissingTableError(error)) return;
    if (isDeadlockError(error)) {
      console.warn("[badge] activity backfill skipped after deadlock retries", {
        userId: userKey,
        message: String((error as Error)?.message ?? error),
      });
      return;
    }
    throw error;
  } finally {
    activeBackfillsByUserId.delete(userKey);
  }
}

export async function getCurrentStreak(userId: string | number) {
  try {
    const rows = await query<(RowDataPacket & { activity_date: Date | string })[]>(
      `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date
       FROM user_daily_activity
       WHERE user_id = ? AND total_activity_count > 0
       ORDER BY activity_date DESC`,
      [String(userId)]
    );

    let streak = 0;
    let expected: string | null = null;
    for (const row of rows) {
      const yyyyMmDd = String(row.activity_date);
      if (expected === null) {
        expected = yyyyMmDd;
      }
      if (yyyyMmDd !== expected) break;
      streak += 1;
      expected = addDaysToDateKey(yyyyMmDd, -1);
    }
    return streak;
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

export async function getActivityCalendar(userId: string | number): Promise<ActivityCalendar> {
  try {
    const today = await getDatabaseDateKey();
    const startDate = addDaysToDateKey(today, -364);

    const rows = await query<(RowDataPacket & {
      activity_date: Date | string;
      interview_count: number | string | null;
      aptitude_count: number | string | null;
      technical_mcq_count: number | string | null;
      resume_scan_count: number | string | null;
      spoken_practice_count: number | string | null;
      total_activity_count: number | string | null;
    })[]>(
      `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date,
              interview_count, aptitude_count, technical_mcq_count,
              resume_scan_count, spoken_practice_count, total_activity_count
       FROM user_daily_activity
       WHERE user_id = ? AND activity_date >= ?
       ORDER BY activity_date ASC`,
      [String(userId), startDate]
    );

    const byDate = new Map<string, ActivityCalendarDay>();
    for (const row of rows) {
      const date = toDateOnly(row.activity_date);
      const totalActivityCount = Number(row.total_activity_count ?? 0);
      byDate.set(date, {
        date,
        count: totalActivityCount,
        totalActivityCount,
        interviewCount: Number(row.interview_count ?? 0),
        aptitudeCount: Number(row.aptitude_count ?? 0),
        technicalMcqCount: Number(row.technical_mcq_count ?? 0),
        resumeScanCount: Number(row.resume_scan_count ?? 0),
        spokenPracticeCount: Number(row.spoken_practice_count ?? 0),
      });
    }

    const days: ActivityCalendarDay[] = [];
    for (let offset = 0; offset < 365; offset += 1) {
      const date = addDaysToDateKey(startDate, offset);
      days.push(byDate.get(date) ?? {
        date,
        count: 0,
        totalActivityCount: 0,
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
      const today = formatLocalDateKey(new Date());
      const startDate = addDaysToDateKey(today, -364);
      const days = Array.from({ length: 365 }, (_, index) => ({
        date: addDaysToDateKey(startDate, index),
        count: 0,
        totalActivityCount: 0,
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
    const result = await exec(
      "INSERT IGNORE INTO user_badges (user_id, badge_code) VALUES (?, ?)",
      [String(userId), badgeCode]
    );
    return result.affectedRows > 0;
  } catch (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
}

async function getAwardedBadgeDetails(userId: string | number, badgeCodes: string[]) {
  if (badgeCodes.length === 0) return [];

  try {
    const placeholders = badgeCodes.map(() => "?").join(", ");
    return query<UserBadgeRow[]>(
      `SELECT b.code, b.name, b.description, b.icon, b.category, b.target_value, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON b.code = ub.badge_code
       WHERE ub.user_id = ? AND b.code IN (${placeholders})
       ORDER BY ub.earned_at DESC`,
      [String(userId), ...badgeCodes]
    );
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export async function checkAndAwardBadges(userId: string | number): Promise<BadgeAwardResult> {
  const stats = await getUserBadgeStats(userId);
  const newlyAwardedCodes: string[] = [];

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
    const wasAwarded = await awardBadgeIfNotExists(userId, code);
    if (wasAwarded) newlyAwardedCodes.push(code);
  }

  return {
    newlyAwardedBadges: await getAwardedBadgeDetails(userId, newlyAwardedCodes),
  };
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
