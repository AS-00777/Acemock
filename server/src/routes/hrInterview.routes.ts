import { Router } from "express";
import type { NextFunction, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import type { AuthRequest } from "../types/request";
import {
  assertHrInterviewOwnership,
  abandonHrInterview,
  generateRuleBasedFollowUp,
  getHrFollowUpCount,
  getHrResult,
  saveHrAnswer,
  startHrInterview,
} from "../services/hrInterview.service";

const router = Router();

router.use(requireAuth);

function parseInterviewId(value: unknown) {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) throw new ApiError(400, "Invalid interview id");
  return id;
}

router.post("/start", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const role = String(req.body?.role ?? "General").trim();
    const experience = String(req.body?.experience ?? "Fresher").trim();
    const rawDifficulty = String(req.body?.difficulty ?? "Medium").trim();
    const difficulty = rawDifficulty === "Easy" || rawDifficulty === "Hard" ? rawDifficulty : "Medium";
    if (!role) throw new ApiError(400, "role is required");
    if (!experience) throw new ApiError(400, "experience is required");
    const data = await startHrInterview({ userId: req.user.id, role, experience, difficulty });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/answer", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const interviewId = parseInterviewId(req.body?.interviewId);
    const questionId = String(req.body?.questionId ?? "").trim();
    const answerText = String(req.body?.answerText ?? "").trim();
    const followUpQuestion = String(req.body?.followUpQuestion ?? "").trim();
    const followUpAnswer = String(req.body?.followUpAnswer ?? "").trim();
    const timeTakenSeconds = Number.isFinite(Number(req.body?.timeTakenSeconds))
      ? Math.max(0, Math.floor(Number(req.body.timeTakenSeconds)))
      : 0;
    if (!questionId) throw new ApiError(400, "questionId is required");
    const data = await saveHrAnswer({
      userId: req.user.id,
      interviewId,
      questionId,
      answerText,
      followUpQuestion,
      followUpAnswer,
      timeTakenSeconds,
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/follow-up", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const interviewId = parseInterviewId(req.body?.interviewId);
    const question = String(req.body?.question ?? "").trim();
    const answerText = String(req.body?.answerText ?? "").trim();
    const category = String(req.body?.category ?? "").trim();
    if (!question) throw new ApiError(400, "question is required");
    await assertHrInterviewOwnership({ userId: req.user.id, interviewId });
    const previousFollowUpCount = await getHrFollowUpCount({ userId: req.user.id, interviewId });
    res.json(generateRuleBasedFollowUp({ question, answerText, category, previousFollowUpCount }));
  } catch (err) {
    next(err);
  }
});

router.post("/abandon", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const interviewId = parseInterviewId(req.body?.interviewId);
    const data = await abandonHrInterview({ userId: req.user.id, interviewId });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/result/:interviewId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const interviewId = parseInterviewId(req.params.interviewId);
    const data = await getHrResult({ userId: req.user.id, interviewId });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
