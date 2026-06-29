import type { RowDataPacket } from "mysql2/promise";
import { exec, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";

type Difficulty = "Easy" | "Medium" | "Hard";

const FLOW_CATEGORIES = [
  "Intro/Motivation",
  "Career Goals",
  "Work Style",
  "Team Collaboration",
  "Conflict Resolution",
  "Adaptability",
  "Leadership/Culture Fit",
  "Closing/General HR",
] as const;

type HrQuestionRow = RowDataPacket & {
  question_id: string;
  question: string;
  category: string;
  role: string;
  experience: string;
  difficulty: Difficulty;
  source_type: string;
};

type InterviewRow = RowDataPacket & {
  id: number;
  user_id: number;
  role: string;
  experience: string;
  difficulty: string | null;
  tech_stack: any;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  created_at: Date;
  completed_at: Date | null;
};

type HrAnswerRow = RowDataPacket & {
  id: number;
  interview_id: number;
  question_id: string;
  question_text: string;
  category: string;
  answer_text: string;
  time_taken_seconds: number;
  score: number;
  communication_score: number;
  confidence_score: number;
  structure_score: number;
  professionalism_score: number;
  star_score: number;
  follow_up_question: string | null;
  follow_up_answer: string | null;
  feedback: string | null;
  strengths: any;
  weak_areas: any;
  created_at: Date;
};

type ColumnRow = RowDataPacket & { Field: string };

function normalizeText(value: unknown, maxLength = 255) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeDifficulty(value: unknown): Difficulty {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "hard") return "Hard";
  return "Medium";
}

function parseJsonMaybe(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function meaningfulWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word && !["uh", "um", "hmm", "mmm", "like", "actually"].includes(word));
}

function isMeaninglessAnswer(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  const meaningless = new Set([
    "",
    "uh",
    "um",
    "hmm",
    "yes",
    "no",
    "i don't know",
    "i dont know",
    "nothing",
    "no idea",
    "not developed any skills",
  ]);
  if (meaningless.has(normalized)) return true;
  return meaningfulWords(value).length < 5;
}

function publicQuestion(row: HrQuestionRow, order: number) {
  return {
    order,
    questionId: row.question_id,
    question: row.question,
    category: row.category,
    role: row.role,
    experience: row.experience,
    difficulty: row.difficulty,
    sourceType: row.source_type,
  };
}

async function getInterviewColumns() {
  const rows = await query<ColumnRow[]>("SHOW COLUMNS FROM interviews");
  return new Set(rows.map((row) => row.Field));
}

async function selectOneQuestion(params: {
  category: string;
  role: string;
  experience: string;
  difficulty: Difficulty;
  usedIds: Set<string>;
}) {
  const attempts: Array<{ sql: string; values: unknown[] }> = [
    {
      sql: "category = ? AND role = ? AND experience = ? AND difficulty = ?",
      values: [params.category, params.role, params.experience, params.difficulty],
    },
    {
      sql: "category = ? AND role = ? AND experience = ?",
      values: [params.category, params.role, params.experience],
    },
    {
      sql: "category = ? AND role = ? AND difficulty = ?",
      values: [params.category, params.role, params.difficulty],
    },
    {
      sql: "category = ? AND experience = ? AND difficulty = ?",
      values: [params.category, params.experience, params.difficulty],
    },
    {
      sql: "category = ? AND role = ?",
      values: [params.category, params.role],
    },
    {
      sql: "category = ? AND experience = ?",
      values: [params.category, params.experience],
    },
    {
      sql: "category = ? AND difficulty = ?",
      values: [params.category, params.difficulty],
    },
    {
      sql: "category = ?",
      values: [params.category],
    },
    {
      sql: "category = ?",
      values: ["General"],
    },
    {
      sql: "category IN (?, ?)",
      values: ["General", "Closing/General HR"],
    },
  ];

  for (const attempt of attempts) {
    const excluded = Array.from(params.usedIds);
    const exclusionSql = excluded.length ? ` AND question_id NOT IN (${excluded.map(() => "?").join(", ")})` : "";
    const rows = await query<HrQuestionRow[]>(
      `SELECT question_id, question, category, role, experience, difficulty, source_type
       FROM hr_questions
       WHERE ${attempt.sql}${exclusionSql}
       ORDER BY RAND()
       LIMIT 1`,
      [...attempt.values, ...excluded]
    );
    if (rows[0]) return rows[0];
  }

  return null;
}

