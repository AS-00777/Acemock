import { env } from "../config/env";

type SuggestionInput = {
  targetRole: string;
  jobDescription: string;
  missingSkills: string[];
  partialMatches: Array<{ requiredSkill: string; resumeSkill: string }>;
  weakProjectAlignment: string[];
  localSuggestions: string[];
};

function cleanSuggestion(value: string) {
  return value
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^["'\[\],\s]+|["'\]\s,]+$/g, "")
    .replace(/^[-*\u2022\d.)\s]+/, "")
    .trim();
}

function parseSuggestions(raw: string): string[] | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((item) => cleanSuggestion(String(item))).filter(Boolean).slice(0, 6);
    if (parsed && typeof parsed === "object") {
      const candidates = (parsed as any).suggestions ?? (parsed as any).improvements ?? (parsed as any).items;
      if (Array.isArray(candidates)) return candidates.map((item) => cleanSuggestion(String(item))).filter(Boolean).slice(0, 6);
    }
  } catch {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed.map((item) => cleanSuggestion(String(item))).filter(Boolean).slice(0, 6);
      } catch {
        // Fall through to line parsing.
      }
    }
  }

  const suggestions = text
    .split(/\r?\n|(?<=")\s*,\s*(?=")/)
    .map(cleanSuggestion)
    .filter((line) => line && !["[", "]"].includes(line))
    .slice(0, 6);
  return suggestions.length ? suggestions : null;
}

async function callOpenRouter(model: string, input: SuggestionInput): Promise<string[] | null> {
  if (!env.OPENROUTER_API_KEY) return null;

  const prompt = [
    "You are improving a resume against a job description.",
    "Return only 4-6 concise resume improvement suggestions as a JSON array of strings.",
    "Do not calculate or change scores.",
    `Target role: ${input.targetRole}`,
    `Missing skills: ${input.missingSkills.join(", ") || "none"}`,
    `Partial matches: ${input.partialMatches.map((item) => `${item.requiredSkill} via ${item.resumeSkill}`).join(", ") || "none"}`,
    `Weak project alignment: ${input.weakProjectAlignment.join(" ") || "none"}`,
    `Job description: ${input.jobDescription.slice(0, 2500)}`,
  ].join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) return null;
  const data: any = await response.json().catch(() => null);
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  return text ? parseSuggestions(text) : null;
}

export async function getResumeJdSuggestions(input: SuggestionInput): Promise<{ suggestions: string[]; source: string }> {
  for (const model of [env.OPENROUTER_ATS_MODEL, env.OPENROUTER_FALLBACK_MODEL]) {
    try {
      const suggestions = await callOpenRouter(model, input);
      if (suggestions?.length) return { suggestions, source: `openrouter:${model}` };
    } catch {
      // Suggestions are optional; Python scores remain authoritative.
    }
  }
  return { suggestions: input.localSuggestions, source: "python-local" };
}
