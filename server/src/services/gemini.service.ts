import vm from "node:vm";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { env } from "../config/env";
import {
  buildCodingFallback,
  buildMcqFallback,
  domainNeedsCoding,
  getCodingEligibleSkills,
  getNonCodingFallback,
  getNonCodingFocus,
  hasInvalidHtmlFunctionWording,
  languageMatchesSkill,
  type EvaluationType,
  type QuestionType,
} from "../domain/interviewDomain";

type Difficulty = "easy" | "medium" | "hard";
export type InterviewerPersonality = "Friendly HR" | "Strict Technical Lead" | "Senior Engineering Manager";
type Rating = "Poor" | "Average" | "Good" | "Excellent";
export type CodingTestCase = {
  input: unknown;
  expectedOutput?: unknown;
  expected?: unknown;
  output?: unknown;
};
export type TheoryFactorScores = {
  relevance: number;
  technicalAccuracy: number;
  completeness: number;
  communicationClarity: number;
  structureOrganization: number;
  examplesPracticalKnowledge: number;
  confidenceFluency: number;
};
export type CodingFactorScores = {
  correctness: number;
  logicProblemSolving: number;
  timeComplexity: number;
  spaceComplexity: number;
  codeQuality: number;
  edgeCaseHandling: number;
  explanationCommunication: number;
};
export type RubricFactorScores = TheoryFactorScores | CodingFactorScores;
export type InterviewQuestionDraft = {
  question: string;
  expectedAnswer: string;
  keyConcepts: string[];
  rubricFocus?: string[];
  difficulty: Difficulty;
  topic: string;
  questionType: QuestionType;
  skill?: string;
  language?: string;
  starterCode?: string;
  testCases?: CodingTestCase[];
  hiddenTestCases?: CodingTestCase[];
  constraints?: string[];
  expectedOutput?: string;
  evaluationType?: EvaluationType;
  options?: string[];
  correctOption?: string;
  explanation?: string;
  expectedTimeComplexity?: string;
  expectedSpaceComplexity?: string;
};
export type InterviewBatchAnswerInput = {
  answerId: number;
  questionId: number;
  question: string;
  expectedAnswer?: string | null;
  keyConcepts?: string[];
  userAnswer: string;
  followUpQuestion?: string | null;
  followUpAnswer?: string | null;
  code?: string | null;
  explanation?: string | null;
  testCases?: CodingTestCase[];
  hiddenTestCases?: CodingTestCase[];
  expectedTimeComplexity?: string | null;
  expectedSpaceComplexity?: string | null;
  hiddenCorrectnessScore?: number | null;
  hiddenTestExecutionResult?: string | null;
  difficulty: Difficulty;
  questionType: QuestionType;
  nlpAnalysis?: {
    nlpScore: number;
    missingConcepts: string[];
    fillerWordsCount: number;
    fluencyScore: number;
    clarityScore: number;
  } | null;
};
export type InterviewBatchAnswerEvaluation = {
  questionId: number;
  answerId: number;
  questionType: QuestionType;
  score: number;
  score100: number;
  aiScore: number;
  finalScore: number;
  mainAnswerScore: number;
  followUpScore: number | null;
  rating: Rating;
  factorScores: RubricFactorScores;
  feedback: string;
  strengths: string;
  weaknesses: string;
  suggestions: string;
  matchedConcepts: string[];
  missingConcepts: string[];
  communicationScore: number;
  conceptCoverage: number;
  technicalAccuracy: number;
  semanticSimilarity: number;
  correctnessLocked?: boolean;
  itemScore?: number;
  rubricScores?: { relevance: number; technicalAccuracy: number; completeness: number; communication: number; structure: number; examples: number; fluency: number };
  communicationConfidence?: number;
  confidenceLevel?: "low" | "medium" | "high";
  improvementSuggestion?: string;
};
export type InterviewBatchEvaluationResult = {
  evaluations: InterviewBatchAnswerEvaluation[];
  summary: string;
  evaluationAvailable: boolean;
  failureReason?: string;
  source?: string;
};

const EMPTY_ANSWER_MARKERS = new Set(["", "(no verbal response)", "no verbal response", "(no code submitted)", "no code submitted", "no answer provided", "(no answer provided)", "transcript not available"]);
const LOCAL_RUBRIC_FEEDBACK = "AI evaluation was unavailable, so this score was generated using local rubric analysis.";

export function isEmptyInterviewAnswer(value: unknown) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return EMPTY_ANSWER_MARKERS.has(normalized);
}

function zeroFactorScores(questionType: QuestionType): RubricFactorScores {
  return questionType === "coding"
    ? { correctness: 0, logicProblemSolving: 0, timeComplexity: 0, spaceComplexity: 0, codeQuality: 0, edgeCaseHandling: 0, explanationCommunication: 0 }
    : { relevance: 0, technicalAccuracy: 0, completeness: 0, communicationClarity: 0, structureOrganization: 0, examplesPracticalKnowledge: 0, confidenceFluency: 0 };
}

type OpenRouterErrorKind = "missing_api_key" | "rate_limited" | "invalid_api_key" | "http" | "timeout" | "network" | "unknown" | "empty";

function clip(text: unknown, maxChars: number) {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}...`;
}

export function extractJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = raw.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(candidate.replace(/^\uFEFF/, "").replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

function extractJsonArray(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseAiEvaluationJson(text: string): { rawEvaluations: unknown[] | null; error?: string } {
  const original = String(text ?? "");
  const cleaned = original.trim().replace(/^\uFEFF/, "");
  const fenced = Array.from(cleaned.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)).map((match) => match[1].trim());
  const candidates = [
    cleaned,
    ...fenced,
    (() => {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      return start >= 0 && end > start ? cleaned.slice(start, end + 1) : "";
    })(),
    (() => {
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      return start >= 0 && end > start ? cleaned.slice(start, end + 1) : "";
    })(),
  ].filter(Boolean);

  let lastError = "No JSON candidate found in AI response.";
  for (const candidate of candidates) {
    for (const value of [candidate, candidate.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return { rawEvaluations: parsed };
        if (parsed && typeof parsed === "object") {
          const evaluations = (parsed as any).evaluations ?? (parsed as any).evaluation ?? (parsed as any).results;
          if (Array.isArray(evaluations)) return { rawEvaluations: evaluations };
          if (typeof evaluations === "string") {
            const nested = parseAiEvaluationJson(evaluations);
            if (nested.rawEvaluations) return nested;
            lastError = nested.error ?? lastError;
          }
        }
        lastError = "Parsed JSON did not contain an evaluations array.";
      } catch (e: any) {
        lastError = String(e?.message ?? e);
      }
    }
  }

  return { rawEvaluations: null, error: lastError };
}

function hasNumericEvaluationScore(raw: Record<string, unknown>) {
  return [
    raw.mainAnswerScore,
    raw.main_answer_score,
    raw.finalScore,
    raw.final_score,
    raw.score100,
    raw.score_100,
    raw.aiScore,
    raw.ai_score,
    raw.score,
  ].some((value) => Number.isFinite(Number(value)));
}

function hasEvaluationFactors(raw: Record<string, unknown>) {
  const value = raw.factorScores ?? raw.factor_scores ?? raw.rubricScores ?? raw.rubric_scores;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function getRating(score100: number): Rating {
  if (score100 >= 85) return "Excellent";
  if (score100 >= 70) return "Good";
  if (score100 >= 45) return "Average";
  return "Poor";
}

export function calculateTheoryScore(factorScores: TheoryFactorScores) {
  return clampNumber(
    factorScores.relevance * 0.25 +
      factorScores.technicalAccuracy * 0.3 +
      factorScores.completeness * 0.2 +
      factorScores.communicationClarity * 0.1 +
      factorScores.structureOrganization * 0.05 +
      factorScores.examplesPracticalKnowledge * 0.05 +
      factorScores.confidenceFluency * 0.05,
    0,
    100,
    0
  );
}

export function calculateCodingScore(factorScores: CodingFactorScores) {
  return clampNumber(
    factorScores.correctness * 0.4 +
      factorScores.logicProblemSolving * 0.2 +
      factorScores.timeComplexity * 0.1 +
      factorScores.spaceComplexity * 0.05 +
      factorScores.codeQuality * 0.1 +
      factorScores.edgeCaseHandling * 0.1 +
      factorScores.explanationCommunication * 0.05,
    0,
    100,
    0
  );
}

function normalizeTheoryFactorScores(value: unknown, fallback: TheoryFactorScores): TheoryFactorScores {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    relevance: clampNumber(raw.relevance, 0, 100, fallback.relevance),
    technicalAccuracy: clampNumber(raw.technicalAccuracy ?? raw.technical_accuracy, 0, 100, fallback.technicalAccuracy),
    completeness: clampNumber(raw.completeness, 0, 100, fallback.completeness),
    communicationClarity: clampNumber(raw.communicationClarity ?? raw.communication_clarity, 0, 100, fallback.communicationClarity),
    structureOrganization: clampNumber(raw.structureOrganization ?? raw.structure_organization, 0, 100, fallback.structureOrganization),
    examplesPracticalKnowledge: clampNumber(raw.examplesPracticalKnowledge ?? raw.examples_practical_knowledge, 0, 100, fallback.examplesPracticalKnowledge),
    confidenceFluency: clampNumber(raw.confidenceFluency ?? raw.confidence_fluency, 0, 100, fallback.confidenceFluency),
  };
}

function normalizeCodingFactorScores(value: unknown, fallback: CodingFactorScores): CodingFactorScores {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    correctness: clampNumber(raw.correctness, 0, 100, fallback.correctness),
    logicProblemSolving: clampNumber(raw.logicProblemSolving ?? raw.logic_problem_solving, 0, 100, fallback.logicProblemSolving),
    timeComplexity: clampNumber(raw.timeComplexity ?? raw.time_complexity, 0, 100, fallback.timeComplexity),
    spaceComplexity: clampNumber(raw.spaceComplexity ?? raw.space_complexity, 0, 100, fallback.spaceComplexity),
    codeQuality: clampNumber(raw.codeQuality ?? raw.code_quality, 0, 100, fallback.codeQuality),
    edgeCaseHandling: clampNumber(raw.edgeCaseHandling ?? raw.edge_case_handling, 0, 100, fallback.edgeCaseHandling),
    explanationCommunication: clampNumber(raw.explanationCommunication ?? raw.explanation_communication, 0, 100, fallback.explanationCommunication),
  };
}

function isDifficulty(value: string): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

function normalizeConceptList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const concept = String(item ?? "").trim();
    const key = concept.toLowerCase();
    if (!concept || seen.has(key)) continue;
    seen.add(key);
    out.push(concept.slice(0, 120));
  }
  return out.slice(0, 12);
}

function normalizeCodingTestCases(value: unknown, limit = 6): CodingTestCase[] {
  if (!Array.isArray(value)) return [];
  const out: CodingTestCase[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const hasExpected = "expectedOutput" in raw || "expected" in raw || "output" in raw;
    if (!("input" in raw) || !hasExpected) continue;
    out.push({
      input: raw.input,
      expectedOutput: "expectedOutput" in raw ? raw.expectedOutput : raw.expected ?? raw.output,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function tokenOverlapScore(source: string, target: string) {
  const sourceTokens = Array.from(new Set(tokenizeForSimilarity(source)));
  if (!sourceTokens.length) return 0;
  const targetTokens = new Set(tokenizeForSimilarity(target));
  const matched = sourceTokens.filter((token) => targetTokens.has(token)).length;
  return Math.round((matched / sourceTokens.length) * 100);
}

function conceptCoverageFromMeaning(concepts: string[], answer: string) {
  if (!concepts.length) return { score: 0, matched: [] as string[], missing: [] as string[] };

  const scored = concepts.map((concept) => {
    const overlap = tokenOverlapScore(concept, answer);
    const similarity = Math.round(cosineSimilarity(createLocalEmbedding(concept), createLocalEmbedding(answer)) * 100);
    return { concept, score: Math.max(overlap, similarity) };
  });

  return {
    score: clampNumber(scored.reduce((sum, item) => sum + item.score, 0) / scored.length, 0, 100, 0),
    matched: scored.filter((item) => item.score >= 45).map((item) => item.concept),
    missing: scored.filter((item) => item.score < 45).map((item) => item.concept),
  };
}

function answerDetailScore(answer: string) {
  const words = tokenizeForSimilarity(answer).length;
  if (words >= 80) return 85;
  if (words >= 45) return 75;
  if (words >= 22) return 65;
  if (words >= 10) return 55;
  return 40;
}

function hasPracticalExample(text: string) {
  return /\b(for example|example|such as|e\.g\.|like when|in practice|real[-\s]?world|project|scenario|case)\b/i.test(text);
}

function asksForExample(text: string) {
  return /\b(example|examples|practical|real[-\s]?world|scenario|case|use case)\b/i.test(text);
}

function normalizeQuestionForDedupe(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[`"']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeQuestionType(value: unknown, fallback: QuestionType): QuestionType {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "coding" || normalized === "theory" || normalized === "mcq" || normalized === "practical" || normalized === "scenario"
    ? normalized
    : fallback;
}