async function selectHrQuestions(params: { role: string; experience: string; difficulty: Difficulty }) {
  const questions: HrQuestionRow[] = [];
  const usedIds = new Set<string>();

  for (const category of FLOW_CATEGORIES) {
    const question = await selectOneQuestion({
      category,
      role: params.role,
      experience: params.experience,
      difficulty: params.difficulty,
      usedIds,
    });
    if (question) {
      usedIds.add(question.question_id);
      questions.push({ ...question, category });
    }
  }

  if (questions.length < FLOW_CATEGORIES.length) {
    const needed = FLOW_CATEGORIES.length - questions.length;
    const excluded = Array.from(usedIds);
    const exclusionSql = excluded.length ? `WHERE question_id NOT IN (${excluded.map(() => "?").join(", ")})` : "";
    const fallbackRows = await query<HrQuestionRow[]>(
      `SELECT question_id, question, category, role, experience, difficulty, source_type
       FROM hr_questions
       ${exclusionSql}
       ORDER BY RAND()
       LIMIT ${needed}`,
      excluded
    );
    for (const row of fallbackRows) questions.push(row);
  }

  if (questions.length < FLOW_CATEGORIES.length) {
    throw new ApiError(500, "Not enough HR questions are available. Please import HR questions first.");
  }

  return questions.slice(0, FLOW_CATEGORIES.length);
}

function scoreAnswer(answerText: string, category: string, questionText = "") {
  const text = answerText.trim();
  const words = meaningfulWords(text);
  const lower = text.toLowerCase();
  const questionKeywords = meaningfulWords(questionText).filter((word) => word.length > 3);
  const overlap = questionKeywords.filter((word) => lower.includes(word)).length;
  const hasStar = /\b(situation|task|action|result|challenge|approach|outcome|impact)\b/i.test(text);
  const hasProfessionalTone = !/\b(hate|stupid|idiot|useless|whatever|obviously)\b/i.test(text);
  const hasExample = /\b(for example|example|project|internship|team|worked|built|handled|resolved|led|managed)\b/i.test(text);
  const hasMetrics = /\b\d+%|\b\d+\s*(people|members|days|weeks|months|users|tasks|projects)\b/i.test(text);
  const hasConfidence = /\b(i can|i have|i learned|i believe|i handled|i improved|i contributed|i would)\b/i.test(text);
  const hasOwnership = /\b(i|my role|i handled|i contributed|i learned|i led|i worked|i managed|i built|i resolved)\b/i.test(text);
  const fillerCount = (text.match(/\b(um|uh|like|basically|actually|you know)\b/gi) ?? []).length;

  if (isMeaninglessAnswer(text)) {
    return {
      score: 0,
      communicationScore: 0,
      confidenceScore: 0,
      structureScore: 0,
      professionalismScore: 0,
      starScore: 0,
      strengths: [] as string[],
      weakAreas: ["No meaningful answer was detected."],
      feedback: "No meaningful answer was detected. Please provide a complete response to receive evaluation.",
    };
  }

  const lengthScore = words.length >= 80 ? 85 : words.length >= 45 ? 75 : words.length >= 25 ? 62 : 42;
  const relevanceScore = Math.min(100, 45 + overlap * 10 + (category && lower.includes(category.split("/")[0].toLowerCase()) ? 10 : 0));
  const structureScore = Math.min(100, Math.round(lengthScore * 0.45 + (hasExample ? 18 : 0) + (hasStar ? 18 : 0) + (hasMetrics ? 9 : 0) + relevanceScore * 0.1));
  const communicationScore = Math.min(100, Math.round(lengthScore * 0.62 + (/[.!?]/.test(text) ? 10 : 0) + (words.length <= 180 ? 10 : 0) - fillerCount * 4));
  const confidenceScore = Math.min(100, Math.round(38 + (hasConfidence ? 20 : 0) + (hasOwnership ? 18 : 0) + (hasExample ? 14 : 0) + (hasMetrics ? 10 : 0)));
  const professionalismScore = Math.min(100, Math.round(55 + (hasProfessionalTone ? 25 : -20) + (lower.includes("learn") || lower.includes("improve") ? 10 : 0)));
  const starScore = Math.min(100, Math.round((hasStar ? 55 : 20) + (hasExample ? 25 : 0) + (hasMetrics ? 15 : 0)));
  const score = Math.max(0, Math.min(100, Math.round(
    communicationScore * 0.22 +
      confidenceScore * 0.2 +
      structureScore * 0.24 +
      professionalismScore * 0.2 +
      starScore * 0.14
  )));

  const strengths = [
    hasExample ? "Uses a concrete example." : "",
    hasStar ? "Shows STAR-style structure." : "",
    hasProfessionalTone ? "Maintains a professional tone." : "",
    hasMetrics ? "Includes measurable detail." : "",
    hasOwnership ? "Shows ownership of the situation." : "",
    category ? `Addresses ${category.toLowerCase()} context.` : "",
  ].filter(Boolean);
  const weakAreas = [
    words.length < 45 ? "Add more detail and context." : "",
    !hasExample ? "Include a specific example from work, projects, or college." : "",
    !hasStar ? "Structure the answer with situation, action, and result." : "",
    !hasMetrics ? "Add impact, outcomes, or measurable details." : "",
    !hasOwnership ? "Clarify your exact role and contribution." : "",
    fillerCount > 4 ? "Reduce filler words for clearer communication." : "",
  ].filter(Boolean);

  return {
    score,
    communicationScore,
    confidenceScore,
    structureScore,
    professionalismScore,
    starScore,
    strengths,
    weakAreas,
    feedback: weakAreas.length
      ? `Good start. ${weakAreas[0]}`
      : "Strong HR answer with clear structure, tone, and relevant evidence.",
  };
}

