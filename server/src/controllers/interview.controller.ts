import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/request";
import { ApiError } from "../middleware/error.middleware";
import {
  addOrGenerateQuestion,
  completeInterview,
  deleteInterview,
  getInterviewDetails,
  getInterviewHistory,
  saveAnswerWithEvaluation,
  startInterview,
} from "../services/interview.service";

export const start = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const role = String(req.body?.role ?? "").trim();
    const experience = String(req.body?.experience ?? "").trim();
    const techStack = req.body?.techStack ?? [];
    const rawDifficulty =
      req.body?.difficulty ??
      (typeof techStack === "object" && techStack ? (techStack as any).difficulty : undefined);
    const difficulty =
      rawDifficulty === "easy" || rawDifficulty === "medium" || rawDifficulty === "hard"
        ? rawDifficulty
        : rawDifficulty === "Easy"
          ? "easy"
          : rawDifficulty === "Medium"
            ? "medium"
            : rawDifficulty === "Hard"
              ? "hard"
              : undefined;

    if (!role) throw new ApiError(400, "role is required");
    if (!experience) throw new ApiError(400, "experience is required");

    const interview = await startInterview({
      userId: req.user.id,
      role,
      experience,
      difficulty,
      techStack,
    });

    console.info("[interview] start", { userId: req.user.id, interviewId: interview.id, role });

    res.status(201).json({
      interview: {
        id: interview.id,
        userId: interview.user_id,
        role: interview.role,
        experience: interview.experience,
        difficulty: (interview as any).difficulty ?? difficulty ?? null,
        techStack: interview.tech_stack,
        status: interview.status,
        createdAt: interview.created_at,
        completedAt: interview.completed_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const question = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const interviewId = Number(req.params.id);
    if (!Number.isFinite(interviewId))
      throw new ApiError(400, "Invalid interview id");

    const questionText =
      typeof req.body?.questionText === "string"
        ? req.body.questionText
        : undefined;

    const q = await addOrGenerateQuestion({
      interviewId,
      userId: req.user.id,
      questionText,
    });

    console.info("[interview] question", { userId: req.user.id, interviewId, questionId: q.id });

    res.status(201).json({
      question: {
        id: q.id,
        interviewId: q.interview_id,
        questionText: q.question_text,
        expectedAnswer: (q as any).expected_answer ?? null,
        keyConcepts: Array.isArray((q as any).key_concepts)
          ? (q as any).key_concepts
          : (() => {
              try {
                return JSON.parse((q as any).key_concepts ?? "[]");
              } catch {
                return [];
              }
            })(),
        difficulty: (q as any).difficulty ?? null,
        topic: (q as any).topic ?? null,
        type: (q as any).question_type === "coding" ? "coding" : "theory",
        createdAt: q.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const answer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const interviewId = Number(req.params.id);
    if (!Number.isFinite(interviewId))
      throw new ApiError(400, "Invalid interview id");

    const requestedType =
      req.body?.type === "coding" || req.body?.type === "theory"
        ? (req.body.type as "coding" | "theory")
        : undefined;

    const difficulty =
      req.body?.difficulty === "easy" || req.body?.difficulty === "medium" || req.body?.difficulty === "hard"
        ? (req.body.difficulty as "easy" | "medium" | "hard")
        : undefined;

    let answerText = String(req.body?.answerText ?? "").trim();
    let code =
      typeof req.body?.code === "string" && req.body.code.trim()
        ? String(req.body.code)
        : undefined;
    const language =
      typeof req.body?.language === "string" && req.body.language.trim()
        ? String(req.body.language).slice(0, 32)
        : undefined;
    const questionId = req.body?.questionId
      ? Number(req.body.questionId)
      : undefined;

    const questionText =
      typeof req.body?.questionText === "string"
        ? req.body.questionText
        : undefined;

    const question =
      typeof req.body?.question === "string" && req.body.question.trim()
        ? String(req.body.question)
        : undefined;

    const userAnswer =
      typeof req.body?.userAnswer === "string" && req.body.userAnswer.trim()
        ? String(req.body.userAnswer)
        : undefined;

    if (!answerText && userAnswer && requestedType !== "coding") {
      answerText = userAnswer.trim();
    }
    if (!code && userAnswer && requestedType === "coding") {
      code = userAnswer;
    }

    const correctAnswer =
      typeof req.body?.correctAnswer === "string" && req.body.correctAnswer.trim()
        ? String(req.body.correctAnswer)
        : undefined;

    const testCases = Array.isArray(req.body?.testCases) ? req.body.testCases : undefined;

    if (!answerText && !code) throw new ApiError(400, "answerText or code is required");

    if (
      questionId !== undefined &&
      (!Number.isFinite(questionId) || questionId <= 0)
    ) {
      throw new ApiError(400, "Invalid questionId");
    }

    const result = await saveAnswerWithEvaluation({
      interviewId,
      userId: req.user.id,
      answerText,
      code,
      language,
      difficulty,
      correctAnswer,
      testCases,
      questionId,
      questionText: questionText ?? question,
    });

    console.info("[interview] answer", {
      userId: req.user.id,
      interviewId,
      questionId: result.answer.question_id,
      score: result.evaluation.score,
    });

    res.status(201).json({
      answer: {
        id: result.answer.id,
        questionId: result.answer.question_id,
        answerText: result.answer.answer_text,
        score: result.answer.score,
        technicalAccuracy: (result.answer as any).technical_accuracy ?? null,
        conceptCoverage: (result.answer as any).concept_coverage ?? null,
        communicationScore: (result.answer as any).communication_score ?? null,
        semanticSimilarity: (result.answer as any).semantic_similarity ?? null,
        finalScore: (result.answer as any).final_score ?? null,
        matchedConcepts: (() => {
          try {
            return JSON.parse((result.answer as any).matched_concepts ?? "[]");
          } catch {
            return [];
          }
        })(),
        missingConcepts: (() => {
          try {
            return JSON.parse((result.answer as any).missing_concepts ?? "[]");
          } catch {
            return [];
          }
        })(),
        rating: (result.answer as any).rating ?? null,
        feedback: result.answer.feedback,
        strengths: (result.answer as any).strengths ?? null,
        weaknesses: (result.answer as any).weaknesses ?? null,
        createdAt: result.answer.created_at,
      },
      evaluation: result.evaluation,
    });
  } catch (err) {
    next(err);
  }
};

export const complete = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const interviewId = Number(req.params.id);
    if (!Number.isFinite(interviewId))
      throw new ApiError(400, "Invalid interview id");

    const overallScore =
      req.body?.overallScore !== undefined
        ? Number(req.body.overallScore)
        : undefined;

    const summary =
      typeof req.body?.summary === "string"
        ? req.body.summary
        : undefined;

    if (
      overallScore !== undefined &&
      (!Number.isFinite(overallScore) ||
        overallScore < 0 ||
        overallScore > 100)
    ) {
      throw new ApiError(400, "overallScore must be 0-100");
    }

    const result = await completeInterview({
      interviewId,
      userId: req.user.id,
      overallScore,
      summary,
    });

    console.info("[interview] complete", {
      userId: req.user.id,
      interviewId,
      overallScore: result.overall_score,
    });

    res.status(201).json({
      result: {
        id: result.id,
        interviewId: result.interview_id,
        overallScore: result.overall_score,
        summary: result.summary,
        createdAt: result.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const history = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const data = await getInterviewHistory({
      userId: req.user.id,
      page,
      limit,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const remove = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const interviewId = Number(req.params.id);
    if (!Number.isFinite(interviewId))
      throw new ApiError(400, "Invalid interview id");

    await deleteInterview({
      interviewId,
      userId: req.user.id,
    });

    console.info("[interview] delete", { userId: req.user.id, interviewId });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};

export const details = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const interviewId = Number(req.params.id);
    if (!Number.isFinite(interviewId))
      throw new ApiError(400, "Invalid interview id");

    const interview = await getInterviewDetails({
      interviewId,
      userId: req.user.id,
    });

    res.json({ interview });
  } catch (err) {
    next(err);
  }
};