function normalizeSkillName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function extractSelectedSkills(techStack: unknown): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  const addSkill = (value: unknown) => {
    const raw = normalizeSkillName(value);
    if (!raw) return;
    const splitValues = raw.includes(",") ? raw.split(",") : [raw];
    for (const item of splitValues) {
      const skill = normalizeSkillName(item);
      const key = skill.toLowerCase();
      if (!skill || seen.has(key)) continue;
      seen.add(key);
      skills.push(skill);
    }
  };
  const addSkillValue = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) addSkillValue(item);
      return;
    }
    if (value && typeof value === "object") {
      const raw = value as Record<string, unknown>;
      addSkill(raw.name ?? raw.skill ?? raw.label ?? raw.title);
      return;
    }
    addSkill(value);
  };

  if (Array.isArray(techStack)) {
    addSkillValue(techStack);
  } else if (techStack && typeof techStack === "object") {
    const raw = techStack as Record<string, unknown>;
    for (const key of ["skills", "techStack", "tech_stack", "stack", "technologies", "tools"]) {
      addSkillValue(raw[key]);
    }
  } else if (typeof techStack === "string") {
    addSkillValue(techStack);
  }

  return skills.slice(0, 20);
}

function skillAliases(skill: string) {
  const aliases = new Set([skill.toLowerCase()]);
  const lower = skill.toLowerCase();
  if (lower === "javascript") aliases.add("js");
  if (lower === "typescript") aliases.add("ts");
  if (lower === "node.js" || lower === "nodejs") {
    aliases.add("node");
    aliases.add("node.js");
    aliases.add("nodejs");
  }
  if (lower === "react.js" || lower === "reactjs") {
    aliases.add("react");
    aliases.add("react.js");
    aliases.add("reactjs");
  }
  if (lower === "next.js" || lower === "nextjs") {
    aliases.add("next");
    aliases.add("next.js");
    aliases.add("nextjs");
  }
  if (lower === "postgresql") aliases.add("postgres");
  if (lower === "apis" || lower === "api") {
    aliases.add("api");
    aliases.add("apis");
  }
  return Array.from(aliases);
}

function textMentionsSkill(text: string, skill: string) {
  const lowerText = String(text ?? "").toLowerCase();
  return skillAliases(skill).some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i").test(lowerText);
  });
}

function findSelectedSkillReference(text: string, selectedSkills: string[]) {
  return selectedSkills.find((skill) => textMentionsSkill(text, skill)) ?? "";
}

function isSimilarQuestion(candidate: string, existingQuestions: string[]) {
  const candidateTokens = new Set(tokenizeForSimilarity(candidate));
  if (candidateTokens.size < 4) return false;
  for (const existing of existingQuestions) {
    const existingTokens = new Set(tokenizeForSimilarity(existing));
    if (existingTokens.size < 4) continue;
    let overlap = 0;
    for (const token of candidateTokens) {
      if (existingTokens.has(token)) overlap++;
    }
    const smaller = Math.min(candidateTokens.size, existingTokens.size);
    const larger = Math.max(candidateTokens.size, existingTokens.size);
    if (overlap / smaller >= 0.78 || overlap / larger >= 0.62) return true;
  }
  return false;
}

function selectedSkillMentionCount(question: string, skill: string) {
  return Math.max(...skillAliases(skill).map((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (question.match(new RegExp(`(^|[^a-z0-9+#.])${escaped}(?=[^a-z0-9+#.]|$)`, "gi")) ?? []).length;
  }), 0);
}

function hasPoorQuestionQuality(question: string, skill: string, existingQuestions: string[]) {
  const words = question.trim().split(/\s+/).filter(Boolean);
  if (question.trim().length < 35 || words.length < 7) return true;
  if (selectedSkillMentionCount(question, skill) > 2) return true;
  if (/\bimplement\s+solution\b|using the selected technolog|based on the selected skill|\bemphasize\b/i.test(question)) return true;
  return isSimilarQuestion(question, existingQuestions);
}

function categorizeSelectedSkills(selectedSkills: string[]) {
  const frontendKeywords = [
    "react", "next", "vue", "angular", "javascript", "typescript", "html", "css", "tailwind", "sass", "redux", "frontend", "ui", "api integration",
  ];
  const backendKeywords = [
    "node", "express", "nestjs", "mysql", "postgres", "postgresql", "mongodb", "sql", "authentication", "auth", "jwt", "api", "apis", "rest", "graphql", "backend",
  ];
  const frontend: string[] = [];
  const backend: string[] = [];
  for (const skill of selectedSkills) {
    const lower = skill.toLowerCase();
    if (frontendKeywords.some((keyword) => lower.includes(keyword))) frontend.push(skill);
    if (backendKeywords.some((keyword) => lower.includes(keyword))) backend.push(skill);
  }
  return { frontend, backend };
}

function buildSkillCoveragePlan(role: string, selectedSkills: string[], count: number) {
  if (!selectedSkills.length) {
    return "No selected skills were provided. In this case only, use role and experience to create non-generic role-relevant questions.";
  }

  const roleText = role.toLowerCase();
  const minimumSkillQuestions = Math.ceil(count * 0.8);
  const { frontend, backend } = categorizeSelectedSkills(selectedSkills);
  const frontendText = frontend.length ? frontend.join(", ") : "none selected";
  const backendText = backend.length ? backend.join(", ") : "none selected";

  if (roleText.includes("full")) {
    return [
      `Selected skills are the main syllabus. At least ${minimumSkillQuestions} of ${count} questions must directly name and test one selected skill.`,
      `Full Stack split: balance questions between selected frontend skills (${frontendText}) and selected backend skills (${backendText}).`,
      "If only one side has selected skills, use those selected skills and do not invent unselected technologies.",
    ].join(" ");
  }

  if (roleText.includes("front")) {
    return [
      `Selected skills are the main syllabus. At least ${minimumSkillQuestions} of ${count} questions must directly name and test one selected skill.`,
      `For Frontend context, prefer selected frontend skills when present (${frontendText}); otherwise rotate all selected skills.`,
      "Suitable frontend skill angles include React, JavaScript, CSS, HTML, Tailwind, and API integration when those skills were selected.",
    ].join(" ");
  }

  if (roleText.includes("back")) {
    return [
      `Selected skills are the main syllabus. At least ${minimumSkillQuestions} of ${count} questions must directly name and test one selected skill.`,
      `For Backend context, prefer selected backend skills when present (${backendText}); otherwise rotate all selected skills.`,
      "Suitable backend skill angles include Node.js, Express, MySQL, PostgreSQL, authentication, and APIs when those skills were selected.",
    ].join(" ");
  }

  return `Selected skills are the main syllabus. At least ${minimumSkillQuestions} of ${count} questions must directly name and test one selected skill. Rotate through the selected skills instead of asking broad field questions.`;
}

function getFallbackTopic(role: string, techStack: unknown, offset = 0): string {
  const topics = extractSelectedSkills(techStack);
  if (topics.length) return topics[offset % topics.length];
  return role;
}

function buildSkillFocusedFallbackQuestion(skill: string, questionType: QuestionType, index: number) {
  const lower = skill.toLowerCase();
  if (questionType === "coding") {
    const codingVariantIndex = Math.floor(index / 4);
    if (/\breact\b|react\.js|reactjs/.test(lower)) {
      const prompts = [
        `Build a small React component that uses state and props to solve a realistic UI interaction. Explain edge cases and rendering tradeoffs.`,
        `Implement a React list component with filtering or sorting behavior. Explain state updates, keys, and testing edge cases.`,
      ];
      return prompts[codingVariantIndex % prompts.length];
    }
    if (lower.includes("javascript") || lower === "js" || lower.includes("typescript")) {
      const prompts = [
        `Write a ${skill} utility function that transforms and validates a list of records. Explain edge cases and time complexity.`,
        `Implement a ${skill} function that groups records by a field and handles missing or malformed values. Explain complexity and tests.`,
      ];
      return prompts[codingVariantIndex % prompts.length];
    }
    if (lower.includes("css") || lower.includes("tailwind") || lower.includes("html")) {
      const prompts = [
        `Create a responsive ${skill} layout for a compact card/list UI and explain how it handles small screens and accessibility.`,
        `Implement a ${skill} form or navigation layout that remains usable on mobile and desktop. Explain semantics and edge cases.`,
      ];
      return prompts[codingVariantIndex % prompts.length];
    }
    if (lower.includes("express") || lower.includes("node")) {
      const prompts = [
        `Implement a ${skill} API endpoint or middleware that validates input and returns consistent error responses. Explain edge cases and testing.`,
        `Write a ${skill} route handler for paginated data with validation and error handling. Explain how you would test it.`,
      ];
      return prompts[codingVariantIndex % prompts.length];
    }
    if (lower.includes("mysql") || lower.includes("postgres") || lower.includes("sql")) {
      const prompts = [
        `Write a ${skill} query for filtering, joining, and ordering records efficiently. Explain indexes and edge cases.`,
        `Create a ${skill} query that aggregates related records and handles empty results correctly. Explain performance tradeoffs.`,
      ];
      return prompts[codingVariantIndex % prompts.length];
    }
    if (lower.includes("auth") || lower.includes("jwt")) {
      const prompts = [
        `Implement ${skill} logic that validates a request credential and handles expired or invalid sessions. Explain security edge cases.`,
        `Write ${skill} middleware that protects a route and returns safe error responses. Explain token/session edge cases.`,
      ];
      return prompts[codingVariantIndex % prompts.length];
    }
    if (lower.includes("api")) {
      const prompts = [
        `Implement a small ${skill} integration that handles loading, success, validation errors, and retryable failures. Explain edge cases.`,
        `Write ${skill} client or handler logic that normalizes a response and handles network failures. Explain tests and edge cases.`,
      ];
      return prompts[codingVariantIndex % prompts.length];
    }
    const prompts = [
      `Write a small implementation using ${skill} that solves a realistic interview task. Explain edge cases, complexity, and tests.`,
      `Implement a practical ${skill} utility or workflow and explain validation, error handling, and test coverage.`,
    ];
    return prompts[codingVariantIndex % prompts.length];
  }

  const theoryPrompts = [
    `Explain how ${skill} works in a production project, including the main tradeoffs and failure modes.`,
    `Describe a debugging approach for a realistic ${skill} issue, from symptom to verified fix.`,
    `How would you design a maintainable feature using ${skill}, and what decisions would you document?`,
    `What performance, security, or accessibility concerns matter most when working with ${skill}?`,
    `Compare two common approaches in ${skill} and explain when you would choose each one.`,
    `Walk through how you would test code or behavior that depends on ${skill}.`,
    `Describe a real-world ${skill} bug that could pass basic testing and how you would prevent it.`,
    `How would you review a teammate's ${skill} implementation for correctness, maintainability, and risk?`,
    `Explain how you would refactor a messy ${skill} feature without changing user-visible behavior.`,
    `What are the most important edge cases to consider when using ${skill} in this role context?`,
  ];
  return theoryPrompts[index % theoryPrompts.length];
}

function buildFallbackCodingQuestion(topic: string) {
  return `Using ${topic}, implement a solution(input) function that normalizes input data: trim strings, remove null or undefined values from arrays, return a shallow copy for plain objects, and return other values unchanged. Explain edge cases, complexity, and tests.`;
}