export function generateRuleBasedFollowUp(input: { question: string; answerText: string; category?: string; previousFollowUpCount?: number }) {
  const answer = normalizeText(input.answerText, 4000);
  const words = answer.split(/\s+/).filter(Boolean);
  const category = String(input.category ?? "");
  if ((input.previousFollowUpCount ?? 0) >= 2 || isMeaninglessAnswer(answer)) {
    return { followUpQuestion: null, reason: "Follow-up not useful for this answer." };
  }
  if (words.length < 25) {
    return {
      followUpQuestion: "Could you explain that with one specific example?",
      reason: "The answer needs more evidence.",
    };
  }
  if (!/\b(i|my role|i handled|i contributed|i learned|i led|i worked|i managed|i built|i resolved)\b/i.test(answer)) {
    return { followUpQuestion: "What was your exact role in that situation?", reason: "The answer needs clearer ownership." };
  }
  if (/conflict/i.test(category)) {
    return { followUpQuestion: "How did you make sure the relationship stayed professional?", reason: "Conflict answers should show professionalism." };
  }
  if (/team collaboration/i.test(category)) {
    return { followUpQuestion: "How did your contribution help the team succeed?", reason: "Teamwork answers should show contribution." };
  }
  if (/leadership|culture/i.test(category)) {
    return { followUpQuestion: "How did your decision affect the team?", reason: "Leadership answers should show impact." };
  }
  if (/career goals/i.test(category)) {
    return { followUpQuestion: "What steps are you taking to reach that goal?", reason: "Career answers should show action." };
  }
  if (/motivation|intro/i.test(category)) {
    return { followUpQuestion: "Why does this role specifically interest you?", reason: "Motivation answers should connect to the role." };
  }
  if (!/\b(result|outcome|impact|learned|improved|resolved|achieved)\b/i.test(answer)) {
    return {
      followUpQuestion: "What was the final outcome, and what did you learn from that situation?",
      reason: "The answer is missing outcome or learning.",
    };
  }
  if (!/\b(team|manager|client|mentor|classmate|stakeholder|colleague)\b/i.test(answer) && /team|conflict|collaboration|leadership/i.test(input.category ?? input.question)) {
    return {
      followUpQuestion: "How did you communicate with the other people involved?",
      reason: "The answer can show interpersonal communication more clearly.",
    };
  }
  return {
    followUpQuestion: "If you faced the same situation again, what would you do differently?",
    reason: "This checks reflection and growth mindset.",
  };
}

async function getInterviewOrThrow(interviewId: number, userId: number) {
  const rows = await query<InterviewRow[]>(
    "SELECT * FROM interviews WHERE id = ? LIMIT 1",
    [interviewId]
  );
  const interview = rows[0];
  if (!interview) throw new ApiError(404, "Interview not found");
  if (interview.user_id !== userId) throw new ApiError(403, "Forbidden");
  interview.tech_stack = parseJsonMaybe(interview.tech_stack);
  return interview;
}

export async function assertHrInterviewOwnership(params: { interviewId: number; userId: number }) {
  await getInterviewOrThrow(params.interviewId, params.userId);
}

