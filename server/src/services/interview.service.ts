import type { RowDataPacket } from "mysql2/promise";
import { exec, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";
import {
  evaluateInterviewAnswer,
  generateInterviewQuestion,
  summarizeInterview,
} from "./gemini.service";

type Difficulty = "easy" | "medium" | "hard";
type QuestionType = "theory" | "coding";
type Rating = "Poor" | "Average" | "Good" | "Excellent";

type InterviewRow = RowDataPacket & {
  id: number;
  user_id: number;
  role: string;
  experience: string;
  difficulty: Difficulty | null;
  tech_stack: any;
  status: "IN_PROGRESS" | "COMPLETED";
  created_at: Date;
  completed_at: Date | null;
};

type QuestionRow = RowDataPacket & {
  id: number;
  interview_id: number;
  question_text: string;
  question_type: QuestionType;
  expected_answer: string | null;
  key_concepts: any;
  difficulty: Difficulty | null;
  topic: string | null;
  created_at: Date;
};

type AnswerRow = RowDataPacket & {
  id: number;
  question_id: number;
  answer_text: string;
  code: string | null;
  score: number | null;
  technical_accuracy: number | null;
  concept_coverage: number | null;
  communication_score: number | null;
  semantic_similarity: number | null;
  final_score: number | null;
  matched_concepts: any;
  missing_concepts: any;
  rating: Rating | null;
  language: string | null;
  feedback: string | null;
  strengths: string | null;
  weaknesses: string | null;
  created_at: Date;
};

type ResultRow = RowDataPacket & {
  id: number;
  interview_id: number;
  overall_score: number;
  summary: string;
  created_at: Date;
};

function parseJsonMaybe(v: unknown) {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function parseStringArrayMaybe(value: unknown): string[] {
  const parsed = parseJsonMaybe(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

function getInterviewDifficulty(interview: InterviewRow): Difficulty {
  if (interview.difficulty && isDifficulty(interview.difficulty)) return interview.difficulty;
  const t = interview.tech_stack;
  const fromJson = t && typeof t === "object" ? (t as any).difficulty : undefined;
  if (isDifficulty(fromJson)) return fromJson;
  if (fromJson === "Easy") return "easy";
  if (fromJson === "Medium") return "medium";
  if (fromJson === "Hard") return "hard";
  return "medium";
}

function normalizeQuestion(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[`"'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferQuestionTypeFromText(text: string): QuestionType {
  const t = normalizeQuestion(text);
  const codingHints = ["write", "implement", "code", "algorithm", "complexity", "function", "sql", "query", "optimize"];
  return codingHints.some((h) => t.includes(h)) ? "coding" : "theory";
}

function shouldAskCoding(params: {
  difficulty: Difficulty;
  nextIndex: number;
  askedCoding: number;
  askedTotal: number;
}) {
  const totalTarget = 10;
  const codingTarget = 2;
  const remaining = totalTarget - params.askedTotal;
  const needed = codingTarget - params.askedCoding;
  if (needed <= 0) return false;
  if (remaining <= needed) return true;
  return params.nextIndex === 4 || params.nextIndex === 8;
}

async function getInterviewOrThrow(interviewId: number, userId: number): Promise<InterviewRow> {
  const rows = await query<InterviewRow[]>(
    "SELECT * FROM interviews WHERE id = ? AND user_id = ? LIMIT 1",
    [interviewId, userId]
  );
  const interview = rows[0];
  if (!interview) throw new ApiError(404, "Interview not found");
  interview.tech_stack = parseJsonMaybe(interview.tech_stack);
  return interview;
}

export async function startInterview(params: {
  userId: number;
  role: string;
  experience: string;
  difficulty?: Difficulty;
  techStack: unknown;
}) {
  const result = await exec(
    "INSERT INTO interviews (user_id, role, experience, difficulty, tech_stack, status, created_at) VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', NOW())",
    [
      params.userId,
      params.role,
      params.experience,
      params.difficulty ?? null,
      JSON.stringify(params.techStack ?? []),
    ]
  );

  const rows = await query<InterviewRow[]>(
    "SELECT * FROM interviews WHERE id = ? LIMIT 1",
    [result.insertId]
  );
  const interview = rows[0];
  interview.tech_stack = parseJsonMaybe(interview.tech_stack);
  return interview;
}

export async function addOrGenerateQuestion(params: {
  interviewId: number;
  userId: number;
  questionText?: string;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");

  // Idempotency: if a question already exists with no answer, return it instead of creating a duplicate.
  const pendingRows = await query<QuestionRow[]>(
    "SELECT q.* FROM questions q WHERE q.interview_id = ? AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id = q.id) ORDER BY q.id ASC LIMIT 1",
    [interview.id]
  );
  const pending = pendingRows[0];
  if (!params.questionText?.trim() && pending) return pending;

  const difficulty = getInterviewDifficulty(interview);
  const previousRows = await query<(RowDataPacket & { question_text: string; question_type: QuestionType })[]>(
    "SELECT question_text, question_type FROM questions WHERE interview_id = ? ORDER BY id ASC",
    [interview.id]
  );

  const askedTotal = previousRows.length;
  const askedCoding = previousRows.filter((q) => q.question_type === "coding").length;
  const nextIndex = askedTotal + 1;

  const desiredType: QuestionType =
    params.questionText?.trim()
      ? inferQuestionTypeFromText(params.questionText)
      : shouldAskCoding({ difficulty, nextIndex, askedCoding, askedTotal })
        ? "coding"
        : "theory";

  const previousQuestions = previousRows.map((q) => q.question_text);
  const prevNorm = new Set(previousQuestions.map(normalizeQuestion));

  const generatedQuestion = await (async () => {
    const provided = params.questionText?.trim();
    if (provided) {
      return {
        question: provided,
        expectedAnswer: `A strong answer should address the question directly, use technically correct details, and mention practical tradeoffs for ${interview.role}.`,
        keyConcepts: ["Technical correctness", "Direct answer", "Practical tradeoffs", "Relevant example"],
        difficulty,
        topic: interview.role,
      };
    }

    const generated = await generateInterviewQuestion({
      difficulty,
      role: interview.role,
      experience: interview.experience,
      techStack: interview.tech_stack,
      questionType: desiredType,
      previousQuestions,
    });

    const norm = normalizeQuestion(generated.question);
    if (norm && !prevNorm.has(norm)) return generated;

    const fallbackQuestion = desiredType === "coding"
      ? `Write a small function related to ${interview.role} work and explain your approach and tradeoffs.`
      : `Describe a challenging ${interview.role} project you delivered and how you handled tradeoffs.`;
    return {
      ...generated,
      question: fallbackQuestion,
    };
  })();

  const insert = await exec(
    "INSERT INTO questions (interview_id, question_text, question_type, expected_answer, key_concepts, difficulty, topic, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
    [
      interview.id,
      generatedQuestion.question,
      desiredType,
      generatedQuestion.expectedAnswer || null,
      JSON.stringify(generatedQuestion.keyConcepts ?? []),
      generatedQuestion.difficulty ?? difficulty,
      generatedQuestion.topic || null,
    ]
  );

  const rows = await query<QuestionRow[]>(
    "SELECT * FROM questions WHERE id = ? LIMIT 1",
    [insert.insertId]
  );
  return rows[0];
}

export async function saveAnswerWithEvaluation(params: {
  interviewId: number;
  userId: number;
  answerText: string;
  code?: string;
  language?: string;
  difficulty?: Difficulty;
  correctAnswer?: string;
  testCases?: any;
  questionId?: number;
  questionText?: string;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");

  let questionId = params.questionId;
  let questionText = params.questionText?.trim();
  let questionType: QuestionType = "theory";
  let expectedAnswer = params.correctAnswer?.trim() ?? "";
  let keyConcepts: string[] = [];

  if (!questionId) {
    if (!questionText) throw new ApiError(400, "questionId or questionText is required");
    questionType = inferQuestionTypeFromText(questionText);
    const ins = await exec(
      "INSERT INTO questions (interview_id, question_text, question_type, expected_answer, key_concepts, difficulty, topic, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [interview.id, questionText, questionType, expectedAnswer || null, JSON.stringify([]), getInterviewDifficulty(interview), interview.role,]
    );
    questionId = ins.insertId;
  } else {
    const qrows = await query<QuestionRow[]>(
      "SELECT * FROM questions WHERE id = ? AND interview_id = ? LIMIT 1",
      [questionId, interview.id]
    );
    const q = qrows[0];
    if (!q) throw new ApiError(404, "Question not found");
    questionText = q.question_text;
    questionType = q.question_type;
    expectedAnswer = expectedAnswer || q.expected_answer || "";
    keyConcepts = parseStringArrayMaybe(q.key_concepts);
  }

  const difficulty = params.difficulty && isDifficulty(params.difficulty) ? params.difficulty : getInterviewDifficulty(interview);
  const evaluation = await evaluateInterviewAnswer({
    question: questionText!,
    expectedAnswer,
    keyConcepts,
    userAnswer: questionType === "coding" ? (params.code ?? params.answerText ?? "") : (params.answerText ?? ""),
    difficulty,
    type: questionType,
    testCases: Array.isArray(params.testCases) ? params.testCases : undefined,
  });

  const insAnswer = await exec(
    `INSERT INTO answers (
      question_id, answer_text, code, score, technical_accuracy, concept_coverage,
      communication_score, semantic_similarity, final_score, matched_concepts,
      missing_concepts, rating, language, feedback, strengths, weaknesses, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      questionId,
      params.answerText ?? "",
      params.code ?? null,
      evaluation.score,
      evaluation.technicalAccuracy ?? null,
      evaluation.conceptCoverage ?? null,
      evaluation.communicationScore ?? null,
      evaluation.semanticSimilarity ?? null,
      evaluation.score100 ?? null,
      JSON.stringify(evaluation.matchedConcepts ?? []),
      JSON.stringify(evaluation.missingConcepts ?? []),
      evaluation.rating ?? null,
      params.language ?? null,
      evaluation.feedback,
      evaluation.strengths ?? null,
      evaluation.weaknesses ?? evaluation.suggestions ?? null,
    ]
  );
  const arows = await query<AnswerRow[]>(
    "SELECT * FROM answers WHERE id = ? LIMIT 1",
    [insAnswer.insertId]
  );

  return { answer: arows[0], evaluation };
}

export async function completeInterview(params: {
  interviewId: number;
  userId: number;
  overallScore?: number;
  summary?: string;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);

  const qaRows = await query<
    (RowDataPacket & {
      question_text: string;
      answer_text: string;
      final_score: number | null;
      score: number | null;
      feedback: string | null;
    })[]
  >(
    "SELECT q.question_text, a.answer_text, a.score, a.final_score, a.feedback FROM questions q JOIN answers a ON a.question_id = q.id WHERE q.interview_id = ? ORDER BY q.id ASC, a.id ASC",
    [interview.id]
  );

  const scores100 = qaRows
    .map((r) => (typeof r.final_score === "number" ? r.final_score : typeof r.score === "number" ? r.score * 10 : null))
    .filter((s): s is number => typeof s === "number");
  const computedOverall = scores100.length ? Math.max(0, Math.min(100, Math.round(scores100.reduce((a, b) => a + b, 0) / scores100.length))) : 0;
  const overallScore = typeof params.overallScore === "number" ? params.overallScore : computedOverall;

  const qas = qaRows.map((r) => ({
    question: r.question_text,
    answer: r.answer_text,
    score: typeof r.final_score === "number" ? Math.round(r.final_score / 10) : r.score ?? undefined,
    feedback: r.feedback ?? undefined,
  }));

  const summary =
    params.summary?.trim() ||
    (qas.length
      ? await summarizeInterview({
          role: interview.role,
          experience: interview.experience,
          techStack: interview.tech_stack,
          overallScore,
          qas,
        })
      : "No answers recorded.");

  const existing = await query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM results WHERE interview_id = ? LIMIT 1",
    [interview.id]
  );

  if (existing.length) {
    await exec("UPDATE results SET overall_score = ?, summary = ? WHERE interview_id = ?", [
      overallScore,
      summary,
      interview.id,
    ]);
  } else {
    await exec(
      "INSERT INTO results (interview_id, overall_score, summary, created_at) VALUES (?, ?, ?, NOW())",
      [interview.id, overallScore, summary]
    );
  }

  await exec("UPDATE interviews SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?", [interview.id]);

  const rows = await query<ResultRow[]>(
    "SELECT * FROM results WHERE interview_id = ? LIMIT 1",
    [interview.id]
  );
  return rows[0];
}

export async function getInterviewHistory(params: { userId: number; page: number; limit: number }) {
  const page = Math.max(1, Math.floor(params.page));
  const limit = Math.max(1, Math.min(50, Math.floor(params.limit)));
  const offset = (page - 1) * limit;

  const totalRows = await query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM interviews WHERE user_id = ?",
    [params.userId]
  );

  const items = await query<
    (InterviewRow & { overall_score: number | null; summary: string | null; result_created_at: Date | null })[]
  >(
    `SELECT i.*, r.overall_score, r.summary, r.created_at AS result_created_at
     FROM interviews i
     LEFT JOIN results r ON r.interview_id = i.id
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [params.userId]
  );

  const mapped = items.map((it) => {
    const techStack = parseJsonMaybe(it.tech_stack);
    return {
      id: it.id,
      userId: it.user_id,
      role: it.role,
      experience: it.experience,
      difficulty: it.difficulty ?? null,
      techStack,
      status: it.status,
      createdAt: it.created_at,
      completedAt: it.completed_at,
      result:
        it.overall_score === null
          ? null
          : { overallScore: it.overall_score, summary: it.summary, createdAt: it.result_created_at },
    };
  });

  return { total: totalRows[0]?.c ?? 0, page, limit, items: mapped };
}

export async function deleteInterview(params: { interviewId: number; userId: number }) {
  await getInterviewOrThrow(params.interviewId, params.userId);
  await exec("DELETE FROM interviews WHERE id = ? AND user_id = ?", [
    params.interviewId,
    params.userId,
  ]);
  return { deleted: true };
}

export async function getInterviewDetails(params: { interviewId: number; userId: number }) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);

  const questions = await query<QuestionRow[]>(
    "SELECT * FROM questions WHERE interview_id = ? ORDER BY id ASC",
    [interview.id]
  );
  const answers = await query<AnswerRow[]>(
    "SELECT a.* FROM answers a JOIN questions q ON q.id = a.question_id WHERE q.interview_id = ? ORDER BY q.id ASC, a.id ASC",
    [interview.id]
  );
  const results = await query<ResultRow[]>(
    "SELECT * FROM results WHERE interview_id = ? LIMIT 1",
    [interview.id]
  );

  const answersByQuestionId = new Map<number, AnswerRow[]>();
  for (const a of answers) {
    const list = answersByQuestionId.get(a.question_id) ?? [];
    list.push(a);
    answersByQuestionId.set(a.question_id, list);
  }

  return {
    id: interview.id,
    userId: interview.user_id,
    role: interview.role,
    experience: interview.experience,
    difficulty: interview.difficulty ?? null,
    techStack: interview.tech_stack,
    status: interview.status,
    createdAt: interview.created_at,
    completedAt: interview.completed_at,
    questions: questions.map((q) => ({
        id: q.id,
        interviewId: q.interview_id,
        questionText: q.question_text,
      expectedAnswer: q.expected_answer,
      keyConcepts: parseStringArrayMaybe(q.key_concepts),
      difficulty: q.difficulty,
      topic: q.topic,
      type: q.question_type === "coding" ? "coding" : "theory",
      createdAt: q.created_at,
      answers: (answersByQuestionId.get(q.id) ?? []).map((a) => ({
        id: a.id,
        questionId: a.question_id,
        answerText: a.answer_text,
        code: a.code,
        language: a.language,
        score: a.score,
        technicalAccuracy: a.technical_accuracy,
        conceptCoverage: a.concept_coverage,
        communicationScore: a.communication_score,
        semanticSimilarity: a.semantic_similarity,
        finalScore: a.final_score,
        matchedConcepts: parseStringArrayMaybe(a.matched_concepts),
        missingConcepts: parseStringArrayMaybe(a.missing_concepts),
        rating: a.rating,
        feedback: a.feedback,
        strengths: a.strengths,
        weaknesses: a.weaknesses,
        createdAt: a.created_at,
      })),
    })),
    result: results[0]
      ? {
          id: results[0].id,
          interviewId: results[0].interview_id,
          overallScore: results[0].overall_score,
          summary: results[0].summary,
          createdAt: results[0].created_at,
        }
      : null,
  };
}