function buildFallbackVisibleTestCases(): CodingTestCase[] {
  return [
    { input: "  AceMock  ", expectedOutput: "AceMock" },
    { input: [1, null, 2, undefined, 3], expectedOutput: [1, 2, 3] },
  ];
}

function buildFallbackHiddenTestCases(): CodingTestCase[] {
  return [
    { input: { role: "Frontend", level: "medium" }, expectedOutput: { role: "Frontend", level: "medium" } },
    { input: 42, expectedOutput: 42 },
    { input: [null, "React", undefined, "CSS"], expectedOutput: ["React", "CSS"] },
  ];
}

export function buildQuestionSpecificRubric(question: string, skill: string) {
  const q = question.toLowerCase();
  let concepts: string[];
  if (/missing value|imput/.test(q)) concepts = ["missingness mechanism", "imputation strategy", "bias and leakage", "validation"];
  else if (/overfitting|underfitting/.test(q)) concepts = ["bias-variance tradeoff", "training versus validation performance", "regularization", "cross-validation"];
  else if (/classification model|logistic regression|decision tree/.test(q)) concepts = ["model assumptions", "decision boundary", "interpretability", "validation metrics"];
  else if (/test|testing/.test(q)) concepts = ["unit tests", "integration tests", "edge cases", "regression protection"];
  else if (/performance|optimi/.test(q)) concepts = ["measurement", "bottleneck identification", "tradeoffs", "validation"];
  else if (/failure|error|production/.test(q)) concepts = ["failure modes", "observability", "safe recovery", "preventive controls"];
  else if (/complexity|algorithm|implement|function/.test(q)) concepts = ["correctness", "edge cases", "time complexity", "space complexity"];
  else concepts = [skill || "core concept", "reasoning", "concrete example", "tradeoffs"];
  const subject = question.replace(/[?!.]+$/, "").trim();
  const expectedAnswer = `A strong answer should directly resolve the question, “${subject}.” It should accurately explain ${concepts.slice(0, 3).join(", ")}, and connect the reasoning to ${concepts[3]} with a concrete example or decision.`;
  return { expectedAnswer, expectedConcepts: concepts, rubricFocus: ["technical accuracy", "question completeness", "practical reasoning"] };
}

function domainRequiresCodingTasks(role: string, selectedSkills: string[]) {
  const normalizedRole = role.trim().toLowerCase();
  const tools = selectedSkills.join(" ").toLowerCase();
  if (/ui\s*\/\s*ux|ux\s*\/\s*ui|design|human resources|^hr$/.test(normalizedRole)) return false;
  if (/data science|data analyst/.test(normalizedRole)) {
    return /python|pandas|numpy|scikit|sklearn|machine learning|\bml\b|sql|spark|r programming|jupyter/.test(tools);
  }
  if (/frontend|front-end|backend|back-end|full stack|full-stack/.test(normalizedRole)) return true;
  if (domainNeedsCoding(role)) return true;
  return /(software|developer|programmer|engineer)/.test(normalizedRole) && /python|javascript|typescript|java|c\+\+|\bc\b|node|sql/.test(tools);
}

export function buildFallbackInterviewQuestions(input: {
  difficulty: Difficulty;
  role: string;
  techStack: unknown;
  selectedSkills?: readonly string[];
  count?: number;
}): InterviewQuestionDraft[] {
  const count = Math.max(1, Math.floor(input.count ?? 10));
  const selectedSkills = input.selectedSkills ? [...input.selectedSkills] : extractSelectedSkills(input.techStack);
  const requiresCodingTasks = domainRequiresCodingTasks(input.role, selectedSkills);
  const codingSkills = requiresCodingTasks ? getCodingEligibleSkills(input.role, selectedSkills) : [];
  const questionTypePlan = buildQuestionTypePlan(codingSkills, count, requiresCodingTasks);
  let codingQuestionIndex = 0;
  let mcqQuestionIndex = 0;

  return Array.from({ length: count }, (_, index) => {
    const fallbackSkill = selectedSkills[index % Math.max(1, selectedSkills.length)] || input.role;
    const questionType = questionTypePlan[index];
    const skill = questionType === "coding"
      ? codingSkills[codingQuestionIndex++ % codingSkills.length]
      : fallbackSkill;
    const coding = questionType === "coding" ? buildCodingFallback(skill, codingQuestionIndex - 1) : null;
    const mcq = questionType === "mcq" ? buildMcqFallback(input.role, skill, mcqQuestionIndex++) : null;
    const practical = questionType === "practical"
      ? /sql/i.test(skill)
        ? {
            question: "Write a SQL query that returns each customer with their total completed-order value, including customers with no completed orders, ordered by total value descending.",
            constraints: ["Use a LEFT JOIN", "Exclude non-completed orders from the total", "Return zero for customers without completed orders"],
            expectedOutput: "One row per customer with customer identifier and completed_order_total, highest total first.",
          }
        : /data science|data analyst/i.test(input.role)
          ? {
              question: "Write data-processing logic that counts missing values in every dataset column and returns the counts ordered from highest to lowest.",
              constraints: ["Handle columns with zero missing values", "Do not mutate the input dataset", "Return a deterministic ordering for ties"],
              expectedOutput: "A column-to-missing-count result ordered by descending missing count.",
            }
          : /frontend|ui/i.test(input.role)
            ? {
                question: "Write the component and styling logic for an accessible responsive navigation menu that works with keyboard input and collapses on small screens.",
                constraints: ["Use semantic controls", "Support keyboard navigation and visible focus", "Describe the mobile breakpoint behavior"],
                expectedOutput: "A responsive navigation implementation with accessible expanded and collapsed states.",
              }
            : {
                question: "Write implementation logic that validates an incoming request, rejects invalid fields, and returns a normalized object without mutating the input.",
                constraints: ["Return clear validation errors", "Preserve valid false and zero values", "Do not mutate the input"],
                expectedOutput: "A normalized object for valid input or structured validation errors for invalid input.",
              }
      : null;
    const question = coding?.question ?? practical?.question ?? mcq?.question ?? getNonCodingFallback(input.role, skill, index);
    const rubric = buildQuestionSpecificRubric(question, skill);
    return {
      question,
      expectedAnswer: rubric.expectedAnswer,
      keyConcepts: rubric.expectedConcepts,
      rubricFocus: rubric.rubricFocus,
      difficulty: input.difficulty,
      topic: skill,
      questionType,
      skill: coding?.skill,
      language: coding?.language,
      starterCode: coding?.starterCode,
      testCases: coding?.visibleTestCases,
      hiddenTestCases: coding?.hiddenTestCases,
      constraints: coding?.constraints ?? practical?.constraints,
      expectedOutput: coding?.expectedOutput ?? practical?.expectedOutput,
      evaluationType: coding?.evaluationType,
      options: mcq?.options,
      correctOption: mcq?.correctOption,
      explanation: mcq?.explanation,
      expectedTimeComplexity: coding ? "Defined by the task constraints" : undefined,
      expectedSpaceComplexity: coding ? "Use only the additional space required by the task" : undefined,
    };
  });
}

function buildQuestionTypePlan(codingSkills: string[], count: number, requiresCodingTasks: boolean): QuestionType[] {
  const base: QuestionType[] = !requiresCodingTasks
    ? ["theory", "theory", "scenario", "theory", "theory", "scenario", "theory", "theory", "scenario", "theory"]
    : codingSkills.length
      ? ["theory", "theory", "theory", "coding", "theory", "theory", "theory", "theory", "theory", "coding"]
      : ["theory", "theory", "theory", "practical", "theory", "theory", "theory", "theory", "theory", "practical"];
  return Array.from({ length: count }, (_, index) => base[index % base.length]);
}

function tokenizeForSimilarity(text: string) {
  const stop = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "to", "using", "with",
  ]);
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !stop.has(t));
}

function hashToken(token: string, size: number) {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % size;
}

function createLocalEmbedding(text: string, size = 256) {
  const vector = new Array<number>(size).fill(0);
  for (const token of tokenizeForSimilarity(text)) {
    vector[hashToken(token, size)] += 1;
  }
  return vector;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function logOpenRouterFailure(context: string, error: { kind: OpenRouterErrorKind; status?: number; message: string; bodySnippet?: string }) {
  console.error(`[openrouter] ${context} failed`, {
    kind: error.kind,
    status: error.status,
    message: error.message,
    bodySnippet: error.bodySnippet,
  });
}

export async function openRouterChat(prompt: string, opts?: { timeoutMs?: number; maxTokens?: number; model?: string; temperature?: number; responseFormat?: { type: "json_object" }; stop?: string[] }) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: { kind: "missing_api_key" as const, message: "Missing OPENROUTER_API_KEY" } };
  }

  const timeoutMs = Math.max(1000, Math.floor(opts?.timeoutMs ?? 15000));
  const maxTokens = Math.max(1, Math.min(4000, Math.floor(opts?.maxTokens ?? 200)));
  const model = opts?.model ?? "google/gemini-2.5-flash";
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  };
  if (typeof opts?.temperature === "number") body.temperature = opts.temperature;
  if (opts?.responseFormat) body.response_format = opts.responseFormat;
  if (opts?.stop?.length) body.stop = opts.stop;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const bodyText = await r.text().catch(() => "");

    if (!r.ok) {
      const bodySnippet = clip(bodyText, 1200);
      if (r.status === 429) {
        return { ok: false as const, error: { kind: "rate_limited" as const, message: "OpenRouter rate limit (429)", status: 429, bodySnippet } };
      }
      if (r.status === 401 || r.status === 403) {
        return { ok: false as const, error: { kind: "invalid_api_key" as const, message: `OpenRouter auth failed (${r.status})`, status: r.status, bodySnippet } };
      }
      return { ok: false as const, error: { kind: "http" as const, message: `OpenRouter HTTP ${r.status}`, status: r.status, bodySnippet } };
    }

    let data: any;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch (e: any) {
      return { ok: false as const, error: { kind: "unknown" as const, message: `OpenRouter JSON parse failed: ${String(e?.message ?? e)}` } };
    }

    const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) return { ok: false as const, error: { kind: "empty" as const, message: "OpenRouter returned empty response" } };
    return { ok: true as const, text: content };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false as const, error: { kind: "timeout" as const, message: `OpenRouter request timed out after ${timeoutMs}ms` } };
    }
    return { ok: false as const, error: { kind: "network" as const, message: `OpenRouter network error: ${String(e?.message ?? e)}` } };
  } finally {
    clearTimeout(timeout);
  }
}

function isEvaluationFallbackError(error: { kind: OpenRouterErrorKind; status?: number; message: string; bodySnippet?: string }) {
  if (error.kind === "timeout" || error.kind === "empty") return true;
  if (error.status === 429 || error.status === 408 || error.status === 502 || error.status === 503) return true;
  const text = `${error.message}\n${error.bodySnippet ?? ""}`.toLowerCase();
  return text.includes("provider");
}

export type FollowUpDecision = {
  followUpNeeded: boolean;
  reason: string;
  interviewerReaction: string;
  followUpQuestion: string | null;
};