export async function startHrInterview(params: {
  userId: number;
  role: string;
  experience: string;
  difficulty: Difficulty;
}) {
  const role = normalizeText(params.role || "General", 120) || "General";
  const experience = normalizeText(params.experience || "Fresher", 80) || "Fresher";
  const difficulty = normalizeDifficulty(params.difficulty);
  const questions = await selectHrQuestions({ role, experience, difficulty });
  const columns = await getInterviewColumns();
  const hasInterviewType = columns.has("interview_type");

  const insertColumns = ["user_id", "role", "experience", "personality", "difficulty", "tech_stack", "status", "created_at"];
  const placeholders = ["?", "?", "?", "?", "?", "?", "'IN_PROGRESS'", "NOW()"];
  const values: unknown[] = [
    params.userId,
    role,
    experience,
    "Friendly HR",
    difficulty.toLowerCase(),
    JSON.stringify({
      skills: ["HR Communication", "Behavioral Interview", "Culture Fit"],
      source: "HR",
      interview_type: "hr",
      difficulty,
      questionIds: questions.map((q) => q.question_id),
    }),
  ];
  if (hasInterviewType) {
    insertColumns.splice(-2, 0, "interview_type");
    placeholders.splice(-2, 0, "?");
    values.push("hr");
  }

  const result = await exec(
    `INSERT INTO interviews (${insertColumns.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values
  );

  return {
    interview: {
      id: result.insertId,
      role,
      experience,
      difficulty,
      status: "IN_PROGRESS",
      type: "hr",
      totalQuestions: FLOW_CATEGORIES.length,
      questions: questions.map((question, index) => publicQuestion(question, index + 1)),
    },
  };
}

export async function saveHrAnswer(params: {
  userId: number;
  interviewId: number;
  questionId: string;
  answerText: string;
  followUpQuestion?: string;
  followUpAnswer?: string;
  timeTakenSeconds?: number;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");
  if (interview.status === "ABANDONED") throw new ApiError(400, "Interview has been abandoned");

  const questionId = normalizeText(params.questionId, 100);
  const answerText = String(params.answerText ?? "").trim().slice(0, 5000);
  if (!questionId) throw new ApiError(400, "questionId is required");
  const selectedQuestionIds = Array.isArray((interview.tech_stack as any)?.questionIds)
    ? (interview.tech_stack as any).questionIds.map((id: unknown) => String(id))
    : [];
  if (selectedQuestionIds.length && !selectedQuestionIds.includes(questionId)) {
    throw new ApiError(403, "Question does not belong to this HR interview");
  }
  const questionRows = await query<(HrQuestionRow & { ideal_answer: string })[]>(
    "SELECT question_id, question, category, role, experience, difficulty, source_type, ideal_answer FROM hr_questions WHERE question_id = ? LIMIT 1",
    [questionId]
  );
  const question = questionRows[0];
  if (!question) throw new ApiError(404, "HR question not found");

  const existing = await query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM hr_interview_answers WHERE interview_id = ? AND question_id = ? LIMIT 1",
    [interview.id, questionId]
  );

  const followUpQuestion = String(params.followUpQuestion ?? "").trim().slice(0, 1000) || null;
  const followUpAnswer = String(params.followUpAnswer ?? "").trim().slice(0, 3000) || null;
  const scored = scoreAnswer([answerText, followUpAnswer].filter(Boolean).join("\n"), question.category, question.question);
  const timeTakenSeconds = Math.max(0, Math.min(180, Math.floor(Number(params.timeTakenSeconds ?? 0) || 0)));
  const values = [
    interview.id,
    question.question_id,
    question.question,
    question.category,
    answerText,
    timeTakenSeconds,
    scored.score,
    scored.communicationScore,
    scored.confidenceScore,
    scored.structureScore,
    scored.professionalismScore,
    scored.starScore,
    followUpQuestion,
    followUpAnswer,
    scored.feedback,
    JSON.stringify(scored.strengths),
    JSON.stringify(scored.weakAreas),
  ];

  const savedId = existing[0]?.id;
  let insertId = savedId ?? 0;
  if (savedId) {
    await exec(
      `UPDATE hr_interview_answers SET
        question_text = ?, category = ?, answer_text = ?, time_taken_seconds = ?, score = ?,
        communication_score = ?, confidence_score = ?, structure_score = ?, professionalism_score = ?, star_score = ?,
        follow_up_question = ?, follow_up_answer = ?, feedback = ?, strengths = ?, weak_areas = ?
       WHERE id = ? AND interview_id = ?`,
      [
        question.question,
        question.category,
        answerText,
        timeTakenSeconds,
        scored.score,
        scored.communicationScore,
        scored.confidenceScore,
        scored.structureScore,
        scored.professionalismScore,
        scored.starScore,
        followUpQuestion,
        followUpAnswer,
        scored.feedback,
        JSON.stringify(scored.strengths),
        JSON.stringify(scored.weakAreas),
        savedId,
        interview.id,
      ]
    );
  } else {
    const inserted = await exec(
      `INSERT INTO hr_interview_answers
        (interview_id, question_id, question_text, category, answer_text, time_taken_seconds, score,
         communication_score, confidence_score, structure_score, professionalism_score, star_score,
         follow_up_question, follow_up_answer,
         feedback, strengths, weak_areas, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      values
    );
    insertId = inserted.insertId;
  }

  const answerCount = await query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM hr_interview_answers WHERE interview_id = ?",
    [interview.id]
  );
  const completed = Number(answerCount[0]?.c ?? 0) >= FLOW_CATEGORIES.length;
  if (completed) {
    await exec("UPDATE interviews SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?", [interview.id]);
  }

  return {
    answer: {
      id: insertId,
      questionId,
      score: scored.score,
      feedback: scored.feedback,
      strengths: scored.strengths,
      weakAreas: scored.weakAreas,
    },
    completed,
  };
}

