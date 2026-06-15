import vm from "node:vm";
import { isDeepStrictEqual } from "node:util";
import { env } from "../config/env";

type Difficulty = "easy" | "medium" | "hard";
type QuestionType = "theory" | "coding";

type OpenRouterErrorKind = "missing_api_key" | "rate_limited" | "invalid_api_key" | "http" | "timeout" | "network" | "unknown" | "empty";

function clip(text: unknown, maxChars: number) {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}...`;
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = raw.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
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

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
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

async function openRouterChat(prompt: string, opts?: { timeoutMs?: number; maxTokens?: number }) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: { kind: "missing_api_key" as const, message: "Missing OPENROUTER_API_KEY" } };
  }

  const timeoutMs = Math.max(1000, Math.floor(opts?.timeoutMs ?? 15000));
  const maxTokens = Math.max(1, Math.min(200, Math.floor(opts?.maxTokens ?? 200)));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-small-24b-instruct-2501",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
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

function parseStructuredEvaluation(text: string): {
  score: number;
  conceptCoverage?: number;
  matchedConcepts: string[];
  missingConcepts: string[];
  strengths: string;
  weaknesses: string;
  feedback: string;
} | null {
  const obj = extractJsonObject(text);
  if (obj && typeof obj === "object") {
    const score = Number((obj as any).score);
    if (Number.isFinite(score)) {
      return {
        score: clampNumber(score, 0, 100, 50),
        conceptCoverage: Number.isFinite(Number((obj as any).conceptCoverage))
          ? clampNumber((obj as any).conceptCoverage, 0, 100, 0)
          : undefined,
        matchedConcepts: normalizeConceptList((obj as any).matchedConcepts),
        missingConcepts: normalizeConceptList((obj as any).missingConcepts),
        strengths: String((obj as any).strengths ?? "").trim(),
        weaknesses: String((obj as any).weaknesses ?? "").trim(),
        feedback: String((obj as any).feedback ?? "").trim(),
      };
    }
  }
  return null;
}

function parseTheoryEvaluation(text: string): { score100: number; feedback: string; suggestions: string } | null {
  const scoreMatch =
    text.match(/score\s*[:\-]?\s*(\d{1,3})/i) ||
    text.match(/\b(\d{1,3})\s*\/\s*100\b/i) ||
    text.match(/\b(\d{1,3})\b/);
  const score100 = scoreMatch ? Math.max(0, Math.min(100, Math.round(Number(scoreMatch[1])))) : 50;

  const lower = text.toLowerCase();
  const sugIdx = lower.indexOf("suggest");
  if (sugIdx !== -1) {
    const feedback = text.slice(0, sugIdx).trim();
    const suggestions = text.slice(sugIdx).trim();
    return { score100, feedback: feedback || clip(text, 1200), suggestions };
  }

  return { score100, feedback: clip(text, 1400), suggestions: "" };
}

function parseCodingFeedback(text: string): { feedback: string; suggestions: string } {
  const obj = extractJsonObject(text);
  if (obj && typeof obj === "object") {
    const feedback = String((obj as any).feedback ?? (obj as any).codeQuality ?? "").trim();
    const suggestions = String((obj as any).suggestions ?? (obj as any).optimizations ?? "").trim();
    if (feedback || suggestions) return { feedback, suggestions };
  }

  const m = text.match(/1\.\s*([\s\S]*?)\n\s*2\.\s*([\s\S]*?)\n\s*3\.\s*([\s\S]*)/);
  if (m) {
    const feedback = `${m[1].trim()}\n\nLogical issues:\n${m[3].trim()}`.trim();
    const suggestions = m[2].trim();
    return { feedback, suggestions };
  }

  const lower = text.toLowerCase();
  const optIdx = lower.indexOf("optimization");
  if (optIdx !== -1) {
    return { feedback: text.slice(0, optIdx).trim(), suggestions: text.slice(optIdx).trim() };
  }

  return { feedback: text.trim(), suggestions: "" };
}

type CodingTestCase = {
  input: unknown;
  expectedOutput?: unknown;
  expected?: unknown;
  output?: unknown;
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

function runCodingTestCases(params: { code: string; testCases: CodingTestCase[] }) {
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

  try {
    const script = new vm.Script(String(params.code ?? ""), { filename: "user_code.js" });
    script.runInContext(context, { timeout: 800 });
  } catch (e: any) {
    return {
      ok: false as const,
      passed: 0,
      total: params.testCases.length,
      error: `Code execution failed: ${String(e?.message ?? e)}`,
    };
  }

  const fn = findSolutionFunction(sandbox);
  if (!fn) {
    return {
      ok: false as const,
      passed: 0,
      total: params.testCases.length,
      error: "Could not find a callable solution function. Export a function via module.exports, or define global solution(input)/solve(input).",
    };
  }

  sandbox.__fn = fn;
  const callScript = new vm.Script("__result = __fn(__input)");

  let passed = 0;
  for (const tc of params.testCases) {
    try {
      sandbox.__input = tc.input;
      sandbox.__result = undefined;
      callScript.runInContext(context, { timeout: 500 });
      const got = sandbox.__result;
      if (got && typeof (got as any).then === "function") {
        continue; // async not supported in this lightweight runner
      }
      const expected = coerceExpected(tc);
      const ok = isDeepStrictEqual(normalizeForCompare(got), normalizeForCompare(expected));
      if (ok) passed++;
    } catch {
      // treat as failed test case
    }
  }

  return { ok: true as const, passed, total: params.testCases.length };
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
    `{"question":"","expectedAnswer":"","keyConcepts":[],"difficulty":"${input.difficulty}","topic":""}`,
    "expectedAnswer must be the answer rubric, not too long.",
    "keyConcepts must contain 4-8 required concepts.",
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
      const question = String((obj as any).question ?? "").trim();
      const expectedAnswer = String((obj as any).expectedAnswer ?? (obj as any).expected_answer ?? "").trim();
      const keyConcepts = normalizeConceptList((obj as any).keyConcepts ?? (obj as any).key_concepts);
      const topic = String((obj as any).topic ?? fallbackTopic ?? input.role).trim();
      const difficulty = String((obj as any).difficulty ?? input.difficulty).trim().toLowerCase();
      if (question && expectedAnswer && keyConcepts.length) {
        return {
          question,
          expectedAnswer,
          keyConcepts,
          difficulty: isDifficulty(difficulty) ? difficulty : input.difficulty,
          topic: topic || input.role,
        };
      }
    }
  }

  if (!r.ok) logOpenRouterFailure("generateInterviewQuestion", r.error);
  return {
    question: fallbackQuestion,
    expectedAnswer: `A strong answer should accurately explain the core ${fallbackTopic || input.role} concepts, include practical tradeoffs, and mention production considerations.`,
    keyConcepts: ["Core concept", "Practical use", "Tradeoffs", "Production considerations"],
    difficulty: input.difficulty,
    topic: fallbackTopic || input.role,
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
  const question = clip(input.question, 700);
  const difficulty = input.difficulty;
  const expectedAnswer = clip(input.expectedAnswer ?? "", 1400);
  const keyConcepts = normalizeConceptList(input.keyConcepts);
  const userAnswer = clip(input.userAnswer ?? "", input.type === "coding" ? 5000 : 2000);

  const tooShort = userAnswer.replace(/\s+/g, " ").trim().length < (input.type === "coding" ? 20 : 10);
  if (tooShort) {
    const score100 = 0;
    return {
      score: 0,
      score100,
      technicalAccuracy: 0,
      conceptCoverage: 0,
      communicationScore: 0,
      semanticSimilarity: 0,
      matchedConcepts: [],
      missingConcepts: keyConcepts,
      rating: "Poor" as const,
      feedback: "Answer is too short for evaluation.",
      suggestions: input.type === "coding" ? "Provide runnable code and ensure it exports solution(input) or module.exports = function(input) { ... }." : "Add more detail, structure, and examples.",
    };
  }

  if (input.type === "theory") {
    const prompt = `SYSTEM ROLE:
You are a senior technical interviewer.

Evaluate the candidate answer ONLY using the provided expected answer and required concepts.

Scoring Rules:
100: All concepts present and technically correct.
80-99: Most concepts present with minor omissions.
60-79: Partial understanding.
40-59: Basic understanding but major concepts missing.
0-39: Incorrect or unrelated answer.

Question: ${question}
Difficulty: ${difficulty}
Expected Answer: ${expectedAnswer || "No expected answer was stored for this legacy question."}
Required Concepts: ${JSON.stringify(keyConcepts)}
Candidate Answer: ${userAnswer}

Return STRICT JSON:
{
  "score": 0,
  "conceptCoverage": 0,
  "matchedConcepts": [],
  "missingConcepts": [],
  "strengths": "",
  "weaknesses": "",
  "feedback": ""
}`;

    const r = await openRouterChat(prompt, { timeoutMs: 20000, maxTokens: 500 });
    if (!r.ok) {
      logOpenRouterFailure("evaluateTheory", r.error);
      return {
        score: 5,
        score100: 50,
        technicalAccuracy: 50,
        conceptCoverage: 0,
        communicationScore: 50,
        semanticSimilarity: Math.round(cosineSimilarity(createLocalEmbedding(userAnswer), createLocalEmbedding(expectedAnswer)) * 100),
        matchedConcepts: [],
        missingConcepts: keyConcepts,
        rating: "Average" as const,
        feedback: "AI evaluation is temporarily unavailable. Your answer was saved.",
        suggestions: "Answer with structure (context -> approach -> tradeoffs -> result) and use concrete examples.",
      };
    }

    const structured = parseStructuredEvaluation(r.text);
    const legacy = structured ? null : parseTheoryEvaluation(r.text);
    const aiScore = structured?.score ?? legacy?.score100 ?? 50;
    const matchedConcepts = structured?.matchedConcepts ?? [];
    const missingConcepts = structured?.missingConcepts?.length
      ? structured.missingConcepts
      : keyConcepts.filter((concept) => !matchedConcepts.some((m) => m.toLowerCase() === concept.toLowerCase()));
    const conceptCoverage = keyConcepts.length
      ? Math.round((matchedConcepts.length / keyConcepts.length) * 100)
      : clampNumber(structured?.conceptCoverage, 0, 100, 0);
    const semanticSimilarity = Math.round(cosineSimilarity(createLocalEmbedding(userAnswer), createLocalEmbedding(expectedAnswer)) * 100);
    const communicationScore = clampNumber(
      userAnswer.length > 400 ? 85 : userAnswer.length > 180 ? 75 : userAnswer.length > 80 ? 60 : 40,
      0,
      100,
      60
    );
    const technicalAccuracy = clampNumber(Math.round(aiScore * 0.85 + semanticSimilarity * 0.15), 0, 100, aiScore);
    const score100 = clampNumber(
      technicalAccuracy * 0.7 + conceptCoverage * 0.2 + communicationScore * 0.1,
      0,
      100,
      aiScore
    );
    const score10 = Math.max(0, Math.min(10, Math.round(score100 / 10)));
    const rating =
      score10 >= 8 ? "Excellent" : score10 >= 6 ? "Good" : score10 >= 4 ? "Average" : "Poor";

    return {
      score: score10,
      score100,
      technicalAccuracy,
      conceptCoverage,
      communicationScore,
      semanticSimilarity,
      matchedConcepts,
      missingConcepts,
      rating,
      feedback: structured?.feedback?.trim() || legacy?.feedback?.trim() || "No feedback provided.",
      suggestions: structured?.weaknesses?.trim() || legacy?.suggestions?.trim() || "",
      strengths: structured?.strengths ?? "",
      weaknesses: structured?.weaknesses ?? "",
    };
  }

  // coding
  const testCases = Array.isArray(input.testCases) ? input.testCases : [];
  let score100 = 50;
  let testSummary: string | null = null;

  if (testCases.length) {
    const run = runCodingTestCases({ code: userAnswer, testCases });
    if (run.ok) {
      score100 = Math.round((run.passed / Math.max(1, run.total)) * 100);
      testSummary = `Passed ${run.passed}/${run.total} test cases.`;
    } else {
      score100 = 0;
      testSummary = run.error;
    }
  } else {
    testSummary = "No test cases provided; score is not based on execution.";
  }

  const prompt = `You are a coding interviewer.