export async function generateFollowUpQuestion(input: {
  question: string;
  answer: string;
  role: string;
  techStack: unknown;
  difficulty: Difficulty;
  interviewType: string;
  personality: InterviewerPersonality;
  expectedAnswer?: string | null;
  keyConcepts?: string[];
}): Promise<FollowUpDecision> {
  const fallback: FollowUpDecision = {
    followUpNeeded: false,
    reason: "Follow-up generation was unavailable.",
    interviewerReaction: "Thank you. Let's move to the next question.",
    followUpQuestion: null,
  };
  const prompt = [
    "You are conducting a structured interview, not an open-ended chat.",
    "Decide whether exactly one clarifying follow-up is needed because the answer is too short, vague, incomplete, says I don't know, or misses an important concept.",
    "Do not ask a follow-up merely to add variety. Keep the reaction professional and under 18 words. Keep the follow-up to one concise question.",
    "The follow-up must sound as though you listened: refer naturally to the candidate's claim, wording, example, or missing detail.",
    "When a follow-up is needed, the reaction should be a natural bridge such as 'I'd like to explore that a little more.' Never mention moving to the next question.",
    "Never begin with or include: 'This is a follow-up question', 'Here is your follow-up', 'Follow-up question:', or 'I will now ask you'.",
    "Prefer natural forms such as 'You mentioned X. Can you explain Y?', 'Can you give one practical example?', or 'What exactly improves?'.",
    `Personality: ${input.personality}. Never be rude or discouraging.`,
    `Role: ${clip(input.role, 100)}`,
    `Tech stack: ${clip(JSON.stringify(input.techStack ?? {}), 500)}`,
    `Difficulty: ${input.difficulty}`,
    `Interview type: ${clip(input.interviewType, 80)}`,
    `Question: ${clip(input.question, 700)}`,
    `Candidate answer: ${clip(input.answer, 1500)}`,
    `Expected answer: ${clip(input.expectedAnswer ?? "", 900)}`,
    `Important concepts: ${JSON.stringify(normalizeConceptList(input.keyConcepts))}`,
    "Return STRICT JSON only with exactly this shape:",
    '{"followUpNeeded":true,"reason":"","interviewerReaction":"","followUpQuestion":""}',
    "When followUpNeeded is false, followUpQuestion must be null.",
  ].join("\n");
  const response = await openRouterChat(prompt, { timeoutMs: 15000, maxTokens: 280 });
  if (!response.ok) {
    logOpenRouterFailure("generateFollowUpQuestion", response.error);
    return fallback;
  }
  const raw = extractJsonObject(response.text) as any;
  if (!raw || typeof raw.followUpNeeded !== "boolean") return fallback;
  const needed = raw.followUpNeeded === true && typeof raw.followUpQuestion === "string" && raw.followUpQuestion.trim().length > 4;
  const naturalQuestion = needed
    ? clip(raw.followUpQuestion, 700).replace(/^\s*(?:this is (?:a|your) follow-up question[.:;-]?|here is your follow-up[.:;-]?|follow-up(?: question)?\s*:|i will now ask you[.:;-]?)\s*/i, "").trim()
    : null;
  return {
    followUpNeeded: Boolean(needed && naturalQuestion),
    reason: clip(raw.reason || (needed ? "The answer needs clarification." : "The answer is sufficiently complete."), 500),
    interviewerReaction: clip(raw.interviewerReaction || (needed ? "Okay, let's explore that a little further." : "Good explanation. Let's move to the next topic."), 300),
    followUpQuestion: naturalQuestion || null,
  };
}

export type CodingTestCaseResult = {
  input: unknown;
  expected: unknown;
  actual?: unknown;
  passed: boolean;
  error?: string;
};

function coerceExpected(tc: CodingTestCase) {
  if ("expectedOutput" in tc) return (tc as any).expectedOutput;
  if ("expected" in tc) return (tc as any).expected;
  if ("output" in tc) return (tc as any).output;
  return undefined;
}

function normalizeForCompare(v: unknown) {
  if (typeof v === "string") return v.trim();
  return v;
}

function findSolutionFunction(sandbox: any): ((input: any) => any) | null {
  const mod = sandbox?.module?.exports;
  if (typeof mod === "function") return mod;
  if (mod && typeof mod === "object") {
    if (typeof mod.solution === "function") return mod.solution;
    if (typeof mod.solve === "function") return mod.solve;
    if (typeof mod.default === "function") return mod.default;
  }
  if (typeof sandbox.solution === "function") return sandbox.solution;
  if (typeof sandbox.solve === "function") return sandbox.solve;
  return null;
}

function prepareCodeForVm(code: string, language?: string) {
  const normalizedLanguage = String(language ?? "").trim().toLowerCase();
  if (normalizedLanguage === "typescript" || normalizedLanguage === "ts") {
    return ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText;
  }
  return code;
}

export function runCodingTestCases(params: { code: string; testCases: CodingTestCase[]; language?: string }) {
  const sandbox: any = {};
  const moduleObj: any = { exports: {} };
  sandbox.module = moduleObj;
  sandbox.exports = moduleObj.exports;
  sandbox.require = undefined;
  sandbox.process = undefined;
  sandbox.Buffer = undefined;
  sandbox.global = undefined;
  sandbox.console = { log: () => {}, error: () => {}, warn: () => {} };

  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  const runnableCode = prepareCodeForVm(String(params.code ?? ""), params.language);

  try {
    const script = new vm.Script(runnableCode, { filename: "user_code.js" });
    script.runInContext(context, { timeout: 800 });
  } catch (e: any) {
    return {
      ok: false as const,
      passed: 0,
      total: params.testCases.length,
      error: `Code execution failed: ${String(e?.message ?? e)}`,
      results: params.testCases.map((tc) => ({
        input: tc.input,
        expected: coerceExpected(tc),
        passed: false,
        error: `Code execution failed: ${String(e?.message ?? e)}`,
      })),
    };
  }

  const fn = findSolutionFunction(sandbox);
  if (!fn) {
    return {
      ok: false as const,
      passed: 0,
      total: params.testCases.length,
      error: "Could not find a callable solution function. Export a function via module.exports, or define global solution(input)/solve(input).",
      results: params.testCases.map((tc) => ({
        input: tc.input,
        expected: coerceExpected(tc),
        passed: false,
        error: "Could not find a callable solution function.",
      })),
    };
  }

  sandbox.__fn = fn;
  const callScript = new vm.Script("__result = __fn(__input)");

  let passed = 0;
  const results: CodingTestCaseResult[] = [];
  for (const tc of params.testCases) {
    const expected = coerceExpected(tc);
    try {
      sandbox.__input = tc.input;
      sandbox.__result = undefined;
      callScript.runInContext(context, { timeout: 500 });
      const got = sandbox.__result;
      if (got && typeof (got as any).then === "function") {
        results.push({
          input: tc.input,
          expected,
          passed: false,
          error: "Async solution functions are not supported by this runner.",
        });
        continue; // async not supported in this lightweight runner
      }
      const ok = isDeepStrictEqual(normalizeForCompare(got), normalizeForCompare(expected));
      if (ok) passed++;
      results.push({
        input: tc.input,
        expected,
        actual: got,
        passed: ok,
      });
    } catch (e: any) {
      results.push({
        input: tc.input,
        expected,
        passed: false,
        error: `Test case failed: ${String(e?.message ?? e)}`,
      });
    }
  }

  return { ok: true as const, passed, total: params.testCases.length, results };
}

