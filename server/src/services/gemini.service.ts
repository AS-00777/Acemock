import { env } from "../config/env";
import { ApiError } from "../middleware/error.middleware";

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type GeminiFailure = {
  kind: "missing_api_key" | "timeout" | "network" | "http" | "empty" | "unknown";
  message: string;
  status?: number;
  bodySnippet?: string;
};

type GeminiResult = { ok: true; text: string } | { ok: false; error: GeminiFailure };

function extractText(resp: GeminiGenerateResponse): string {
  const text = resp.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text.trim();
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : text;
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

function snippet(s: string, max = 1200) {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}...`;
}

function logGeminiFailure(context: string, error: GeminiFailure) {
  console.error(`[gemini] ${context} failed`, {
    kind: error.kind,
    status: error.status,
    message: error.message,
    bodySnippet: error.bodySnippet,
  });
}

async function geminiGenerateText(
  prompt: string,
  opts?: { timeoutMs?: number }
): Promise<GeminiResult> {
  if (!env.GEMINI_API_KEY) {
    return { ok: false, error: { kind: "missing_api_key", message: "Missing GEMINI_API_KEY" } };
  }

  const model = env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";
  const timeoutMs = Math.max(1000, Math.floor(opts?.timeoutMs ?? 15000));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return {
        ok: false,
        error: {
          kind: "http",
          message: `Gemini HTTP ${r.status}`,
          status: r.status,
          bodySnippet: snippet(body),
        },
      };
    }

    let data: GeminiGenerateResponse;
    try {
      data = (await r.json()) as GeminiGenerateResponse;
    } catch (e: any) {
      return {
        ok: false,
        error: { kind: "unknown", message: `Gemini JSON parse failed: ${String(e?.message ?? e)}` },
      };
    }

    const text = extractText(data);
    if (!text) return { ok: false, error: { kind: "empty", message: "Gemini returned empty response" } };
    return { ok: true, text };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, error: { kind: "timeout", message: `Gemini request timed out after ${timeoutMs}ms` } };
    }
    return { ok: false, error: { kind: "network", message: `Gemini network error: ${String(e?.message ?? e)}` } };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateInterviewQuestion(input: {
  difficulty: "easy" | "medium" | "hard";
  role: string;
  experience: string;
  techStack: unknown;
  questionType: "theory" | "coding";
  previousQuestions: string[];
}): Promise<{ question: string; type: "theory" | "coding" }> {
  const previousBlock =
    input.previousQuestions && input.previousQuestions.length
      ? `Previous questions (do NOT repeat):\n${input.previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n`
      : "";

  const difficultyLabel =
    input.difficulty === "easy" ? "easy" : input.difficulty === "hard" ? "hard" : "medium";

  const prompt = [
    "You are an interview question generator.",
    "Generate exactly ONE interview question.",
    `Difficulty: ${difficultyLabel}`,
    `Question number context: This is one question in a 10-question mock interview.`,
    `Role: ${input.role}`,
    `Experience: ${input.experience}`,
    `Tech stack (JSON): ${JSON.stringify(input.techStack)}`,
    previousBlock,
    input.questionType === "coding"
      ? "Generate a coding interview question. Include: problem statement + clear input/output examples. Do NOT include a solution."
      : "Generate a theory interview question (no coding).",
    "Avoid repeating or closely paraphrasing previous questions.",
    'Return JSON ONLY in this format: {"question":"...","type":"theory"|"coding"}',
  ]
    .filter(Boolean)
    .join("\n");

  const r = await geminiGenerateText(prompt);
  if (r.ok) {
    const parsed = extractJsonObject(r.text);
    if (parsed && typeof parsed === "object") {
      const question = String((parsed as any).question ?? "").trim();
      const typeRaw = String((parsed as any).type ?? "").trim();
      const type = typeRaw === "coding" || typeRaw === "theory" ? (typeRaw as any) : input.questionType;
      if (question) return { question, type };
    }
    console.error("[gemini] generateInterviewQuestion returned invalid JSON", { textSnippet: snippet(r.text, 600) });
  } else {
    logGeminiFailure("generateInterviewQuestion", r.error);
  }

  const tech = Array.isArray(input.techStack) ? input.techStack.join(", ") : "";
  const fallbackQuestion =
    input.questionType === "coding"
      ? tech
        ? `Coding: Write a small function that demonstrates good use of ${tech}. Include 1-2 input/output examples.`
        : "Coding: Write a small function that demonstrates good problem-solving. Include 1-2 input/output examples."
      : tech
        ? `Pick one challenging part of working with ${tech} and explain how you handle it in production.`
        : `Tell me about a challenging project you've delivered as a ${input.role} and what you learned.`;

  return { question: fallbackQuestion, type: input.questionType };
}

export async function evaluateInterviewAnswer(input: {
  role: string;
  experience: string;
  techStack: unknown;
  questionType: "theory" | "coding";
  question: string;
  answer: string;
  code?: string;
  language?: string;
}): Promise<{ score: number; rating: "Poor" | "Average" | "Good" | "Excellent"; feedback: string }> {
  const codeBlock =
    input.code && input.code.trim()
      ? `Code (${input.language ?? "unknown"}):\n${input.code}\n`
      : "";

  const prompt = [
    "You are an interview evaluator.",
    `Role: ${input.role}`,
    `Experience: ${input.experience}`,
    `Tech stack (JSON): ${JSON.stringify(input.techStack)}`,
    `Question type: ${input.questionType}`,
    `Question: ${input.question}`,
    codeBlock ? codeBlock.trimEnd() : null,
    `Answer: ${input.answer}`,
    "Return a JSON object ONLY with keys:",
    "- score (integer 0-10)",
    "- rating (one of: Poor, Average, Good, Excellent)",
    "- feedback (string; include strengths + improvements; be specific and actionable)",
  ]
    .filter(Boolean)
    .join("\n");

  const r = await geminiGenerateText(prompt, { timeoutMs: 20000 });
  if (!r.ok) {
    logGeminiFailure("evaluateInterviewAnswer", r.error);
    return {
      score: 5,
      rating: "Average",
      feedback:
        "AI evaluation is temporarily unavailable. Your answer was saved. Focus on structure (context -> approach -> tradeoffs -> result) and provide concrete examples.",
    };
  }

  const parsed = extractJsonObject(r.text);
  if (!parsed || typeof parsed !== "object") {
    console.error("[gemini] evaluateInterviewAnswer returned non-JSON", { textSnippet: snippet(r.text, 600) });
    return {
      score: 5,
      rating: "Average",
      feedback:
        "AI evaluation returned an unexpected format. Your answer was saved; consider adding more specifics, edge cases, and measurable impact.",
    };
  }

  const score = Number((parsed as any).score);
  const ratingRaw = String((parsed as any).rating ?? "").trim();
  const feedback = String((parsed as any).feedback ?? "");
  if (!Number.isFinite(score)) {
    console.error("[gemini] evaluateInterviewAnswer returned invalid score", { parsed });
    return {
      score: 5,
      rating: "Average",
      feedback:
        "AI evaluation returned an invalid score. Your answer was saved; improve by clarifying assumptions, constraints, and time/space complexity where relevant.",
    };
  }

  const rating: "Poor" | "Average" | "Good" | "Excellent" =
    ratingRaw === "Poor" || ratingRaw === "Average" || ratingRaw === "Good" || ratingRaw === "Excellent"
      ? (ratingRaw as any)
      : score >= 8
        ? "Excellent"
        : score >= 6
          ? "Good"
          : score >= 4
            ? "Average"
            : "Poor";

  return {
    score: Math.max(0, Math.min(10, Math.round(score))),
    rating,
    feedback: feedback.trim() || "No feedback provided.",
  };
}

export async function summarizeInterview(input: {
  role: string;
  experience: string;
  techStack: unknown;
  overallScore: number;
  qas: Array<{ question: string; answer: string; score?: number; feedback?: string }>;
}): Promise<string> {
  const prompt = [
    "You are an interview summarizer.",
    `Role: ${input.role}`,
    `Experience: ${input.experience}`,
    `Tech stack (JSON): ${JSON.stringify(input.techStack)}`,
    `Overall score (0-100): ${input.overallScore}`,
    "Create a short, actionable summary with strengths, weaknesses, and 3 next-step recommendations.",
    "Use plain text (no markdown).",
    `Transcript:\n${input.qas
      .map(
        (qa, i) =>
          `${i + 1}. Q: ${qa.question}\n   A: ${qa.answer}\n   Score: ${qa.score ?? "n/a"}\n   Feedback: ${
            qa.feedback ?? "n/a"
          }`
      )
      .join("\n")}`,
  ].join("\n");

  const r = await geminiGenerateText(prompt, { timeoutMs: 25000 });
  if (r.ok) return r.text;
  logGeminiFailure("summarizeInterview", r.error);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const qa of input.qas.slice(0, 5)) {
    if ((qa.score ?? 0) >= 7) strengths.push(qa.question);
    if ((qa.score ?? 10) <= 4) weaknesses.push(qa.question);
  }

  return [
    `Overall score: ${input.overallScore}/100`,
    strengths.length ? `Strengths: ${strengths.slice(0, 2).join(" | ")}` : "Strengths: (not enough data)",
    weaknesses.length ? `Weaknesses: ${weaknesses.slice(0, 2).join(" | ")}` : "Weaknesses: (not enough data)",
    "Next steps:",
    "1) Answer with a clear structure (problem -> approach -> tradeoffs -> result).",
    "2) Add specific examples, edge cases, and metrics/impact where possible.",
    "3) Practice concise explanations and confirm requirements before diving in.",
  ].join("\n");
}

export function assertGeminiConfigured() {
  if (!env.GEMINI_API_KEY) throw new ApiError(500, "Missing GEMINI_API_KEY");
}
