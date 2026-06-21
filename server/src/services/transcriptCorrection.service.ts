type TranscriptCorrectionInput = {
  questionText: string;
  role: string;
  techStack: unknown;
  rawTranscript: string;
};

function normalizeSpaces(text: string) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function contextIncludes(input: TranscriptCorrectionInput, pattern: RegExp) {
  const context = `${input.questionText} ${input.role} ${JSON.stringify(input.techStack ?? "")}`.toLowerCase();
  return pattern.test(context);
}

function replaceWord(text: string, from: RegExp, to: string) {
  return text.replace(from, to);
}

export function correctTranscriptWithContext(input: TranscriptCorrectionInput) {
  const raw = normalizeSpaces(input.rawTranscript);
  if (!raw) return "";

  let corrected = raw;

  if (contextIncludes(input, /\b(css|html|frontend|front end|div|flex|grid)\b/)) {
    corrected = replaceWord(corrected, /\b(delhi|deli|dehli|daily)\b/gi, "div");
    corrected = replaceWord(corrected, /\bflags?\s*box\b/gi, "flexbox");
    corrected = replaceWord(corrected, /\bjust if I\b/gi, "justify");
    corrected = replaceWord(corrected, /\bjustified content\b/gi, "justify-content");
    corrected = replaceWord(corrected, /\ba line items\b/gi, "align-items");
  }

  if (contextIncludes(input, /\b(react|javascript|typescript|frontend|front end)\b/)) {
    corrected = replaceWord(corrected, /\bre act\b/gi, "React");
    corrected = replaceWord(corrected, /\bjava script\b/gi, "JavaScript");
    corrected = replaceWord(corrected, /\btype script\b/gi, "TypeScript");
    corrected = replaceWord(corrected, /\buse affect\b/gi, "useEffect");
    corrected = replaceWord(corrected, /\buse memo\b/gi, "useMemo");
  }

  if (contextIncludes(input, /\b(api|http|rest|backend|server)\b/)) {
    corrected = replaceWord(corrected, /\brest api\b/gi, "REST API");
    corrected = replaceWord(corrected, /\bh t t p\b/gi, "HTTP");
    corrected = replaceWord(corrected, /\bjason\b/gi, "JSON");
  }

  if (contextIncludes(input, /\b(sql|database|mysql|postgres|query)\b/)) {
    corrected = replaceWord(corrected, /\bsequel\b/gi, "SQL");
    corrected = replaceWord(corrected, /\bmy sequel\b/gi, "MySQL");
    corrected = replaceWord(corrected, /\bpost grass\b/gi, "Postgres");
  }

  return normalizeSpaces(corrected);
}