export async function generateInterviewQuestionsBatch(input: {
  difficulty: Difficulty;
  role: string;
  experience: string;
  techStack: unknown;
  selectedSkills?: readonly string[];
  count?: number;
  personality?: InterviewerPersonality;
}): Promise<InterviewQuestionDraft[]> {
  const count = Math.max(1, Math.floor(input.count ?? 10));
  const selectedSkills = input.selectedSkills ? [...input.selectedSkills] : extractSelectedSkills(input.techStack);
  const requiresCodingTasks = domainRequiresCodingTasks(input.role, selectedSkills);
  const codingSkills = requiresCodingTasks ? getCodingEligibleSkills(input.role, selectedSkills) : [];
  const questionTypePlan = buildQuestionTypePlan(codingSkills, count, requiresCodingTasks);
  const codingQuestionCount = questionTypePlan.filter((type) => type === "coding").length;
  const expectedTypeCounts = questionTypePlan.reduce<Record<string, number>>((counts, type) => {
    counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  }, {});
  const nonCodingFocus = getNonCodingFocus(input.role).join(", ");
  const rawTechStack = input.techStack && typeof input.techStack === "object" && !Array.isArray(input.techStack)
    ? input.techStack as Record<string, unknown>
    : {};
  const interviewSource = String(rawTechStack.interview_source ?? rawTechStack.source ?? "").toUpperCase();
  const isResumeInterview = interviewSource === "RESUME";
  const resumeProfile = rawTechStack.resumeProfile && typeof rawTechStack.resumeProfile === "object"
    ? rawTechStack.resumeProfile
    : rawTechStack.profile && typeof rawTechStack.profile === "object"
      ? rawTechStack.profile
      : null;
  const resumeProjects = resumeProfile && typeof resumeProfile === "object" && Array.isArray((resumeProfile as any).projects)
    ? (resumeProfile as any).projects
    : [];
  const resumeFocusAreas = resumeProfile && typeof resumeProfile === "object" && Array.isArray((resumeProfile as any).questionFocusAreas)
    ? (resumeProfile as any).questionFocusAreas
    : [];
  const fallbackQuestions = buildFallbackInterviewQuestions({
    difficulty: input.difficulty,
    role: input.role,
    techStack: input.techStack,
    selectedSkills,
    count,
  });
  const prompt = [
    "You are an interview question generator.",
    `Generate exactly ${count} concise, high-quality interview questions in ONE response.`,
    `Difficulty: ${input.difficulty}`,
    `Role context only: ${clip(input.role, 80)}`,
    `Experience: ${clip(input.experience, 120)}`,
    `Interviewer personality: ${input.personality ?? "Senior Engineering Manager"}. Keep the tone professional, constructive, and never rude.`,
    `User-selected skills (exact allowed list): ${selectedSkills.length ? selectedSkills.join(", ") : "none"}`,
    isResumeInterview
      ? "Interview source: RESUME. Generate questions from the candidate's resume profile, projects, and claimed technologies only."
      : "Interview source: MOCK_FORM.",
    isResumeInterview
      ? `Resume profile JSON: ${clip(JSON.stringify(resumeProfile ?? {}), 1800)}`
      : "",
    isResumeInterview && resumeProjects.length
      ? `Resume projects for deep-dive context: ${clip(JSON.stringify(resumeProjects), 1200)}`
      : "",
    isResumeInterview && resumeFocusAreas.length
      ? `Resume focus areas: ${resumeFocusAreas.slice(0, 10).join(", ")}`
      : "",
    isResumeInterview
      ? "Resume interview mix for 10 questions: 2 project-based, 3 skill-based technical, 2 resume deep-dive, 1 HR/self-introduction, and the remaining questions based on existing coding/MCQ/domain rules."
      : "",
    isResumeInterview
      ? "For resume interviews, avoid generic role-only questions, do not ask about skills not present in the allowed list, and make project questions reference a specific project or claimed technology from the resume profile."
      : "",
    `Required question distribution: ${Object.entries(expectedTypeCounts).map(([type, amount]) => `${amount} ${type}`).join(", ")}.`,
    `Domain policy requires coding/data tasks: ${requiresCodingTasks ? "yes" : "no"}. Never generate coding or implementation-practical questions when it is no.`,
    codingQuestionCount
      ? `Coding questions may use only these coding-capable selected skills: ${codingSkills.join(", ")}. Rotate them when possible.`
      : domainNeedsCoding(input.role)
        ? "No compiler-supported skill was selected. Generate theory and practical questions only."
        : `This interview must contain no coding questions. Use ${nonCodingFocus}, MCQ, and scenario questions according to the required distribution.`,
    "Generate interview questions for AceMock. Every question skill/topic must be one exact user-selected skill when skills are provided.",
    "Each question must focus on one primary skill or one coherent pair. Never concatenate or randomly combine the whole tech stack in a question.",
    "For Data Science theory, prefer realistic statistics, data cleaning, model selection, overfitting, feature engineering, and evaluation questions tied to the selected skill.",
    "For an enabled Data Science coding round, ask a concrete Python data task such as mean/median, duplicate removal, or missing-value counts; never ask a vague production implementation.",
    "Use the domain and selected skill as context. Keep the skill in the skill/topic field; do not force its name into every sentence.",
    "Questions must sound like realistic interview prompts with a concrete problem, decision, or scenario. Avoid generic definitions and template wording.",
    "A question must not mention its selected skill more than twice.",
    "HTML/CSS questions must be layout or UI tasks. Never ask for a function in HTML or a CSS function.",
    `Compiler coding is allowed only for these selected skills: ${codingSkills.join(", ") || "none"}. Do not treat HTML, CSS, React, Figma, UX/UI, SQL, Pandas, QA tools, cloud, security, or DevOps tools as compiler languages.`,
    "Every coding item must include skill, language, starterCode, visibleTestCases, hiddenTestCases, constraints, expectedOutput, evaluationType='function', expectedTimeComplexity, and expectedSpaceComplexity.",
    "Every required practical item in a coding-enabled interview must explicitly require writing code, a SQL query, an algorithm, UI implementation, or data-processing logic. It must include at least two concrete constraints and a verifiable expectedOutput.",
    "Never label a discussion, architecture explanation, production decision, or case-study response as practical. Those are theory or scenario questions and use the short timer.",
    "visibleTestCases and hiddenTestCases use {\"input\":...,\"expectedOutput\":...}.",
    "Use questionType theory, coding, mcq, practical, or scenario. HTML/CSS should use practical or theory. Coding domains must not receive MCQs unless a future explicit MCQ practice mode is provided.",
    "Every mcq item must include exactly four options, correctOption A/B/C/D, and a short explanation.",
    "Never use the word emphasize in a question.",
    "Never write phrases such as 'Implement solution', 'using the selected technology', or 'based on the selected skill'.",
    "For theory and scenario questions, omit compiler metadata. Practical implementation questions must include constraints and expectedOutput but may omit compiler-only test metadata.",
    "Do not repeat or closely paraphrase questions.",
    "Coding questions must be unique by problem description and test-case pattern; never reuse the same coding problem or identical test cases twice.",
    "Return STRICT JSON array only. No markdown.",
    "Each item must have this shape (compiler metadata remains required for coding items):",
    `{"questionText":"","expectedAnswer":"","expectedConcepts":[],"rubricFocus":[],"difficulty":"${input.difficulty}","topic":"","questionType":"theory","skill":"","language":"","starterCode":"","visibleTestCases":[],"hiddenTestCases":[],"constraints":[],"expectedOutput":"","evaluationType":"","options":[],"correctOption":"","explanation":"","expectedTimeComplexity":"","expectedSpaceComplexity":""}`,
    "expectedAnswer must contain 2-4 specific sentences based on that exact question and concrete concepts needed to answer it.",
    "Never create an expectedAnswer by listing or repeating the selected skills, domain, or generic phrases such as 'show accurate knowledge'.",
    "expectedConcepts must contain 4-8 concepts unique to that question. rubricFocus must contain 2-5 question-specific scoring priorities.",
  ].join("\n");

  const parseAndValidate = (parsed: unknown): InterviewQuestionDraft[] | null => {
    if (!Array.isArray(parsed) || parsed.length !== count) return null;
    const questions: InterviewQuestionDraft[] = [];
    const seen = new Set<string>();
    const questionTexts: string[] = [];
    let actualCodingCount = 0;

    for (const value of parsed) {
      if (!value || typeof value !== "object") return null;
      const raw = value as Record<string, unknown>;
      const question = String(raw.questionText ?? raw.question_text ?? raw.question ?? "").trim();
      const expectedAnswer = String(raw.expectedAnswer ?? raw.expected_answer ?? "").trim();
      const keyConcepts = normalizeConceptList(raw.expectedConcepts ?? raw.expected_concepts ?? raw.keyConcepts ?? raw.key_concepts);
      const rubricFocus = normalizeConceptList(raw.rubricFocus ?? raw.rubric_focus);
      const questionType = normalizeQuestionType(raw.questionType ?? raw.question_type ?? raw.type, "theory");
      const rawSkill = String(raw.skill ?? raw.topic ?? "").trim();
      const skill = selectedSkills.length ? findSelectedSkillReference(rawSkill, selectedSkills) : rawSkill || input.role;
      const normalized = normalizeQuestionForDedupe(question);
      const mentionedSkills = selectedSkills.filter((selected) => selected.length >= 3 && question.toLowerCase().includes(selected.toLowerCase()));
      const expectedSentenceCount = (expectedAnswer.match(/[.!?](?:\s|$)/g) ?? []).length;
      if (!question || !expectedAnswer || expectedSentenceCount < 2 || expectedSentenceCount > 4 || keyConcepts.length < 4 || rubricFocus.length < 2 || /show accurate .* knowledge/i.test(expectedAnswer) || !skill || mentionedSkills.length > 2 || seen.has(normalized) || hasPoorQuestionQuality(question, skill, questionTexts)) return null;
      seen.add(normalized);
      questionTexts.push(question);

      const rawDifficulty = String(raw.difficulty ?? input.difficulty).trim().toLowerCase();
      const difficulty = isDifficulty(rawDifficulty) ? rawDifficulty : input.difficulty;
      if (questionType !== "coding") {
        const constraints = normalizeConceptList(raw.constraints);
        if (questionType === "mcq") {
          const options = normalizeConceptList(raw.options);
          const correctOption = String(raw.correctOption ?? raw.correct_option ?? "").trim().toUpperCase();
          const explanation = String(raw.explanation ?? "").trim();
          if (options.length !== 4 || !/^[A-D]$/.test(correctOption) || !explanation) return null;
          questions.push({ question, expectedAnswer, keyConcepts, rubricFocus, difficulty, topic: skill, questionType, options, correctOption, explanation });
        } else {
          const expectedOutput = String(raw.expectedOutput ?? raw.expected_output ?? "").trim();
          if (questionType === "practical" && !/\b(write|implement|build|create|code|coding|algorithm|query|data-processing|component|function|logic)\b/i.test(question)) return null;
          questions.push({ question, expectedAnswer, keyConcepts, rubricFocus, difficulty, topic: skill, questionType, constraints, expectedOutput: expectedOutput || undefined });
        }
        continue;
      }

      actualCodingCount++;
      const language = String(raw.language ?? "").trim();
      const starterCode = String(raw.starterCode ?? raw.starter_code ?? "").trim();
      const testCases = normalizeCodingTestCases(raw.visibleTestCases ?? raw.testCases ?? raw.test_cases, 6);
      const hiddenTestCases = normalizeCodingTestCases(raw.hiddenTestCases ?? raw.hidden_test_cases, 8);
      const constraints = normalizeConceptList(raw.constraints);
      const expectedOutput = String(raw.expectedOutput ?? raw.expected_output ?? "").trim();
      const evaluationType = String(raw.evaluationType ?? raw.evaluation_type ?? "").trim() as EvaluationType;
      const expectedTimeComplexity = String(raw.expectedTimeComplexity ?? raw.expected_time_complexity ?? "").trim();
      const expectedSpaceComplexity = String(raw.expectedSpaceComplexity ?? raw.expected_space_complexity ?? "").trim();
      const allowedEvaluationTypes = new Set(["function"]);
      if (
        !domainNeedsCoding(input.role) ||
        !codingSkills.some((selected) => selected.toLowerCase() === skill.toLowerCase()) ||
        hasInvalidHtmlFunctionWording(question, skill) ||
        !languageMatchesSkill(skill, language) ||
        !starterCode || !testCases.length || !hiddenTestCases.length || !constraints.length ||
        !expectedOutput || !allowedEvaluationTypes.has(evaluationType) ||
        !expectedTimeComplexity || !expectedSpaceComplexity
      ) return null;

      questions.push({
        question, expectedAnswer, keyConcepts, rubricFocus, difficulty, topic: skill, questionType,
        skill, language, starterCode, testCases, hiddenTestCases, constraints,
        expectedOutput, evaluationType, expectedTimeComplexity, expectedSpaceComplexity,
      });
    }
    if (actualCodingCount !== codingQuestionCount) return null;
    const actualTypeCounts = questions.reduce<Record<string, number>>((counts, question) => {
      counts[question.questionType] = (counts[question.questionType] ?? 0) + 1;
      return counts;
    }, {});
    if (Object.entries(expectedTypeCounts).some(([type, amount]) => actualTypeCounts[type] !== amount)) return null;
    if (selectedSkills.some((skill) => /html|css/i.test(skill)) && questions.some((question) => question.questionType === "coding" && /html|css/i.test(question.skill ?? ""))) return null;
    return questions;
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await openRouterChat(`${prompt}\nGeneration attempt: ${attempt}. Validate every field before returning.`, { timeoutMs: 30000, maxTokens: 3400 });
    if (!response.ok) {
      logOpenRouterFailure("generateInterviewQuestionsBatch", response.error);
      continue;
    }
    const questions = parseAndValidate(extractJsonArray(response.text));
    if (questions) return questions;
  }

  return fallbackQuestions;
}

export async function generateInterviewQuestion(input: {
  difficulty: Difficulty;
  role: string;
  experience: string;
  techStack: unknown;
  questionType: QuestionType;
  previousQuestions?: string[];
}) {
  const previousBlock =
    input.previousQuestions && input.previousQuestions.length
      ? `Previous questions (do NOT repeat):\n${input.previousQuestions.map((q, i) => `${i + 1}. ${clip(q, 300)}`).join("\n")}\n`
      : "";

  const prompt = [
    "You are an interview question generator.",
    "Generate exactly ONE concise, high-quality interview question.",
    `Difficulty: ${input.difficulty}`,
    `Question type: ${input.questionType}`,
    `Role: ${clip(input.role, 80)}`,
    `Experience: ${clip(input.experience, 120)}`,
    `Tech stack (JSON): ${clip(JSON.stringify(input.techStack ?? []), 400)}`,
    previousBlock,
    input.questionType === "coding"
      ? "Make it a coding question that requires writing code. Keep it language-agnostic."
      : "Make it a theory/technical discussion question (no coding).",
    "Avoid repeating or closely paraphrasing previous questions.",
    "Return STRICT JSON only:",
    `{"questionText":"","expectedAnswer":"","expectedConcepts":[],"rubricFocus":[],"difficulty":"${input.difficulty}","topic":""}`,
    "expectedAnswer must contain 2-4 concrete, question-specific sentences and must not repeat the tech stack generically.",
    "expectedConcepts must contain 4-8 required concepts and rubricFocus must contain 2-5 scoring priorities.",
  ]
    .filter(Boolean)
    .join("\n");

  const fallbackTopic = Array.isArray(input.techStack) ? String(input.techStack[0] ?? input.role).trim() : input.role;
  const fallbackQuestion = input.questionType === "coding"
    ? fallbackTopic
      ? `Write a small function related to ${fallbackTopic} that demonstrates good problem-solving. Explain tradeoffs.`
      : `Write a small function related to ${input.role} work and explain your approach and tradeoffs.`
    : fallbackTopic
      ? `Pick one challenging part of working with ${fallbackTopic} and explain how you handle it in production.`
      : `Tell me about a challenging project you've delivered as a ${input.role} and what you learned.`;

  const r = await openRouterChat(prompt, { timeoutMs: 15000, maxTokens: 500 });
  if (r.ok) {
    const obj = extractJsonObject(r.text);
    if (obj && typeof obj === "object") {
      const question = String((obj as any).questionText ?? (obj as any).question_text ?? (obj as any).question ?? "").trim();
      const expectedAnswer = String((obj as any).expectedAnswer ?? (obj as any).expected_answer ?? "").trim();
      const keyConcepts = normalizeConceptList((obj as any).expectedConcepts ?? (obj as any).expected_concepts ?? (obj as any).keyConcepts ?? (obj as any).key_concepts);
      const rubricFocus = normalizeConceptList((obj as any).rubricFocus ?? (obj as any).rubric_focus);
      const topic = String((obj as any).topic ?? fallbackTopic ?? input.role).trim();
      const difficulty = String((obj as any).difficulty ?? input.difficulty).trim().toLowerCase();
      if (question && expectedAnswer && keyConcepts.length >= 4 && rubricFocus.length >= 2) {
        return {
          question,
          expectedAnswer,
          keyConcepts,
          rubricFocus,
          difficulty: isDifficulty(difficulty) ? difficulty : input.difficulty,
          topic: topic || input.role,
        };
      }
    }
  }

  if (!r.ok) logOpenRouterFailure("generateInterviewQuestion", r.error);
  const fallbackRubric = buildQuestionSpecificRubric(fallbackQuestion, fallbackTopic || input.role);
  return {
    question: fallbackQuestion,
    expectedAnswer: fallbackRubric.expectedAnswer,
    keyConcepts: fallbackRubric.expectedConcepts,
    rubricFocus: fallbackRubric.rubricFocus,
    difficulty: input.difficulty,
    topic: fallbackTopic || input.role,
  };
}

