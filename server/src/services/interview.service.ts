import fs from "fs";
import path from "path";
import type { RowDataPacket } from "mysql2/promise";
import { exec, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";
import {
  evaluateInterviewBatch,
  buildQuestionSpecificRubric,
  generateInterviewQuestionsBatch,
  generateFollowUpQuestion as generateFollowUpWithAi,
  isEmptyInterviewAnswer,
  runCodingTestCases,
  type CodingTestCase,
  type InterviewBatchAnswerInput,
  type InterviewerPersonality,
} from "./gemini.service";
import { assertUserCanStartInterview } from "./ban.service";
import { transcribeAudioFile } from "./transcription.service";
import { analyzeAnswerNlp } from "./nlpAnalysis.service";
import { analyzeCommunicationConfidence } from "./confidenceAnalysis.service";
import { correctTranscriptWithContext } from "./transcriptCorrection.service";
import {
  buildCodingFallback,
  domainNeedsCoding,
  getCodingEligibleSkills,
  hasInvalidHtmlFunctionWording,
  languageMatchesSkill,
  type QuestionType,
} from "../domain/interviewDomain";

type Difficulty = "easy" | "medium" | "hard";
type Rating = "Poor" | "Average" | "Good" | "Excellent";
type AudioStatus = "uploaded" | "pending_transcription" | "transcribed" | "failed" | "deleted";
const AUDIO_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "interview-audio");

type InterviewRow = RowDataPacket & {
  id: number;
  user_id: number;
  role: string;
  experience: string;
  personality: InterviewerPersonality;
  difficulty: Difficulty | null;
  tech_stack: any;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  warning_count: number;
  follow_up_count: number;
  interview_source?: "MOCK_FORM" | "RESUME" | null;
  interview_type?: string | null;
  resume_id?: number | null;
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
  skill: string | null;
  language: string | null;
  starter_code: string | null;
  test_cases: any;
  hidden_test_cases: any;
  constraints_json: any;
  expected_output: string | null;
  evaluation_type: string | null;
  options_json: any;
  correct_option: string | null;
  explanation: string | null;
  expected_time_complexity: string | null;
  expected_space_complexity: string | null;
  created_at: Date;
};

type AnswerRow = RowDataPacket & {
  id: number;
  question_id: number;
  answer_text: string;
  code: string | null;
  audio_file_path: string | null;
  audio_status: AudioStatus | null;
  audio_deleted_at: Date | null;
  transcript: string | null;
  raw_transcript: string | null;
  corrected_transcript: string | null;
  follow_up_question: string | null;
  follow_up_answer: string | null;
  follow_up_reason: string | null;
  interviewer_reaction: string | null;
  time_taken_seconds: number | null;
  follow_up_time_taken_seconds: number | null;
  nlp_score: number | null;
  answer_length: number | null;
  nlp_missing_concepts: any;
  filler_words_count: number | null;
  fluency_score: number | null;
  clarity_score: number | null;
  nlp_summary: string | null;
  ai_score: number | null;
  confidence_score: number | null;
  confidence_level: "High" | "Medium" | "Low" | null;
  confidence_reasons: any;
  confidence_tips: any;
  score: number | null;
  technical_accuracy: number | null;
  concept_coverage: number | null;
  communication_score: number | null;
  semantic_similarity: number | null;
  final_score: number | null;
  matched_concepts: any;
  missing_concepts: any;
  factor_scores: any;
  rating: Rating | null;
  language: string | null;
  feedback: string | null;
  strengths: string | null;
  weaknesses: string | null;
  suggestions: string | null;
  created_at: Date;
};

type AudioAnswerRow = RowDataPacket & {
  answer_id: number;
  question_id: number;
  question_text: string;
  interview_id: number;
  user_id: number;
};

type AudioCleanupRow = RowDataPacket & {
  answer_id: number;
  audio_file_path: string | null;
  audio_status: AudioStatus | null;
};

type ColumnRow = RowDataPacket & { Field: string };

type ResultRow = RowDataPacket & {
  id: number;
  interview_id: number;
  overall_score: number | null;
  summary: string;
  question_wise_results: any;
  recommended_focus_areas: any;
  created_at: Date;
};

type QuestionAnswerRow = RowDataPacket & {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  expected_answer: string | null;
  key_concepts: any;
  question_difficulty: Difficulty | null;
  hidden_test_cases: any;
  expected_time_complexity: string | null;
  expected_space_complexity: string | null;
  answer_id: number | null;
  answer_text: string | null;
  code: string | null;
  language: string | null;
  transcript: string | null;
  corrected_transcript: string | null;
  follow_up_question: string | null;
  follow_up_answer: string | null;
  time_taken_seconds: number | null;
};

let answerColumnsCache: Set<string> | null = null;

async function getAnswerColumns() {
  if (answerColumnsCache) return answerColumnsCache;
  const rows = await query<ColumnRow[]>("SHOW COLUMNS FROM answers");
  answerColumnsCache = new Set(rows.map((row) => row.Field));
  return answerColumnsCache;
}

async function updateAnswerFields(answerId: number, fields: Record<string, unknown>) {
  const columns = await getAnswerColumns();
  const entries = Object.entries(fields).filter(([column]) => columns.has(column));
  if (!entries.length) return;

  const setSql = entries.map(([column]) => `${column} = ?`).join(", ");
  await exec(`UPDATE answers SET ${setSql} WHERE id = ?`, [
    ...entries.map(([, value]) => value),
    answerId,
  ]);
}

async function answerColumnSelect(column: string, alias = column) {
  const columns = await getAnswerColumns();
  return columns.has(column) ? `a.${column} AS ${alias}` : `NULL AS ${alias}`;
}

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