Question: ${question}
User Code: ${clip(userAnswer, 5000)}

Analyze the code and provide:

1. Code quality feedback
2. Optimization suggestions
3. Any logical issues

Do NOT give score.`;

  const r = await openRouterChat(prompt, { timeoutMs: 20000, maxTokens: 200 });
  if (!r.ok) {
    logOpenRouterFailure("evaluateCodingFeedback", r.error);
    const score10 = Math.max(0, Math.min(10, Math.round(score100 / 10)));
    const rating =
      score10 >= 8 ? "Excellent" : score10 >= 6 ? "Good" : score10 >= 4 ? "Average" : "Poor";
    return {
      score: score10,
      score100,
      rating,
      feedback: testSummary ? `AI feedback unavailable. ${testSummary}` : "AI feedback unavailable.",
      suggestions: "Improve readability, handle edge cases, and consider time/space complexity.",
    };
  }

  const score10 = Math.max(0, Math.min(10, Math.round(score100 / 10)));
  const rating =
    score10 >= 8 ? "Excellent" : score10 >= 6 ? "Good" : score10 >= 4 ? "Average" : "Poor";

  const parsed = parseCodingFeedback(r.text);
  const combinedFeedback = testSummary
    ? `${testSummary}\n\n${parsed.feedback || r.text}`
    : (parsed.feedback || r.text);
  return {
    score: score10,
    score100,
    technicalAccuracy: score100,
    conceptCoverage: 0,
    communicationScore: 70,
    semanticSimilarity: Math.round(cosineSimilarity(createLocalEmbedding(userAnswer), createLocalEmbedding(expectedAnswer)) * 100),
    matchedConcepts: [],
    missingConcepts: keyConcepts,
    rating,
    feedback: clip(combinedFeedback, 2000),
    suggestions: clip(parsed.suggestions, 1200),
  };
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