function buildFallbackAnswerEvaluation(input: InterviewBatchAnswerInput): InterviewBatchAnswerEvaluation {
  const keyConcepts = normalizeConceptList(input.keyConcepts);
  const empty = isEmptyInterviewAnswer(input.userAnswer);
  const answer = String(input.userAnswer ?? "").trim();
  const code = String(input.code ?? (input.questionType === "coding" ? input.userAnswer : "") ?? "").trim();
  const explanation = String(input.explanation ?? "").trim();
  const expectedAnswer = String(input.expectedAnswer ?? "").trim();

  if (empty) {
    return {
      questionId: input.questionId,
      answerId: input.answerId,
      questionType: input.questionType,
      score: 0,
      score100: 0,
      aiScore: 0,
      finalScore: 0,
      mainAnswerScore: 0,
      followUpScore: input.followUpQuestion ? 0 : null,
      rating: "Poor",
      factorScores: zeroFactorScores(input.questionType),
      feedback: "No answer was provided, so this question could not be evaluated.",
      strengths: "",
      weaknesses: "",
      suggestions: "Attempt the question by explaining the key concept, giving one example, and mentioning practical considerations.",
      matchedConcepts: [],
      missingConcepts: [],
      communicationScore: 0,
      conceptCoverage: 0,
      technicalAccuracy: 0,
      semanticSimilarity: 0,
      correctnessLocked: input.questionType === "coding",
      itemScore: 0,
      rubricScores: { relevance: 0, technicalAccuracy: 0, completeness: 0, communication: 0, structure: 0, examples: 0, fluency: 0 },
      communicationConfidence: 0,
      confidenceLevel: "low" as const,
      improvementSuggestion: "Attempt the question by explaining the key concept, giving one example, and mentioning practical considerations.",
    };
  }

  const normalizedAnswer = answer.replace(/\s+/g, " ").trim();
  const tooShort = normalizedAnswer.length < (input.questionType === "coding" ? 12 : 8);
  const answerForScoring = `${answer}\n${explanation}`;
  const conceptCoverageResult = tooShort
    ? { score: 0, matched: [] as string[], missing: keyConcepts }
    : conceptCoverageFromMeaning(keyConcepts, answerForScoring);
  const matchedConcepts = conceptCoverageResult.matched;
  const missingConcepts = conceptCoverageResult.missing;
  const conceptCoverage = conceptCoverageResult.score;
  const semanticSimilarity = expectedAnswer
    ? Math.round(cosineSimilarity(createLocalEmbedding(answerForScoring), createLocalEmbedding(expectedAnswer)) * 100)
    : 50;
  const questionRelevance = tokenOverlapScore(input.question, answerForScoring);
  const detailScore = answerDetailScore(answerForScoring);
  const nlp = input.nlpAnalysis;
  const nlpScore = nlp ? clampNumber(nlp.nlpScore, 0, 100, conceptCoverage) : null;
  const fluencyScore = nlp ? clampNumber(nlp.fluencyScore, 0, 100, 55) : null;
  const clarityScore = nlp ? clampNumber(nlp.clarityScore, 0, 100, 55) : null;
  const communicationSource = input.questionType === "coding" ? explanation || answer : answer;
  const communicationScore = clampNumber(
    Math.min(
      82,
      clarityScore ?? fluencyScore ?? (tooShort ? 35 : communicationSource.length > 400 ? 85 : communicationSource.length > 180 ? 75 : communicationSource.length > 80 ? 65 : 55)
    ),
    0,
    100,
    55
  );
  const baselineMeaning = clampNumber(
    Math.max(
      semanticSimilarity * 0.45 + conceptCoverage * 0.55,
      questionRelevance * 0.3 + semanticSimilarity * 0.25 + conceptCoverage * 0.25 + (nlpScore ?? detailScore) * 0.2
    ),
    0,
    100,
    50
  );
  let technicalAccuracy = tooShort ? Math.min(60, baselineMeaning) : baselineMeaning;
  let feedback = LOCAL_RUBRIC_FEEDBACK;
  let factorScores: RubricFactorScores;

  if (input.questionType === "coding") {
    const testCases = Array.isArray(input.testCases) ? input.testCases : [];
    const testRun = testCases.length && code ? runCodingTestCases({ code, testCases }) : null;
    const hiddenExecutionScore = input.hiddenCorrectnessScore === null || input.hiddenCorrectnessScore === undefined
      ? null
      : clampNumber(input.hiddenCorrectnessScore, 0, 100, 0);
    const executionScore = hiddenExecutionScore !== null
      ? hiddenExecutionScore
      : testRun
      ? testRun.ok
        ? Math.round((testRun.passed / Math.max(1, testRun.total)) * 100)
        : 0
      : null;
    const codeQualityScore = tooShort
      ? 0
      : clampNumber(
          45 +
            (/\b(function|const|let|class|return|module\.exports|=>)\b/.test(code) ? 15 : 0) +
            (/\b(if|for|while|map|reduce|filter|try|catch)\b/.test(code) ? 15 : 0) +
            (code.length > 120 ? 10 : 0) +
            (code.length > 800 ? -10 : 0),
          0,
          100,
          50
        );
    const explanationScore = communicationScore;
    technicalAccuracy = executionScore === null
      ? clampNumber(codeQualityScore * 0.65 + semanticSimilarity * 0.2 + conceptCoverage * 0.15, 0, 100, codeQualityScore)
      : clampNumber(executionScore * 0.7 + codeQualityScore * 0.2 + communicationScore * 0.1, 0, 100, executionScore);
    factorScores = {
      correctness: executionScore ?? technicalAccuracy,
      logicProblemSolving: clampNumber(technicalAccuracy * 0.7 + conceptCoverage * 0.3, 0, 100, technicalAccuracy),
      timeComplexity: /\b(o\(|complexity|time)\b/i.test(`${answer}\n${explanation}`) ? Math.max(60, explanationScore) : Math.min(55, explanationScore),
      spaceComplexity: /\b(space|memory)\b/i.test(`${answer}\n${explanation}`) ? Math.max(60, explanationScore) : Math.min(55, explanationScore),
      codeQuality: codeQualityScore,
      edgeCaseHandling: /\b(edge|empty|null|invalid|boundary|case)\b/i.test(`${answer}\n${explanation}\n${code}`) ? Math.max(65, codeQualityScore) : Math.min(55, codeQualityScore),
      explanationCommunication: explanationScore,
    };
    feedback = hiddenExecutionScore !== null
      ? `${LOCAL_RUBRIC_FEEDBACK} Backend hidden test execution result: ${input.hiddenTestExecutionResult ?? `correctness ${hiddenExecutionScore}/100`}.`
      : testRun
      ? testRun.ok
        ? `${LOCAL_RUBRIC_FEEDBACK} Code execution passed ${testRun.passed}/${testRun.total} visible test cases.`
        : `${LOCAL_RUBRIC_FEEDBACK} Code execution failed: ${testRun.error}`
      : `${LOCAL_RUBRIC_FEEDBACK} Correctness is estimated from code presence, basic structure, explanation, and concept signals.`;
  } else {
    const relevance = clampNumber(Math.max(baselineMeaning, questionRelevance * 0.45 + semanticSimilarity * 0.3 + conceptCoverage * 0.25), 0, 100, baselineMeaning);
    technicalAccuracy = clampNumber(Math.max(technicalAccuracy, relevance >= 70 ? 65 : technicalAccuracy), 0, 100, technicalAccuracy);
    const completeness = clampNumber(conceptCoverage * 0.7 + detailScore * 0.3, 0, 100, conceptCoverage);
    const structureOrganization = /\b(first|second|because|therefore|for example|however|then|whereas|while|on the other hand)\b/i.test(answer)
      ? Math.max(65, communicationScore)
      : Math.max(55, Math.min(communicationScore, 70));
    const exampleRequired = asksForExample(`${input.question}\n${expectedAnswer}\n${keyConcepts.join("\n")}`);
    const examplesPracticalKnowledge = hasPracticalExample(answer)
      ? Math.max(70, baselineMeaning)
      : exampleRequired
        ? 40
        : Math.max(55, Math.min(70, baselineMeaning));
    factorScores = {
      relevance,
      technicalAccuracy,
      completeness,
      communicationClarity: communicationScore,
      structureOrganization,
      examplesPracticalKnowledge,
      confidenceFluency: Math.max(55, communicationScore),
    };
  }

  const rawScore100 = input.questionType === "coding"
    ? calculateCodingScore(factorScores as CodingFactorScores)
    : calculateTheoryScore(factorScores as TheoryFactorScores);
  const localScoreCap = input.questionType === "coding" && input.hiddenCorrectnessScore !== null && input.hiddenCorrectnessScore !== undefined ? 88 : 78;
  const score100 = Math.min(rawScore100, localScoreCap);
  const followUpText = String(input.followUpAnswer ?? "").trim();
  const followUpScore = input.followUpQuestion
    ? clampNumber(followUpText.length < 8 ? 20 : followUpText.length < 50 ? 55 : followUpText.length < 140 ? 70 : 80, 0, 100, 0)
    : null;
  const combinedScore = Math.min(followUpScore === null ? score100 : Math.round(score100 * 0.7 + followUpScore * 0.3), localScoreCap);
  const score = clampNumber(Math.round(combinedScore / 10), 0, 10, 0);

  return {
    questionId: input.questionId,
    answerId: input.answerId,
    questionType: input.questionType,
    score,
    score100: combinedScore,
    aiScore: combinedScore,
    finalScore: combinedScore,
    mainAnswerScore: score100,
    followUpScore,
    rating: getRating(combinedScore),
    factorScores,
    feedback,
    strengths: matchedConcepts.length ? `Covered: ${matchedConcepts.join(", ")}` : "",
    weaknesses: missingConcepts.length ? `Missing: ${missingConcepts.join(", ")}` : "",
    suggestions: missingConcepts.length
      ? `Improve by addressing: ${missingConcepts.slice(0, 4).join(", ")}.`
      : "Add concrete examples, tradeoffs, and edge cases where relevant.",
    matchedConcepts,
    missingConcepts,
    communicationScore,
    conceptCoverage,
    technicalAccuracy,
    semanticSimilarity,
    correctnessLocked: input.questionType === "coding" && input.hiddenCorrectnessScore !== null && input.hiddenCorrectnessScore !== undefined,
  };
}

function buildFeedbackFromRubricEvidence(input: {
  score100: number;
  rating: Rating;
  strengths?: string;
  weaknesses?: string;
  suggestions?: string;
  fallbackFeedback?: string;
}) {
  const strengths = clip(input.strengths, 600);
  const weaknesses = clip(input.weaknesses, 600);
  const suggestions = clip(input.suggestions, 600);
  const parts = [
    `Backend rubric score: ${input.score100}/100 (${input.rating}).`,
    strengths ? `Strengths: ${strengths}` : "",
    weaknesses ? `Weaknesses: ${weaknesses}` : "",
    suggestions ? `Suggestions: ${suggestions}` : "",
  ].filter(Boolean);
  return parts.length > 1 ? parts.join("\n") : clip(input.fallbackFeedback ?? parts[0] ?? "", 2000);
}

function coerceBatchAnswerEvaluation(
  raw: Record<string, unknown>,
  fallback: InterviewBatchAnswerEvaluation
): InterviewBatchAnswerEvaluation {
  const allowedConcepts = fallback.missingConcepts;
  const allowedByKey = new Map(allowedConcepts.map((concept) => [concept.toLowerCase(), concept]));
  const rawMatchedConcepts = normalizeConceptList(raw.matchedConcepts ?? raw.matched_concepts);
  const rawMissingConcepts = normalizeConceptList(raw.missingConcepts ?? raw.missing_concepts);
  const matchedConcepts = rawMatchedConcepts.map((concept) => allowedByKey.get(concept.toLowerCase())).filter((concept): concept is string => Boolean(concept));
  const missingConcepts = rawMissingConcepts.map((concept) => allowedByKey.get(concept.toLowerCase())).filter((concept): concept is string => Boolean(concept));
  const questionType = fallback.questionType;
  const rawFactorScores = raw.factorScores ?? raw.factor_scores ?? raw.rubricScores ?? raw.rubric_scores;
  const factorScores = questionType === "coding"
    ? normalizeCodingFactorScores(rawFactorScores, fallback.factorScores as CodingFactorScores)
    : normalizeTheoryFactorScores(rawFactorScores, fallback.factorScores as TheoryFactorScores);
  if (questionType === "coding" && fallback.correctnessLocked) {
    (factorScores as CodingFactorScores).correctness = (fallback.factorScores as CodingFactorScores).correctness;
  } else if (
    questionType === "coding" &&
    !fallback.correctnessLocked &&
    (fallback.factorScores as CodingFactorScores).correctness > 0 &&
    (factorScores as CodingFactorScores).correctness === 0
  ) {
    (factorScores as CodingFactorScores).correctness = (fallback.factorScores as CodingFactorScores).correctness;
  }
  const factorScore100 = questionType === "coding"
    ? calculateCodingScore(factorScores as CodingFactorScores)
    : calculateTheoryScore(factorScores as TheoryFactorScores);
  const explicitScore = raw.mainAnswerScore ?? raw.main_answer_score ?? raw.finalScore ?? raw.final_score ?? raw.score100 ?? raw.score_100 ?? raw.aiScore ?? raw.ai_score ?? raw.score;
  const normalizedExplicitScore = raw.score === explicitScore && Number(explicitScore) <= 10
    ? Number(explicitScore) * 10
    : explicitScore;
  const aiScore = clampNumber(raw.aiScore ?? raw.ai_score ?? normalizedExplicitScore, 0, 100, factorScore100);
  const mainAnswerScore = clampNumber(raw.mainAnswerScore ?? raw.main_answer_score ?? normalizedExplicitScore, 0, 100, aiScore);
  const followUpScore = fallback.followUpScore === null || raw.followUpScore === null || raw.follow_up_score === null
    ? null
    : clampNumber(raw.followUpScore ?? raw.follow_up_score, 0, 100, fallback.followUpScore ?? 0);
  const finalScore = followUpScore === null
    ? mainAnswerScore
    : Math.round(mainAnswerScore * 0.7 + followUpScore * 0.3);
  const score100 = finalScore;
  const score = clampNumber(Math.round(score100 / 10), 0, 10, fallback.score);
  const rating = getRating(score100);
  const strengths = clip(raw.strengths ?? fallback.strengths, 1200);
  const weaknesses = clip(raw.weaknesses ?? fallback.weaknesses, 1200);
  const suggestions = clip(raw.improvementSuggestion ?? raw.improvement_suggestion ?? raw.suggestions ?? fallback.suggestions, 1200);
  const technicalFeedback = clip(raw.technicalFeedback ?? raw.technical_feedback ?? "", 700);
  const communicationFeedback = clip(raw.communicationFeedback ?? raw.communication_feedback ?? "", 700);
  const feedback = [technicalFeedback, communicationFeedback, suggestions]
    .filter((part) => String(part ?? "").trim())
    .join("\n");

  return {
    questionId: fallback.questionId,
    answerId: fallback.answerId,
    questionType,
    score,
    score100,
    aiScore,
    finalScore,
    mainAnswerScore,
    followUpScore,
    rating,
    factorScores,
    feedback: feedback || buildFeedbackFromRubricEvidence({
      score100,
      rating,
      strengths,
      weaknesses,
      suggestions,
      fallbackFeedback: fallback.feedback,
    }),
    strengths,
    weaknesses,
    suggestions,
    matchedConcepts,
    missingConcepts,
    communicationScore: clampNumber(
      raw.communicationScore ?? raw.communication_score,
      0,
      100,
      questionType === "coding"
        ? (factorScores as CodingFactorScores).explanationCommunication
        : (factorScores as TheoryFactorScores).communicationClarity
    ),
    conceptCoverage: clampNumber(
      raw.conceptCoverage ?? raw.concept_coverage,
      0,
      100,
      questionType === "coding"
        ? (factorScores as CodingFactorScores).logicProblemSolving
        : (factorScores as TheoryFactorScores).completeness
    ),
    technicalAccuracy: clampNumber(
      raw.technicalAccuracy ?? raw.technical_accuracy,
      0,
      100,
      questionType === "coding"
        ? (factorScores as CodingFactorScores).correctness
        : (factorScores as TheoryFactorScores).technicalAccuracy
    ),
    semanticSimilarity: clampNumber(raw.semanticSimilarity ?? raw.semantic_similarity, 0, 100, fallback.semanticSimilarity),
    correctnessLocked: fallback.correctnessLocked,
  };
}

function buildBatchSummary(evaluations: InterviewBatchAnswerEvaluation[]) {
  if (!evaluations.length) return "No answers recorded.";
  const overall = Math.round(evaluations.reduce((sum, item) => sum + item.finalScore, 0) / evaluations.length);
  const strongest = evaluations.flatMap((item) => item.matchedConcepts).slice(0, 5).join(", ");
  const missing = evaluations.flatMap((item) => item.missingConcepts).slice(0, 5).join(", ");
  return [
    `Overall score: ${overall}/100`,
    `Strengths: ${strongest || "Needs more evidence across answers."}`,
    `Weaknesses: ${missing || "No major missing concepts identified."}`,
    "Next steps: Review weaker answers, add concrete examples, and explain tradeoffs clearly.",
  ].join("\n");
}

function describeCodingTestExecution(input: InterviewBatchAnswerInput) {
  if (input.questionType !== "coding") return "not applicable";
  const testCases = Array.isArray(input.testCases) ? input.testCases : [];
  const code = String(input.code ?? input.userAnswer ?? "").trim();
  if (!testCases.length) return "no stored test cases available";
  if (!code) return "no code submitted";
  const run = runCodingTestCases({ code, testCases });
  if (!run.ok) return `failed to execute: ${run.error}`;
  return `passed ${run.passed}/${run.total} test cases`;
}

async function repairEvaluationJsonWithGemini(params: {
  previousResponse: string;
  expectedCount: number;
  interviewId?: number | null;
}) {
  const repairPrompt = [
    "Convert the previous response into valid JSON only. Do not add or remove evaluation items.",
    "Do not include markdown.",
    "Do not include explanations outside JSON.",
    "Do not include extra text in any language.",
    "Do not include trailing comments.",
    "Return exactly one JSON object with an evaluations array.",
    `The evaluations array must contain exactly ${params.expectedCount} item(s).`,
    "Previous response:",
    clip(params.previousResponse, 12000),
  ].join("\n");

  const repaired = await openRouterChat(repairPrompt, {
    timeoutMs: 30000,
    maxTokens: 4000,
    model: "google/gemini-2.5-flash",
    temperature: 0,
    responseFormat: { type: "json_object" },
  });
  if (!repaired.ok) {
    logOpenRouterFailure("evaluateInterviewBatch Gemini JSON repair", repaired.error);
    return null;
  }
  console.info("[interview-evaluation] Gemini repair response", {
    interviewId: params.interviewId ?? null,
    responseSnippet: clip(repaired.text, 4000),
  });
  return repaired.text;
}

export async function evaluateInterviewBatch(input: {
  role: string;
  experience: string;
  techStack: unknown;
  answers: InterviewBatchAnswerInput[];
  personality?: InterviewerPersonality;
  interviewId?: number;
}): Promise<InterviewBatchEvaluationResult> {
  const fallbacks = new Map<number, InterviewBatchAnswerEvaluation>();
  for (const answer of input.answers) {
    fallbacks.set(answer.answerId, buildFallbackAnswerEvaluation(answer));
  }
  const evaluableAnswers = input.answers.filter((answer) => !isEmptyInterviewAnswer(answer.userAnswer));
  const evaluableIndexByAnswerId = new Map(evaluableAnswers.map((answer, index) => [answer.answerId, index]));

  if (!input.answers.length) {
    return { evaluations: [], summary: "No answers recorded.", evaluationAvailable: true };
  }
  if (!evaluableAnswers.length) {
    const evaluations = input.answers.map((answer) => fallbacks.get(answer.answerId)!);
    return { evaluations, summary: buildBatchSummary(evaluations), evaluationAvailable: true };
  }

  const prompt = [
    "You are a senior technical interviewer.",
    "You are also a strict JSON generator for a backend parser.",
    "Evaluate consistently using the question, rubric, transcript/user answer, NLP metrics, and test execution evidence.",
    "Evaluate every answer only against its own exact question, expected answer, and expected concepts.",
    "Never reuse feedback, missing concepts, or improvement suggestions across questions. Make each suggestion specific and useful for that question.",
    "Missing concepts must be selected only from that question's requiredConcepts.",
    "Empty answers are excluded by the backend and must never receive marks.",
    `Role: ${clip(input.role, 80)}`,
    `Experience: ${clip(input.experience, 140)}`,
    `Tech stack (JSON): ${clip(JSON.stringify(input.techStack ?? []), 500)}`,
    `Interviewer personality for feedback tone: ${input.personality ?? "Senior Engineering Manager"}. Be professional and constructive.`,
    "Theory rubric:",
    "- relevance: 25%",
    "- technicalAccuracy: 30%",
    "- completeness: 20%",
    "- communicationClarity: 10%",
    "- structureOrganization: 5%",
    "- examplesPracticalKnowledge: 5%",
    "- confidenceFluency: 5%",
    "Coding rubric:",
    "- correctness: 40%",
    "- logicProblemSolving: 20%",
    "- timeComplexity: 10%",
    "- spaceComplexity: 5%",
    "- codeQuality: 10%",
    "- edgeCaseHandling: 10%",
    "- explanationCommunication: 5%",
    "For coding answers with backendHiddenCorrectnessScore, correctness is already calculated by the backend from hidden test cases.",
    "When backendHiddenCorrectnessScore is provided, set factorScores.correctness exactly to that value.",
    "When backendHiddenCorrectnessScore is provided, evaluate only logicProblemSolving, timeComplexity, spaceComplexity, codeQuality, edgeCaseHandling, and explanationCommunication from the code/explanation.",
    "Do not let AI judgement raise or lower correctness when backend hidden test results exist.",
    "Judge each answer using this priority order:",
    "1) The exact question asked.",
    "2) The expectedAnswer/rubric.",
    "3) The meaning of the user answer, including synonyms, paraphrases, and correct explanations.",
    "4) keyConcepts/requiredConcepts only as supporting evidence.",
    "Do not score mainly from keyword matching, matchedConcepts, missingConcepts, or semantic similarity.",
    "Do not mark a concept missing only because the exact word is absent. Accept synonyms, paraphrases, and correct explanations.",
    "Award marks for correct meaning even if wording differs from expectedAnswer.",
    "keyConcepts, matchedConcepts, and missingConcepts are supporting evidence only; they must not control the full score.",
    "If an answer answers only half the question, reduce completeness and examples/practical knowledge more than technicalAccuracy.",
    "If an answer is correct but missing examples, do not give a very low score; examples are only 5% for theory.",
    "If an answer is relevant and technically correct but incomplete, score should usually be 60-75.",
    "If an answer is relevant and correct but incomplete, give a medium score.",
    "If an answer is unrelated, give low relevance and a low final score.",
    "If an answer is short but technically correct, do not give extremely low marks.",
    "For coding, prioritize backendHiddenTestExecutionResult when available. If it is available, do not independently judge correctness.",
    "When no test execution result exists, evaluate submitted code or SQL statically for correctness, logic, edge cases, code quality, and any explanation. Do not require Judge0 or executed tests.",
    "If automated test execution is not enabled and code was submitted, do not report 0% correctness. Estimate correctness from the submitted approach and explain that it is rubric-based.",
    "Each factorScores value must be a number from 0 to 100.",
    "Use NLP metrics as communication evidence, not as the only scoring basis.",
    "aiScore is your answer-quality score before NLP adjustment. finalScore may adjust aiScore using NLP clarity/fluency evidence.",
    "Keep feedback concise.",
    "Calibration example:",
    "Question: Difference between supervised and unsupervised learning with examples.",
    "User answer: Supervised uses labeled data. Unsupervised uses unlabeled data.",
    "Expected evaluation: relevance high; technicalAccuracy high; completeness medium because examples are missing; examplesPracticalKnowledge low.",
    "For that calibration, finalScore should usually be around 65-75.",
    "Return ONLY valid JSON.",
    "Do not include markdown.",
    "Do not include explanations outside JSON.",
    "Do not include extra text in any language.",
    "Do not include trailing comments.",
    "Do not include text before, between, or after JSON array items.",
    "Return exactly one JSON object with an evaluations array.",
    "Use exactly this JSON object shape:",
    `{"evaluations":[{"answerId":0,"factorScores":{"relevance":0,"technicalAccuracy":0,"completeness":0,"communicationClarity":0,"structureOrganization":0,"examplesPracticalKnowledge":0,"confidenceFluency":0},"mainAnswerScore":0,"followUpScore":null,"technicalFeedback":"","communicationFeedback":"","missingConcepts":[],"improvementSuggestion":"","matchedConcepts":[]}]}`,
    "Score the main answer and follow-up answer separately. If a follow-up exists, final scoring is computed by the backend as 70% mainAnswerScore + 30% followUpScore.",
    `For coding evaluations, factorScores must be {"correctness":0,"logicProblemSolving":0,"timeComplexity":0,"spaceComplexity":0,"codeQuality":0,"edgeCaseHandling":0,"explanationCommunication":0}.`,
    "Return exactly one evaluation for each Q&A pair, in the same order as the Q&A pairs.",
    `Q&A pairs:\n${evaluableAnswers
      .map((item, index) =>
        {
          const code = String(item.code ?? (item.questionType === "coding" ? item.userAnswer : "") ?? "");
          const explanation = String(item.explanation ?? (item.questionType === "coding" ? "" : item.userAnswer) ?? "");
          const nlp = item.nlpAnalysis;
          const nlpLine = nlp
            ? JSON.stringify({
                nlpScore: nlp.nlpScore,
                missingConcepts: nlp.missingConcepts,
                fillerWordsCount: nlp.fillerWordsCount,
                fluencyScore: nlp.fluencyScore,
                clarityScore: nlp.clarityScore,
              })
            : "not available";
          return (
        [
          `${index + 1}. answerId: ${item.answerId}`,
          `questionId: ${item.questionId}`,
          `type: ${item.questionType}`,
          `difficulty: ${item.difficulty}`,
          `question: ${clip(item.question, 500)}`,
          `expectedAnswer: ${clip(item.expectedAnswer ?? "", 800)}`,
          `requiredConcepts: ${JSON.stringify(normalizeConceptList(item.keyConcepts))}`,
          `backendHiddenCorrectnessScore: ${item.hiddenCorrectnessScore ?? "not available"}`,
          `backendHiddenTestExecutionResult: ${item.hiddenTestExecutionResult ?? "not available"}`,
          `expectedTimeComplexity: ${clip(item.expectedTimeComplexity ?? "", 120)}`,
          `expectedSpaceComplexity: ${clip(item.expectedSpaceComplexity ?? "", 120)}`,
          `nlpAnalysis: ${clip(nlpLine, 700)}`,
          `visibleTestExecutionResult: ${describeCodingTestExecution(item)}`,
          `userTranscriptOrAnswer: ${clip(item.userAnswer, item.questionType === "coding" ? 2000 : 1200)}`,
          `followUpQuestion: ${clip(item.followUpQuestion ?? "not asked", 500)}`,
          `followUpAnswer: ${clip(item.followUpAnswer ?? "not answered", 900)}`,
          `submittedCode: ${clip(code, 2200)}`,
          `candidateExplanation: ${clip(explanation, 1000)}`,
        ].join("\n")
          );
        }
      )
      .join("\n\n")}`,
  ].join("\n");

  const evaluationModels = [
    { model: "google/gemini-2.5-flash", waitBeforeMs: 0 },
    { model: "mistralai/mistral-small-24b-instruct-2501", waitBeforeMs: 2000 },
    { model: "meta-llama/llama-3.3-70b-instruct:free", waitBeforeMs: 5000 },
  ];
  let failureReason = "Evaluation attempts exhausted.";

  for (const [modelIndex, config] of evaluationModels.entries()) {
    if (config.waitBeforeMs > 0) await wait(config.waitBeforeMs);

    const response = await openRouterChat(prompt, {
      timeoutMs: 60000,
      maxTokens: 4000,
      model: config.model,
      ...(config.model === "google/gemini-2.5-flash"
        ? { temperature: 0, responseFormat: { type: "json_object" as const } }
        : {}),
    });
    if (!response.ok) {
      logOpenRouterFailure(`evaluateInterviewBatch model ${config.model}`, response.error);
      failureReason = response.error.message;
      console.warn("[interview-evaluation] model failed", {
        interviewId: input.interviewId ?? null,
        model: config.model,
        reason: failureReason,
      });
      if (modelIndex === 0 && !isEvaluationFallbackError(response.error)) break;
      if (modelIndex < evaluationModels.length - 1) continue;
      break;
    }

    console.info("[interview-evaluation] raw AI response", {
      interviewId: input.interviewId ?? null,
      answerCount: input.answers.length,
      model: config.model,
      responseSnippet: clip(response.text, 4000),
    });

    let responseText = response.text;
    let parsed = parseAiEvaluationJson(responseText);
    if (!Array.isArray(parsed.rawEvaluations) && config.model === "google/gemini-2.5-flash") {
      const repairedText = await repairEvaluationJsonWithGemini({
        previousResponse: response.text,
        expectedCount: evaluableAnswers.length,
        interviewId: input.interviewId ?? null,
      });
      if (repairedText) {
        responseText = repairedText;
        parsed = parseAiEvaluationJson(responseText);
      }
    }
    const rawEvaluations = parsed.rawEvaluations;
    if (!Array.isArray(rawEvaluations)) {
      failureReason = parsed.error ?? "AI response did not contain valid evaluation JSON.";
      console.error("[interview-evaluation] JSON parse error", {
        interviewId: input.interviewId ?? null,
        model: config.model,
        error: failureReason,
        responseSnippet: clip(responseText, 4000),
      });
      console.warn("[interview-evaluation] model failed", {
        interviewId: input.interviewId ?? null,
        model: config.model,
        reason: failureReason,
      });
      continue;
    }

    const rawByAnswerId = new Map<number, Record<string, unknown>>();
    const rawByIndex: Array<Record<string, unknown> | undefined> = [];
    const validationErrors: string[] = [];
    for (const [index, raw] of rawEvaluations.entries()) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        validationErrors.push(`Evaluation item ${index + 1} is not an object.`);
        continue;
      }
      const record = raw as Record<string, unknown>;
      if (!hasNumericEvaluationScore(record)) validationErrors.push(`Evaluation item ${index + 1} is missing a numeric score.`);
      if (!hasEvaluationFactors(record)) validationErrors.push(`Evaluation item ${index + 1} is missing factorScores.`);
      if (!hasNumericEvaluationScore(record) || !hasEvaluationFactors(record)) continue;
      rawByIndex[index] = record;
      const answerId = Number((raw as any).answerId ?? (raw as any).answer_id);
      if (!Number.isFinite(answerId)) continue;
      rawByAnswerId.set(answerId, record);
    }

    if (validationErrors.length) {
      failureReason = validationErrors[0];
      console.error("[interview-evaluation] validation error", {
        interviewId: input.interviewId ?? null,
        model: config.model,
        errors: validationErrors.slice(0, 10),
        receivedCount: rawEvaluations.length,
      });
      console.warn("[interview-evaluation] model failed", {
        interviewId: input.interviewId ?? null,
        model: config.model,
        reason: failureReason,
      });
      continue;
    }

    const evaluations = input.answers.flatMap((answer) => {
      const fallback = fallbacks.get(answer.answerId) ?? buildFallbackAnswerEvaluation(answer);
      if (isEmptyInterviewAnswer(answer.userAnswer)) return [fallback];
      const raw = rawByAnswerId.get(answer.answerId) ?? rawByIndex[evaluableIndexByAnswerId.get(answer.answerId) ?? -1];
      return raw ? [coerceBatchAnswerEvaluation(raw, fallback)] : [];
    });
    const summary = buildBatchSummary(evaluations);

    const evaluationAvailable = evaluableAnswers.every((answer) => rawByAnswerId.has(answer.answerId) || rawByIndex[evaluableIndexByAnswerId.get(answer.answerId) ?? -1]);
    if (!evaluationAvailable) {
      const message = "AI response omitted one or more answer evaluations.";
      failureReason = message;
      console.error("[interview-evaluation] validation error", {
        interviewId: input.interviewId ?? null,
        model: config.model,
        error: message,
        expectedAnswerIds: evaluableAnswers.map((answer) => answer.answerId),
        receivedAnswerIds: Array.from(rawByAnswerId.keys()),
        receivedCount: rawEvaluations.length,
      });
      console.warn("[interview-evaluation] model failed", {
        interviewId: input.interviewId ?? null,
        model: config.model,
        reason: failureReason,
      });
      continue;
    }
    console.info("[interview-evaluation] model succeeded", {
      interviewId: input.interviewId ?? null,
      model: config.model,
      source: modelIndex === 0 ? "Gemini" : "fallback AI model",
      answerCount: evaluations.length,
    });
    return { evaluations, summary, evaluationAvailable, source: modelIndex === 0 ? "Gemini" : "fallback AI model" };
  }

  const localEvaluations = input.answers.map((answer) => fallbacks.get(answer.answerId) ?? buildFallbackAnswerEvaluation(answer));
  console.warn("[interview-evaluation] local rubric fallback used", {
    interviewId: input.interviewId ?? null,
    reason: failureReason,
    answerCount: localEvaluations.length,
  });
  return {
    evaluations: localEvaluations,
    summary: buildBatchSummary(localEvaluations),
    evaluationAvailable: true,
    failureReason,
    source: "local rubric fallback",
  };
}