function hasGenericExpectedAnswer(value: unknown) {
  return /show accurate .* knowledge|accurately explain the core .* concepts|demonstrate correct .* logic/i.test(String(value ?? ""));
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

function selectedSkillsFromTechStack(techStack: unknown) {
  const parsed = parseJsonMaybe(techStack);
  const raw = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? (parsed as any).skills : [];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .map((skill) => String(skill ?? "").trim())
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (!skill || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeQuestionsForSave(
  role: string,
  selectedSkills: string[],
  questions: Awaited<ReturnType<typeof generateInterviewQuestionsBatch>>
) {
  const selectedByKey = new Map(selectedSkills.map((skill) => [skill.toLowerCase(), skill]));
  const codingSkills = getCodingEligibleSkills(role, selectedSkills);
  let codingRepairIndex = 0;
  return questions.map((question) => {
    const generatedSkill = String(question.skill ?? question.topic ?? "").trim();
    const matchedSkill = selectedByKey.get(generatedSkill.toLowerCase());
    if (/\bemphasize\b/i.test(question.question)) throw new ApiError(500, "Generated question failed wording validation");
    if (matchedSkill) {
      return { ...question, skill: matchedSkill, topic: matchedSkill };
    }

    const fixedSkill = question.questionType === "coding" && codingSkills.length
      ? codingSkills[0]
      : selectedSkills[0];
    console.warn("[interview] repaired generated question skill", {
      selectedSkills,
      domain: role,
      generatedQuestionSkill: generatedSkill || null,
      fixedSkill,
      questionType: question.questionType,
    });

    if (question.questionType === "coding" && codingSkills.length) {
      const fallback = buildCodingFallback(fixedSkill, codingRepairIndex++);
      return {
        ...question,
        question: fallback.question,
        expectedAnswer: `A strong answer should implement the exact behavior requested in “${fallback.question}” and demonstrate why the algorithm is correct. It should cover input validation, edge cases, time and space complexity, and tests that verify the required output.`,
        keyConcepts: ["Correctness", "Input validation", "Edge cases", "Time complexity", "Space complexity", "Test coverage"],
        topic: fixedSkill,
        skill: fixedSkill,
        language: fallback.language,
        starterCode: fallback.starterCode,
        testCases: fallback.visibleTestCases,
        hiddenTestCases: fallback.hiddenTestCases,
        constraints: fallback.constraints,
        expectedOutput: fallback.expectedOutput,
        evaluationType: fallback.evaluationType,
      };
    }

    if (question.questionType === "coding") {
      const practical = /html|css/i.test(fixedSkill);
      return {
        ...question,
        questionType: practical ? "practical" as const : "theory" as const,
        topic: fixedSkill,
        skill: fixedSkill,
        language: undefined,
        starterCode: undefined,
        testCases: undefined,
        hiddenTestCases: undefined,
        expectedOutput: undefined,
        evaluationType: undefined,
        expectedTimeComplexity: undefined,
        expectedSpaceComplexity: undefined,
      };
    }

    return { ...question, skill: fixedSkill, topic: fixedSkill };
  }).map((question) => {
    if (question.questionType === "mcq" && (question.options?.length !== 4 || !question.correctOption || !question.explanation)) {
      throw new ApiError(500, "Generated MCQ metadata is incomplete");
    }
    if (question.questionType === "practical" && ((question.constraints?.length ?? 0) < 2 || !question.expectedOutput || !/\b(write|implement|build|create|code|coding|algorithm|query|data-processing|component|function|logic)\b/i.test(question.question))) {
      return { ...question, questionType: "theory" as const, constraints: undefined, expectedOutput: undefined, evaluationType: undefined };
    }
    if (question.questionType !== "coding") return question;
    const skill = String(question.skill ?? question.topic ?? "").trim();
    if (
      !domainNeedsCoding(role) || !codingSkills.some((selected) => selected.toLowerCase() === skill.toLowerCase()) ||
      /html|css/i.test(question.language ?? "") || hasInvalidHtmlFunctionWording(question.question, skill) ||
      !languageMatchesSkill(skill, question.language ?? "") || !question.starterCode ||
      !question.testCases?.length || !question.hiddenTestCases?.length
    ) throw new ApiError(500, "Generated coding question failed validation");
    return question;
  }).filter((question): question is NonNullable<typeof question> => Boolean(question));
}

function normalizeQuestion(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[`"'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeQuestionKey(text: string): string {
  return normalizeQuestion(text).replace(/\s+/g, " ");
}

function normalizeCodingTestSignature(testCases: unknown) {
  const parsed = Array.isArray(testCases) ? testCases : parseJsonMaybe(testCases);
  if (!Array.isArray(parsed)) return "";
  return JSON.stringify(parsed.map((item) => ({
    input: (item as any)?.input ?? null,
    expected: (item as any)?.expectedOutput ?? (item as any)?.expected ?? (item as any)?.output ?? null,
  })));
}

type NormalizedInterviewQuestion = ReturnType<typeof normalizeQuestionsForSave>[number];

function enforceUniqueGeneratedQuestions(
  role: string,
  selectedSkills: string[],
  questions: NormalizedInterviewQuestion[]
) {
  const codingSkills = getCodingEligibleSkills(role, selectedSkills);
  const seenQuestionText = new Set<string>();
  const seenCodingProblem = new Set<string>();
  const repaired = questions.map((question, index) => {
    let candidate = question;
    let textKey = normalizeQuestionKey(candidate.question);
    let codingKey = candidate.questionType === "coding"
      ? `${textKey}|${normalizeCodingTestSignature(candidate.testCases)}`
      : "";
    if (seenQuestionText.has(textKey) || (codingKey && seenCodingProblem.has(codingKey))) {
      if (candidate.questionType === "coding" && codingSkills.length) {
        const skill = candidate.skill && codingSkills.some((item) => item.toLowerCase() === String(candidate.skill).toLowerCase())
          ? String(candidate.skill)
          : codingSkills[index % codingSkills.length];
        const fallback = buildCodingFallback(skill, index + seenCodingProblem.size + 1);
        candidate = {
          ...candidate,
          question: fallback.question,
          expectedAnswer: `A strong answer should implement the exact behavior requested in "${fallback.question}" and explain logic, edge cases, complexity, and tests.`,
          keyConcepts: ["Logic", "Approach", "Syntax quality", "Edge cases", "Complexity"],
          topic: skill,
          skill,
          language: fallback.language,
          starterCode: fallback.starterCode,
          testCases: fallback.visibleTestCases,
          hiddenTestCases: fallback.hiddenTestCases,
          constraints: fallback.constraints,
          expectedOutput: fallback.expectedOutput,
          evaluationType: fallback.evaluationType,
        };
      } else {
        const skill = String(candidate.skill ?? candidate.topic ?? selectedSkills[index % Math.max(1, selectedSkills.length)] ?? role);
        candidate = {
          ...candidate,
          question: `Explain one ${skill} decision you would make in a real ${role} project, including the tradeoff, risk, and a concrete example.`,
          expectedAnswer: candidate.expectedAnswer || "A strong answer should explain a concrete decision, tradeoff, risk, and practical example.",
          keyConcepts: candidate.keyConcepts?.length ? candidate.keyConcepts : ["Decision making", "Tradeoffs", "Risk", "Practical example"],
        };
      }
      textKey = normalizeQuestionKey(candidate.question);
      codingKey = candidate.questionType === "coding"
        ? `${textKey}|${normalizeCodingTestSignature(candidate.testCases)}`
        : "";
    }
    if (seenQuestionText.has(textKey) || (codingKey && seenCodingProblem.has(codingKey))) {
      throw new ApiError(500, "Generated duplicate interview question failed validation");
    }
    seenQuestionText.add(textKey);
    if (codingKey) seenCodingProblem.add(codingKey);
    return candidate;
  });
  if (repaired.length !== questions.length) throw new ApiError(500, "Generated interview question count changed during validation");
  return repaired;
}

function resolveSafeAudioPath(storedPath: string) {
  const resolved = path.resolve(storedPath);
  const relative = path.relative(AUDIO_UPLOAD_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

async function deleteEvaluatedAudioFiles(interviewId: number) {
  const columns = await getAnswerColumns();
  const required = ["audio_file_path", "audio_status", "audio_deleted_at", "final_score", "feedback"];
  if (required.some((column) => !columns.has(column))) return;

  const rows = await query<AudioCleanupRow[]>(
    `SELECT a.id AS answer_id, a.audio_file_path, a.audio_status
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     WHERE q.interview_id = ?
       AND a.audio_file_path IS NOT NULL
       AND a.audio_status = 'transcribed'
       AND a.final_score IS NOT NULL
       AND a.feedback IS NOT NULL`,
    [interviewId]
  );

  for (const row of rows) {
    const storedPath = row.audio_file_path;
    if (!storedPath) continue;

    const safePath = resolveSafeAudioPath(storedPath);
    if (!safePath) {
      console.warn("[interview] skipped unsafe audio delete path", { answerId: row.answer_id });
      continue;
    }

    try {
      await fs.promises.access(safePath, fs.constants.F_OK);
    } catch {
      await exec("UPDATE answers SET audio_status = 'deleted', audio_deleted_at = NOW() WHERE id = ?", [
        row.answer_id,
      ]);
      continue;
    }

    try {
      await fs.promises.unlink(safePath);
      await exec("UPDATE answers SET audio_status = 'deleted', audio_deleted_at = NOW() WHERE id = ?", [
        row.answer_id,
      ]);
    } catch (err: any) {
      console.warn("[interview] audio delete failed", {
        answerId: row.answer_id,
        message: String(err?.message ?? err),
      });
    }
  }
}

function inferQuestionTypeFromText(text: string): QuestionType {
  const t = normalizeQuestion(text);
  const codingHints = ["write", "implement", "code", "algorithm", "complexity", "function", "sql", "query", "optimize"];
  return codingHints.some((h) => t.includes(h)) ? "coding" : "theory";
}

async function getInterviewOrThrow(interviewId: number, userId: number): Promise<InterviewRow> {
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

export async function startInterview(params: {
  userId: number;
  role: string;
  experience: string;
  difficulty?: Difficulty;
  techStack: unknown;
  personality?: InterviewerPersonality;
  interviewSource?: "MOCK_FORM" | "RESUME";
  resumeId?: number;
}) {
  const selectedSkills = Object.freeze([...selectedSkillsFromTechStack(params.techStack)]);
  if (!selectedSkills.length) {
    throw new ApiError(400, "Please select at least one skill before starting the interview.");
  }
  const difficulty = params.difficulty ?? "medium";
  const domain = params.role.trim();
  const experience = params.experience.trim();
  const questionCount = 10;
  const personality = params.personality ?? "Senior Engineering Manager";
  const incomingTechStack = params.techStack && typeof params.techStack === "object" && !Array.isArray(params.techStack)
    ? params.techStack as Record<string, unknown>
    : {};
  const techStack = Object.freeze({
    ...incomingTechStack,
    skills: selectedSkills,
    difficulty,
    domain,
    interview_source: params.interviewSource ?? (incomingTechStack.interview_source as any) ?? (incomingTechStack.source as any) ?? "MOCK_FORM",
  });
  const requestSnapshot = Object.freeze({ domain, selectedSkills, difficulty, experience, questionCount, techStack });
  await assertUserCanStartInterview(params.userId);

  const interviewColumns = await query<ColumnRow[]>("SHOW COLUMNS FROM interviews");
  const interviewColumnSet = new Set(interviewColumns.map((row) => row.Field));
  const canStoreSource = interviewColumnSet.has("interview_source");
  const canStoreResumeId = interviewColumnSet.has("resume_id");
  const source = params.interviewSource ?? (incomingTechStack.interview_source === "RESUME" || incomingTechStack.source === "RESUME" ? "RESUME" : "MOCK_FORM");
  const insertColumns = ["user_id", "role", "experience", "personality", "difficulty", "tech_stack", "status", "created_at"];
  const placeholders = ["?", "?", "?", "?", "?", "?", "'IN_PROGRESS'", "NOW()"];
  const values: unknown[] = [
    params.userId,
    requestSnapshot.domain,
    requestSnapshot.experience,
    personality,
    requestSnapshot.difficulty,
    JSON.stringify(requestSnapshot.techStack),
  ];
  if (canStoreSource) {
    insertColumns.splice(-2, 0, "interview_source");
    placeholders.splice(-2, 0, "?");
    values.push(source);
  }
  if (canStoreResumeId) {
    insertColumns.splice(-2, 0, "resume_id");
    placeholders.splice(-2, 0, "?");
    values.push(params.resumeId ?? null);
  }
  const result = await exec(
    `INSERT INTO interviews (${insertColumns.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values
  );

  const rows = await query<InterviewRow[]>(
    "SELECT * FROM interviews WHERE id = ? LIMIT 1",
    [result.insertId]
  );
  const interview = rows[0];
  interview.tech_stack = requestSnapshot.techStack;
  const generatedQuestions = await generateInterviewQuestionsBatch({
    difficulty: requestSnapshot.difficulty,
    role: requestSnapshot.domain,
    experience: requestSnapshot.experience,
    techStack: requestSnapshot.techStack,
    selectedSkills: requestSnapshot.selectedSkills,
    count: requestSnapshot.questionCount,
    personality,
  });
  const questionsToSave = normalizeQuestionsForSave(
    requestSnapshot.domain,
    [...requestSnapshot.selectedSkills],
    generatedQuestions
  );
  const uniqueQuestionsToSave = enforceUniqueGeneratedQuestions(
    requestSnapshot.domain,
    [...requestSnapshot.selectedSkills],
    questionsToSave
  );
  if (uniqueQuestionsToSave.length !== requestSnapshot.questionCount) {
    throw new ApiError(500, "Generated interview must contain exactly 10 unique questions");
  }

  for (const question of uniqueQuestionsToSave) {
    await exec(
      "INSERT INTO questions (interview_id, question_text, question_type, expected_answer, key_concepts, difficulty, topic, skill, language, starter_code, test_cases, hidden_test_cases, constraints_json, expected_output, evaluation_type, options_json, correct_option, explanation, expected_time_complexity, expected_space_complexity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
      [
        interview.id,
        question.question,
        question.questionType,
        question.expectedAnswer || null,
        JSON.stringify(question.keyConcepts ?? []),
        question.difficulty ?? requestSnapshot.difficulty,
        question.topic || null,
        question.skill ?? question.topic ?? null,
        question.questionType === "coding" ? question.language ?? null : null,
        question.questionType === "coding" ? question.starterCode ?? null : null,
        question.questionType === "coding" ? JSON.stringify(question.testCases ?? []) : null,
        question.questionType === "coding" ? JSON.stringify(question.hiddenTestCases ?? []) : null,
        question.constraints?.length ? JSON.stringify(question.constraints) : null,
        question.questionType === "coding" || question.questionType === "practical" ? question.expectedOutput ?? null : null,
        question.questionType === "coding" ? question.evaluationType ?? null : null,
        question.questionType === "mcq" ? JSON.stringify(question.options ?? []) : null,
        question.questionType === "mcq" ? question.correctOption ?? null : null,
        question.questionType === "mcq" ? question.explanation ?? null : null,
        question.questionType === "coding" ? question.expectedTimeComplexity ?? null : null,
        question.questionType === "coding" ? question.expectedSpaceComplexity ?? null : null,
      ]
    );
  }

  return interview;
}

export async function addOrGenerateQuestion(params: {
  interviewId: number;
  userId: number;
  questionText?: string;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");

  const pendingRows = await query<QuestionRow[]>(
    "SELECT q.* FROM questions q WHERE q.interview_id = ? AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id = q.id) ORDER BY q.id ASC LIMIT 1",
    [interview.id]
  );
  const pending = pendingRows[0];
  if (pending) return pending;

  throw new ApiError(400, "All interview questions have been answered");
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
  timeTakenSeconds?: number;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");

  let questionId = params.questionId;
  let savedQuestion: QuestionRow | null = null;

  if (!questionId) {
    const questionText = params.questionText?.trim();
    if (!questionText) throw new ApiError(400, "questionId or questionText is required");
    const questionType = inferQuestionTypeFromText(questionText);
    const expectedAnswer = params.correctAnswer?.trim() ?? "";
    const ins = await exec(
      "INSERT INTO questions (interview_id, question_text, question_type, expected_answer, key_concepts, difficulty, topic, test_cases, hidden_test_cases, expected_time_complexity, expected_space_complexity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
      [interview.id, questionText, questionType, expectedAnswer || null, JSON.stringify([]), getInterviewDifficulty(interview), interview.role, null, null, null, null]
    );
    questionId = ins.insertId;
  } else {
    const qrows = await query<QuestionRow[]>(
      "SELECT * FROM questions WHERE id = ? AND interview_id = ? LIMIT 1",
      [questionId, interview.id]
    );
    const q = qrows[0];
    if (!q) throw new ApiError(404, "Question not found");
    savedQuestion = q;
  }

  const selectedOption = params.answerText.trim().toUpperCase();
  const isMcq = savedQuestion?.question_type === "mcq";
  const isMcqCorrect = isMcq && selectedOption === String(savedQuestion?.correct_option ?? "").trim().toUpperCase();
  const mcqScore = isMcq ? (isMcqCorrect ? 10 : 0) : null;
  const mcqFeedback = isMcq ? savedQuestion?.explanation || (isMcqCorrect ? "Correct answer." : "Incorrect answer.") : null;

  const answerColumns = await getAnswerColumns();
  const insertFields: Record<string, unknown> = {
    question_id: questionId,
    answer_text: params.answerText ?? "",
    code: params.code ?? null,
    score: mcqScore,
    technical_accuracy: null,
    concept_coverage: null,
    communication_score: null,
    semantic_similarity: null,
    final_score: null,
    matched_concepts: null,
    missing_concepts: null,
    factor_scores: null,
    rating: isMcq ? (isMcqCorrect ? "Excellent" : "Poor") : null,
    language: params.language ?? null,
    feedback: mcqFeedback,
    strengths: null,
    weaknesses: null,
    suggestions: null,
    time_taken_seconds: params.timeTakenSeconds ?? null,
  };
  const insertEntries = Object.entries(insertFields).filter(([column]) => answerColumns.has(column));
  const insAnswer = await exec(
    `INSERT INTO answers (${insertEntries.map(([column]) => column).join(", ")})
     VALUES (${insertEntries.map(() => "?").join(", ")})`,
    insertEntries.map(([, value]) => value)
  );
  const arows = await query<AnswerRow[]>(
    "SELECT * FROM answers WHERE id = ? LIMIT 1",
    [insAnswer.insertId]
  );

  return {
    answer: arows[0],
    evaluation: isMcq
      ? { score: mcqScore, rating: isMcqCorrect ? "Excellent" : "Poor", feedback: mcqFeedback, correct: isMcqCorrect }
      : null,
  };
}

function answerMayNeedFollowUp(answer: string) {
  const normalized = answer.trim().toLowerCase();
  if (/^(i\s*(do not|don't)\s*know|not sure|no idea|unsure)\b/.test(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length < 45 || /\b(maybe|probably|something|stuff|it depends)\b/.test(normalized);
}

export async function generateFollowUpQuestion(params: {
  interviewId: number;
  userId: number;
  questionId: number;
  answerId: number;
  timerExpired?: boolean;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED" || params.timerExpired) {
    return { followUpNeeded: false, reason: "The interview timer has expired.", interviewerReaction: "Thank you. Let's move on.", followUpQuestion: null };
  }
  if ((interview.follow_up_count ?? 0) >= 3) {
    return { followUpNeeded: false, reason: "The session follow-up limit was reached.", interviewerReaction: "Thank you. Let's move to the next question.", followUpQuestion: null };
  }
  const rows = await query<(QuestionRow & AnswerRow)[]>(
    `SELECT q.*, a.id AS id, a.answer_text, a.transcript, a.corrected_transcript, a.follow_up_question
     FROM questions q JOIN answers a ON a.question_id = q.id
     WHERE q.id = ? AND a.id = ? AND q.interview_id = ? LIMIT 1`,
    [params.questionId, params.answerId, interview.id]
  );
  const row: any = rows[0];
  if (!row) throw new ApiError(404, "Answer not found");
  if (!(["theory", "scenario"] as string[]).includes(row.question_type) || row.follow_up_question) {
    return { followUpNeeded: false, reason: "This question is not eligible for another follow-up.", interviewerReaction: "Thank you. Let's move to the next question.", followUpQuestion: null };
  }
  const candidateAnswer = String(row.corrected_transcript || row.transcript || row.answer_text || "").trim();
  if (!answerMayNeedFollowUp(candidateAnswer)) {
    return { followUpNeeded: false, reason: "The answer is sufficiently detailed.", interviewerReaction: "Good explanation. Let's move to the next topic.", followUpQuestion: null };
  }
  const decision = await generateFollowUpWithAi({
    question: row.question_text,
    answer: candidateAnswer,
    role: interview.role,
    techStack: interview.tech_stack,
    difficulty: row.difficulty && isDifficulty(row.difficulty) ? row.difficulty : getInterviewDifficulty(interview),
    interviewType: row.question_type,
    personality: interview.personality || "Senior Engineering Manager",
    expectedAnswer: row.expected_answer,
    keyConcepts: parseStringArrayMaybe(row.key_concepts),
  });
  if (decision.followUpNeeded && decision.followUpQuestion) {
    const updated = await exec(
      `UPDATE answers a JOIN questions q ON q.id = a.question_id
       JOIN interviews i ON i.id = q.interview_id
       SET a.follow_up_question = ?, a.follow_up_reason = ?, a.interviewer_reaction = ?, i.follow_up_count = i.follow_up_count + 1
       WHERE a.id = ? AND i.id = ? AND a.follow_up_question IS NULL AND i.follow_up_count < 3`,
      [decision.followUpQuestion, decision.reason, decision.interviewerReaction, params.answerId, interview.id]
    );
    if (!updated.affectedRows) return { followUpNeeded: false, reason: "Follow-up limit reached.", interviewerReaction: "Thank you. Let's move on.", followUpQuestion: null };
  } else {
    await updateAnswerFields(params.answerId, { interviewer_reaction: decision.interviewerReaction, follow_up_reason: decision.reason });
  }
  return decision;
}

export async function saveFollowUpAnswer(params: {
  interviewId: number;
  userId: number;
  answerId: number;
  followUpAnswer: string;
  timeTakenSeconds?: number;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");
  const result = await exec(
    `UPDATE answers a JOIN questions q ON q.id = a.question_id
     SET a.follow_up_answer = ?, a.follow_up_time_taken_seconds = ?
     WHERE a.id = ? AND q.interview_id = ? AND a.follow_up_question IS NOT NULL`,
    [params.followUpAnswer.trim(), params.timeTakenSeconds ?? null, params.answerId, interview.id]
  );
  if (!result.affectedRows) throw new ApiError(404, "Follow-up question not found");
  return { saved: true };
}

export async function saveAudioAnswerUpload(params: {
  userId: number;
  interviewId: number;
  questionId: number;
  answerId?: number;
  audioFilePath: string;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");

  const answerIdFilter = params.answerId ? "AND a.id = ?" : "";
  const queryParams = params.answerId
    ? [params.questionId, interview.id, params.answerId]
    : [params.questionId, interview.id];

  const rows = await query<AudioAnswerRow[]>(
     `SELECT
        a.id AS answer_id,
        q.id AS question_id,
        q.question_text,
        q.interview_id,
        i.user_id
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     JOIN interviews i ON i.id = q.interview_id
     WHERE q.id = ?
       AND q.interview_id = ?
       ${answerIdFilter}
     ORDER BY a.id DESC
     LIMIT 1`,
    queryParams
  );

  const answer = rows[0];
  if (!answer) {
    throw new ApiError(
      404,
      params.answerId ? "Answer not found" : "Answer must be submitted before audio upload"
    );
  }

  if (answer.user_id !== params.userId) throw new ApiError(403, "Forbidden");

  await updateAnswerFields(answer.answer_id, {
    audio_file_path: params.audioFilePath,
    audio_status: "uploaded",
  });

  let transcript = "";
  let audioStatus: "uploaded" | "pending_transcription" | "transcribed" | "failed" = "uploaded";
  let transcriptionEngine: "whisper" | "placeholder" | null = null;

  await updateAnswerFields(answer.answer_id, { audio_status: "pending_transcription" });
  audioStatus = "pending_transcription";

  try {
    const result = await transcribeAudioFile(params.audioFilePath);
    transcript = result.transcript;
    transcriptionEngine = result.engine;
    audioStatus = "transcribed";
    const correctedTranscript = transcript
      ? correctTranscriptWithContext({
          questionText: answer.question_text,
          role: interview.role,
          techStack: interview.tech_stack,
          rawTranscript: transcript,
        })
      : "";
    const evaluationTranscript = correctedTranscript || transcript;

    if (evaluationTranscript) {
      await updateAnswerFields(answer.answer_id, {
        transcript: evaluationTranscript,
        raw_transcript: transcript,
        corrected_transcript: correctedTranscript,
        answer_text: evaluationTranscript,
        audio_status: "transcribed",
      });
    } else {
      await updateAnswerFields(answer.answer_id, {
        transcript,
        raw_transcript: transcript,
        corrected_transcript: correctedTranscript,
        audio_status: "transcribed",
      });
    }
  } catch {
    audioStatus = "failed";
    await updateAnswerFields(answer.answer_id, { audio_status: "failed" });
  }

  return {
    answerId: answer.answer_id,
    questionId: answer.question_id,
    interviewId: answer.interview_id,
    audioFilePath: params.audioFilePath,
    audioStatus,
    transcript,
    rawTranscript: transcript,
    correctedTranscript: transcript
      ? correctTranscriptWithContext({
          questionText: answer.question_text,
          role: interview.role,
          techStack: interview.tech_stack,
          rawTranscript: transcript,
        })
      : "",
    transcriptionEngine,
  };
}

function normalizeRunLanguage(language: unknown) {
  return String(language ?? "").trim().toLowerCase();
}

export function canRunCodeLanguage(language: unknown) {
  const normalized = normalizeRunLanguage(language);
  return normalized === "javascript" || normalized === "typescript";
}

function normalizeVisibleTestCases(value: unknown): CodingTestCase[] {
  const parsed = parseJsonMaybe(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      input: item.input,
      expectedOutput: item.expectedOutput,
      expected: item.expected,
      output: item.output,
    }));
}

function calculateHiddenCorrectness(params: {
  code?: string | null;
  language?: string | null;
  hiddenTestCases: CodingTestCase[];
}) {
  if (!params.hiddenTestCases.length) {
    return { score: null as number | null, result: "no hidden test cases available" };
  }

  const code = String(params.code ?? "").trim();
  if (!code) {
    return { score: 0, result: `passed 0/${params.hiddenTestCases.length} hidden test cases (no code submitted)` };
  }

  const language = normalizeRunLanguage(params.language);
  if (language !== "javascript" && language !== "typescript") {
    return {
      score: null,
      result: "Correctness is estimated from the submitted approach because automated test execution is not enabled.",
    };
  }

  const run = runCodingTestCases({
    code,
    language: params.language ?? "",
    testCases: params.hiddenTestCases,
  });
  if (!run.ok) {
    return { score: 0, result: `hidden test execution failed: ${run.error}` };
  }

  const score = Math.max(0, Math.min(100, Math.round((run.passed / Math.max(1, run.total)) * 100)));
  return { score, result: `passed ${run.passed}/${run.total} hidden test cases` };
}

export async function runCodeForQuestion(params: {
  interviewId: number;
  userId: number;
  questionId: number;
  code: string;
  language: string;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") throw new ApiError(400, "Interview already completed");

  const qrows = await query<QuestionRow[]>(
    "SELECT * FROM questions WHERE id = ? AND interview_id = ? LIMIT 1",
    [params.questionId, interview.id]
  );
  const question = qrows[0];
  if (!question) throw new ApiError(404, "Question not found");
  if (question.question_type !== "coding") throw new ApiError(400, "Run Code is only available for coding questions");

  const language = normalizeRunLanguage(params.language);
  if (!canRunCodeLanguage(language)) throw new ApiError(400, "Code execution is not configured for this language");

  const testCases = normalizeVisibleTestCases(question.test_cases);
  if (!testCases.length) {
    return {
      ok: false,
      message: "No test cases available for this question.",
      passed: 0,
      total: 0,
      results: [],
    };
  }

  const result = runCodingTestCases({
    code: params.code,
    language: params.language,
    testCases,
  });

  return {
    ok: result.ok,
    message: result.error ?? `Passed ${result.passed} of ${result.total} test cases.`,
    passed: result.passed,
    total: result.total,
    results: result.results ?? [],
  };
}

export async function completeInterview(params: {
  interviewId: number;
  userId: number;
  overallScore?: number;
  summary?: string;
}) {
  const interview = await getInterviewOrThrow(params.interviewId, params.userId);
  console.info("[interview-evaluation] complete started", {
    interviewId: interview.id,
    userId: params.userId,
  });
  const transcriptSelect = await answerColumnSelect("transcript");
  const correctedTranscriptSelect = await answerColumnSelect("corrected_transcript");

  const qaRows = await query<QuestionAnswerRow[]>(
    `SELECT
       q.id AS question_id,
       q.question_text,
       q.question_type,
       q.expected_answer,
       q.key_concepts,
       q.difficulty AS question_difficulty,
       q.hidden_test_cases,
       q.expected_time_complexity,
       q.expected_space_complexity,
       a.id AS answer_id,
       a.answer_text,
       a.code,
       a.language,
       a.follow_up_question,
       a.follow_up_answer,
       a.time_taken_seconds,
       ${transcriptSelect},
       ${correctedTranscriptSelect}
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.interview_id = ?
     ORDER BY q.id ASC, a.id ASC`,
    [interview.id]
  );

  for (const row of qaRows) {
    const expected = String(row.expected_answer ?? "");
    if (hasGenericExpectedAnswer(expected)) {
      const rubric = buildQuestionSpecificRubric(row.question_text, interview.role);
      row.expected_answer = rubric.expectedAnswer;
      row.key_concepts = rubric.expectedConcepts;
      await exec("UPDATE questions SET expected_answer = ?, key_concepts = ? WHERE id = ? AND interview_id = ?", [
        rubric.expectedAnswer,
        JSON.stringify(rubric.expectedConcepts),
        row.question_id,
        interview.id,
      ]);
    }
  }

  const defaultDifficulty = getInterviewDifficulty(interview);
  const answersToEvaluate: InterviewBatchAnswerInput[] = qaRows
    .filter((row): row is QuestionAnswerRow & { answer_id: number } => typeof row.answer_id === "number" && row.question_type !== "mcq")
    .map((row) => {
      const questionType = row.question_type === "coding" || (row.question_type === "practical" && Boolean(row.code || row.language)) ? "coding" : "theory";
      const answerText = row.corrected_transcript?.trim() || row.transcript?.trim() || row.answer_text || "";
      const hiddenTestCases = questionType === "coding" ? normalizeVisibleTestCases(row.hidden_test_cases) : [];
      const hiddenCorrectness = questionType === "coding"
        ? calculateHiddenCorrectness({
            code: row.code,
            language: row.language,
            hiddenTestCases,
          })
        : { score: null, result: null };
      return {
        answerId: row.answer_id,
        questionId: row.question_id,
        question: row.question_text,
        expectedAnswer: row.expected_answer,
        keyConcepts: parseStringArrayMaybe(row.key_concepts),
        userAnswer: questionType === "coding" && row.code ? row.code : answerText,
        followUpQuestion: row.follow_up_question,
        followUpAnswer: row.follow_up_answer,
        code: row.code,
        explanation: answerText,
        hiddenTestCases,
        expectedTimeComplexity: row.expected_time_complexity,
        expectedSpaceComplexity: row.expected_space_complexity,
        hiddenCorrectnessScore: hiddenCorrectness.score,
        hiddenTestExecutionResult: hiddenCorrectness.result,
        difficulty: row.question_difficulty && isDifficulty(row.question_difficulty) ? row.question_difficulty : defaultDifficulty,
        questionType,
      };
    });

  console.info("[interview-evaluation] Q&A rows prepared", {
    interviewId: interview.id,
    qaRowCount: qaRows.length,
    evaluationAnswerCount: answersToEvaluate.length,
    answerIds: answersToEvaluate.map((answer) => answer.answerId),
  });

  for (const answer of answersToEvaluate) {
    if (isEmptyInterviewAnswer(answer.userAnswer)) {
      await updateAnswerFields(answer.answerId, {
        nlp_score: 0,
        answer_length: 0,
        nlp_missing_concepts: JSON.stringify(answer.keyConcepts ?? []),
        filler_words_count: 0,
        fluency_score: 0,
        clarity_score: 0,
        nlp_summary: "No answer was provided.",
        confidence_score: 0,
        confidence_level: "Low",
        confidence_reasons: JSON.stringify(["No answer was provided."]),
        confidence_tips: JSON.stringify(["Attempt the question and explain your reasoning clearly."]),
      });
      continue;
    }
    try {
      const nlp = analyzeAnswerNlp({
        question: answer.question,
        expectedConcepts: answer.keyConcepts,
        userAnswer: answer.questionType === "coding" ? answer.explanation || answer.userAnswer : answer.userAnswer,
      });
      answer.nlpAnalysis = {
        nlpScore: nlp.nlpScore,
        missingConcepts: nlp.missingConcepts,
        fillerWordsCount: nlp.fillerWordsCount,
        fluencyScore: nlp.fluencyScore,
        clarityScore: nlp.clarityScore,
      };
      const confidence = analyzeCommunicationConfidence({
        answerText: answer.questionType === "coding" ? answer.explanation || answer.userAnswer : answer.userAnswer,
        fillerWordsCount: nlp.fillerWordsCount,
        answerLength: nlp.answerLength,
        fluencyScore: nlp.fluencyScore,
        clarityScore: nlp.clarityScore,
      });

      await updateAnswerFields(answer.answerId, {
        nlp_score: nlp.nlpScore,
        answer_length: nlp.answerLength,
        nlp_missing_concepts: JSON.stringify(nlp.missingConcepts),
        filler_words_count: nlp.fillerWordsCount,
        fluency_score: nlp.fluencyScore,
        clarity_score: nlp.clarityScore,
        nlp_summary: nlp.summary,
        confidence_score: confidence.confidenceScore,
        confidence_level: confidence.confidenceLevel,
        confidence_reasons: JSON.stringify(confidence.reasons),
        confidence_tips: JSON.stringify(confidence.improvementTips),
      });
    } catch {
      await updateAnswerFields(answer.answerId, {
        nlp_score: null,
        nlp_summary: "NLP analysis failed.",
      });
    }
  }

  const batchEvaluation = await evaluateInterviewBatch({
    role: interview.role,
    experience: interview.experience,
    techStack: interview.tech_stack,
    answers: answersToEvaluate,
    personality: interview.personality,
    interviewId: interview.id,
  });

  if (!batchEvaluation.evaluationAvailable) {
    console.warn("[interview-evaluation] evaluation marked unavailable; continuing with returned evaluations", {
      interviewId: interview.id,
      reason: batchEvaluation.failureReason ?? "Unknown evaluation failure",
      qaRowCount: qaRows.length,
      evaluationAnswerCount: answersToEvaluate.length,
      returnedEvaluationCount: batchEvaluation.evaluations.length,
    });
  }

  let answersUpdated = 0;
  for (const evaluation of batchEvaluation.evaluations) {
    await updateAnswerFields(evaluation.answerId, {
      score: evaluation.score,
      ai_score: evaluation.aiScore,
      final_score: evaluation.finalScore,
      main_answer_score: evaluation.mainAnswerScore,
      follow_up_score: evaluation.followUpScore,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      matched_concepts: JSON.stringify(evaluation.matchedConcepts ?? []),
      missing_concepts: JSON.stringify(evaluation.missingConcepts ?? []),
      communication_score: evaluation.communicationScore,
      concept_coverage: evaluation.conceptCoverage,
      technical_accuracy: evaluation.technicalAccuracy,
      semantic_similarity: evaluation.semanticSimilarity,
      factor_scores: JSON.stringify(evaluation.factorScores ?? {}),
      rating: evaluation.rating,
      suggestions: evaluation.suggestions,
    });
    answersUpdated++;
  }

  console.info("[interview-evaluation] answers updated", {
    interviewId: interview.id,
    answersUpdated,
    source: batchEvaluation.source ?? "AI",
  });

  const scores100 = batchEvaluation.evaluations.map((evaluation) => evaluation.finalScore);
  const overallScore = scores100.length
    ? Math.max(0, Math.min(100, Math.round(scores100.reduce((sum, score) => sum + score, 0) / scores100.length)))
    : 0;
  const summary = params.summary?.trim() || batchEvaluation.summary || "No answers recorded.";
  const questionWiseResults = batchEvaluation.evaluations.map((evaluation) => ({
    questionId: String(evaluation.questionId),
    score: evaluation.finalScore,
    mainAnswerScore: evaluation.mainAnswerScore,
    followUpScore: evaluation.followUpScore,
    strengths: evaluation.strengths ? [evaluation.strengths] : [],
    weaknesses: evaluation.weaknesses ? [evaluation.weaknesses] : [],
    improvementSuggestion: evaluation.suggestions,
  }));
  const recommendedFocusAreas = Array.from(new Set(batchEvaluation.evaluations.flatMap((item) => item.missingConcepts))).slice(0, 8);

  const existing = await query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM results WHERE interview_id = ? LIMIT 1",
    [interview.id]
  );

  if (existing.length) {
    await exec("UPDATE results SET overall_score = ?, summary = ?, question_wise_results = ?, recommended_focus_areas = ? WHERE interview_id = ?", [
      overallScore,
      summary,
      JSON.stringify(questionWiseResults),
      JSON.stringify(recommendedFocusAreas),
      interview.id,
    ]);
    console.info("[interview-evaluation] result row updated", {
      interviewId: interview.id,
      resultId: existing[0].id,
      overallScore,
      source: batchEvaluation.source ?? "AI",
    });
  } else {
    await exec(
      "INSERT INTO results (interview_id, overall_score, summary, question_wise_results, recommended_focus_areas, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [interview.id, overallScore, summary, JSON.stringify(questionWiseResults), JSON.stringify(recommendedFocusAreas)]
    );
    console.info("[interview-evaluation] result row created", {
      interviewId: interview.id,
      overallScore,
      source: batchEvaluation.source ?? "AI",
    });
  }

  await exec("UPDATE interviews SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?", [interview.id]);

  try {
    await deleteEvaluatedAudioFiles(interview.id);
  } catch (err: any) {
    console.warn("[interview] audio cleanup skipped", {
      interviewId: interview.id,
      message: String(err?.message ?? err),
    });
  }

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
      interviewType: it.interview_type ?? (techStack?.interview_type === "hr" || techStack?.source === "HR" ? "hr" : "technical"),
      interviewSource: it.interview_source ?? (techStack?.interview_source === "RESUME" || techStack?.source === "RESUME" ? "RESUME" : "MOCK_FORM"),
      resumeId: it.resume_id ?? null,
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
    personality: interview.personality,
    followUpCount: interview.follow_up_count,
    difficulty: interview.difficulty ?? null,
    techStack: interview.tech_stack,
    interviewType: interview.interview_type ?? ((interview.tech_stack as any)?.interview_type === "hr" ? "hr" : "technical"),
    interviewSource: interview.interview_source ?? ((interview.tech_stack as any)?.interview_source === "RESUME" ? "RESUME" : "MOCK_FORM"),
    resumeId: interview.resume_id ?? null,
    status: interview.status,
    createdAt: interview.created_at,
    completedAt: interview.completed_at,
    questions: questions.map((q) => ({
        id: q.id,
        interviewId: q.interview_id,
        questionText: q.question_text,
      expectedAnswer: hasGenericExpectedAnswer(q.expected_answer) ? buildQuestionSpecificRubric(q.question_text, q.skill || interview.role).expectedAnswer : q.expected_answer,
      keyConcepts: hasGenericExpectedAnswer(q.expected_answer) ? buildQuestionSpecificRubric(q.question_text, q.skill || interview.role).expectedConcepts : parseStringArrayMaybe(q.key_concepts),
      testCases: normalizeVisibleTestCases(q.test_cases),
      difficulty: q.difficulty,
      topic: q.topic,
      skill: q.skill,
      language: q.language,
      starterCode: q.starter_code,
      constraints: parseStringArrayMaybe(q.constraints_json),
      expectedOutput: q.expected_output,
      evaluationType: q.evaluation_type,
      canRunCode: q.question_type === "coding" && canRunCodeLanguage(q.language),
      options: parseStringArrayMaybe(q.options_json),
      expectedTimeComplexity: q.expected_time_complexity,
      expectedSpaceComplexity: q.expected_space_complexity,
      type: q.question_type,
      createdAt: q.created_at,
      answers: (answersByQuestionId.get(q.id) ?? []).map((a) => ({
        id: a.id,
        questionId: a.question_id,
        answerText: a.answer_text,
        followUpQuestion: a.follow_up_question,
        followUpAnswer: a.follow_up_answer,
        followUpReason: a.follow_up_reason,
        interviewerReaction: a.interviewer_reaction,
        timeTakenSeconds: a.time_taken_seconds,
        followUpTimeTakenSeconds: a.follow_up_time_taken_seconds,
        code: a.code,
        language: a.language,
        audioFilePath: a.audio_file_path,
        audioStatus: a.audio_status,
        audioDeletedAt: a.audio_deleted_at,
        transcript: a.transcript,
        rawTranscript: a.raw_transcript,
        correctedTranscript: a.corrected_transcript,
        nlpScore: a.nlp_score,
        answerLength: a.answer_length,
        nlpMissingConcepts: parseStringArrayMaybe(a.nlp_missing_concepts),
        fillerWordsCount: a.filler_words_count,
        fluencyScore: a.fluency_score,
        clarityScore: a.clarity_score,
        nlpSummary: a.nlp_summary,
        aiScore: a.ai_score,
        confidenceScore: a.confidence_score,
        confidenceLevel: a.confidence_level,
        confidenceReasons: parseStringArrayMaybe(a.confidence_reasons),
        confidenceTips: parseStringArrayMaybe(a.confidence_tips),
        score: a.score,
        technicalAccuracy: a.technical_accuracy,
        conceptCoverage: a.concept_coverage,
        communicationScore: a.communication_score,
        semanticSimilarity: a.semantic_similarity,
        finalScore: a.final_score,
        factorScores: parseJsonMaybe(a.factor_scores) ?? null,
        matchedConcepts: parseStringArrayMaybe(a.matched_concepts),
        missingConcepts: parseStringArrayMaybe(a.missing_concepts),
        rating: a.rating,
        feedback: a.feedback,
        strengths: a.strengths,
        weaknesses: a.weaknesses,
        suggestions: a.suggestions,
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