export async function getHrFollowUpCount(params: { userId: number; interviewId: number }) {
  await getInterviewOrThrow(params.interviewId, params.userId);
  const rows = await query<(RowDataPacket & { c: number })[]>(
    "SELECT COUNT(*) AS c FROM hr_interview_answers WHERE interview_id = ? AND follow_up_question IS NOT NULL",
    [params.interviewId]
  );
  return Number(rows[0]?.c ?? 0);
}

export async function abandonHrInterview(params: { userId: number; interviewId: number }) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Completed interviews cannot be abandoned");
  await exec("UPDATE interviews SET status = 'ABANDONED' WHERE id = ? AND user_id = ?", [
    params.interviewId,
    params.userId,
  ]);
  return { abandoned: true, interviewId: params.interviewId };
}

function toArray(value: unknown): string[] {
  const parsed = parseJsonMaybe(value);
  return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
}

export async function getHrResult(params: { userId: number; interviewId: number }) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  const answers = await query<HrAnswerRow[]>(
    "SELECT * FROM hr_interview_answers WHERE interview_id = ? ORDER BY id ASC",
    [interview.id]
  );
  if (!answers.length) throw new ApiError(404, "No HR interview answers found");

  const avg = (selector: (row: HrAnswerRow) => number) =>
    Math.round(answers.reduce((sum, row) => sum + Number(selector(row) ?? 0), 0) / answers.length);
  const overallScore = avg((row) => row.score);
  const allStrengths = Array.from(new Set(answers.flatMap((row) => toArray(row.strengths)))).slice(0, 6);
  const allWeakAreas = Array.from(new Set(answers.flatMap((row) => toArray(row.weak_areas)))).slice(0, 6);

  return {
    interview: {
      id: interview.id,
      role: interview.role,
      experience: interview.experience,
      difficulty: interview.difficulty,
      status: interview.status,
      type: "hr",
      createdAt: interview.created_at,
      completedAt: interview.completed_at,
    },
    report: {
      overallScore,
      communication: avg((row) => row.communication_score),
      confidence: avg((row) => row.confidence_score),
      structure: avg((row) => row.structure_score),
      professionalism: avg((row) => row.professionalism_score),
      starUsage: avg((row) => row.star_score),
      strengths: allStrengths.length ? allStrengths : ["Completed the HR interview practice."],
      weakAreas: allWeakAreas.length ? allWeakAreas : ["Keep adding specific examples and measurable outcomes."],
      questionWiseFeedback: answers.map((row, index) => ({
        order: index + 1,
        questionId: row.question_id,
        question: row.question_text,
        category: row.category,
        answer: row.answer_text,
        followUpQuestion: row.follow_up_question,
        followUpAnswer: row.follow_up_answer,
        score: row.score,
        feedback: row.feedback,
        strengths: toArray(row.strengths),
        weakAreas: toArray(row.weak_areas),
      })),
    },
  };
}