export async function evaluateInterviewAnswer(input: {
  question: string;
  expectedAnswer?: string;
  keyConcepts?: string[];
  userAnswer: string;
  difficulty: Difficulty;
  type: QuestionType;
  testCases?: CodingTestCase[];
}) {
  const result = await evaluateInterviewBatch({
    role: "",
    experience: "",
    techStack: [],
    answers: [
      {
        answerId: 0,
        questionId: 0,
        question: input.question,
        expectedAnswer: input.expectedAnswer,
        keyConcepts: input.keyConcepts,
        userAnswer: input.userAnswer,
        code: input.type === "coding" ? input.userAnswer : null,
        explanation: input.type === "coding" ? "" : input.userAnswer,
        difficulty: input.difficulty,
        questionType: input.type,
        testCases: input.testCases,
      },
    ],
  });

  return result.evaluations[0] ?? buildFallbackAnswerEvaluation({
    answerId: 0,
    questionId: 0,
    question: input.question,
    expectedAnswer: input.expectedAnswer,
    keyConcepts: input.keyConcepts,
    userAnswer: input.userAnswer,
    code: input.type === "coding" ? input.userAnswer : null,
    explanation: input.type === "coding" ? "" : input.userAnswer,
    difficulty: input.difficulty,
    questionType: input.type,
    testCases: input.testCases,
  });
}

