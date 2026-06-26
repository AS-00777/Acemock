import type { NextFunction, Response } from "express";
import { ApiError } from "../middleware/error.middleware";
import type { AuthRequest } from "../types/request";
import { checkAndAwardBadges, recordDailyActivity } from "../services/badge.service";
import {
  getAptitudeHistory,
  getAptitudeMeta,
  getAptitudeResult,
  getRandomQuestions,
  startAptitudeTest,
  submitAptitudeTest,
  type SubmittedAnswer,
} from "../services/aptitude.service";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const technicalAptitudeSections = new Set(["React Engineer", "DevOps Engineer", "AI & ML", "SAP Engineer"]);

function isTechnicalAptitudeTest(test: { title?: string | null; section?: string | null }) {
  return technicalAptitudeSections.has(test.section || "") || /technical|mcq/i.test(test.title || "");
}

function positiveInteger(value: unknown, name: string, fallback?: number, max = 100) {
  const candidate = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(candidate) || Number(candidate) < 1 || Number(candidate) > max) {
    throw new ApiError(400, `${name} must be an integer between 1 and ${max}`);
  }
  return Number(candidate);
}

function testId(value: unknown) {
  return positiveInteger(value, "testId", undefined, Number.MAX_SAFE_INTEGER);
}

export async function meta(_req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await getAptitudeMeta()); } catch (error) { next(error); }
}

export async function questions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await getRandomQuestions({
      company: text(req.query.company) || "General",
      section: text(req.query.section) || undefined,
      topic: text(req.query.topic) || undefined,
      difficulty: text(req.query.difficulty) || undefined,
      limit: positiveInteger(req.query.limit, "limit", 10),
    });
    res.json({ questions: items });
  } catch (error) { next(error); }
}

export async function start(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const title = text(req.body?.title) || "Aptitude Practice Test";
    if (title.length > 255) throw new ApiError(400, "title must be at most 255 characters");
    const result = await startAptitudeTest({
      userId: req.user.id,
      title,
      company: text(req.body?.company) || "General",
      section: text(req.body?.section) || undefined,
      topic: text(req.body?.topic) || undefined,
      difficulty: text(req.body?.difficulty) || undefined,
      totalQuestions: positiveInteger(req.body?.totalQuestions, "totalQuestions", 10),
      durationMinutes: positiveInteger(req.body?.durationMinutes, "durationMinutes", 10, 240),
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
}

export async function submit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    if (!Array.isArray(req.body?.answers)) throw new ApiError(400, "answers must be an array");
    const seen = new Set<string>();
    const answers: SubmittedAnswer[] = req.body.answers.map((item: any, index: number) => {
      const questionId = text(item?.questionId);
      if (!questionId) throw new ApiError(400, `answers[${index}].questionId is required`);
      if (seen.has(questionId)) throw new ApiError(400, `Duplicate answer for question ${questionId}`);
      seen.add(questionId);
      const selected = item?.selectedAnswer === null || item?.selectedAnswer === undefined
        ? null : text(item.selectedAnswer).toUpperCase();
      if (selected !== null && !/^[A-D]$/.test(selected)) {
        throw new ApiError(400, `answers[${index}].selectedAnswer must be A, B, C, D, or null`);
      }
      const seconds = Number(item?.timeTakenSeconds ?? 0);
      if (!Number.isInteger(seconds) || seconds < 0 || seconds > 86400) {
        throw new ApiError(400, `answers[${index}].timeTakenSeconds is invalid`);
      }
      return { questionId, selectedAnswer: selected, timeTakenSeconds: seconds };
    });
    const id = testId(req.params.testId);
    const result = await submitAptitudeTest(id, req.user.id, answers);

    try {
      const badgeUserId = req.user.clerkId ?? String(req.user.id);
      const completed = await getAptitudeResult(id, req.user.id);
      const activityType = isTechnicalAptitudeTest(completed.test) ? "technical_mcq" : "aptitude";
      await recordDailyActivity(badgeUserId, activityType, {
        sourceType: activityType === "technical_mcq" ? "technical_mcq_test" : "aptitude_test",
        sourceId: String(id),
      });
      await checkAndAwardBadges(badgeUserId);
    } catch (badgeError: any) {
      console.warn("[badge] aptitude completion sync skipped", {
        userId: req.user.id,
        testId: req.params.testId,
        message: String(badgeError?.message ?? badgeError),
      });
    }

    res.json(result);
  } catch (error) { next(error); }
}

export async function history(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    res.json({ items: await getAptitudeHistory(req.user.id) });
  } catch (error) { next(error); }
}

export async function result(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    res.json(await getAptitudeResult(testId(req.params.testId), req.user.id));
  } catch (error) { next(error); }
}