export async function summarizeInterview(input: {
  role: string;
  experience: string;
  techStack: unknown;
  overallScore: number;
  qas: Array<{ question: string; answer: string; score?: number; feedback?: string }>;
}) {
  const prompt = [
    "You are an interview summarizer.",
    `Role: ${clip(input.role, 80)}`,
    `Experience: ${clip(input.experience, 140)}`,
    `Tech stack (JSON): ${clip(JSON.stringify(input.techStack ?? []), 400)}`,
    `Overall score (0-100): ${Math.max(0, Math.min(100, Math.round(input.overallScore)))}`,
    "Create a short, actionable summary with strengths, weaknesses, and 3 next-step recommendations.",
    "Use plain text (no markdown).",
    `Transcript:\n${input.qas
      .slice(0, 12)
      .map((qa, i) => `${i + 1}. Q: ${clip(qa.question, 300)}\n   A: ${clip(qa.answer, 300)}\n   Score: ${qa.score ?? "n/a"}\n   Feedback: ${clip(qa.feedback ?? "n/a", 220)}`)
      .join("\n")}`,
  ].join("\n");

  const r = await openRouterChat(prompt, { timeoutMs: 25000, maxTokens: 200 });
  if (r.ok) return r.text;

  logOpenRouterFailure("summarizeInterview", r.error);
  return [
    `Overall score: ${Math.max(0, Math.min(100, Math.round(input.overallScore)))}/100`,
    "Strengths: (not enough data)",
    "Weaknesses: (not enough data)",
    "Next steps:",
    "1) Answer with a clear structure (problem -> approach -> tradeoffs -> result).",
    "2) Add specific examples, edge cases, and metrics/impact where possible.",
    "3) Practice concise explanations and confirm requirements before diving in.",
  ].join("\n");
}
