import natural from "natural";

export type ConfidenceLevel = "High" | "Medium" | "Low";

export type ConfidenceAnalysisInput = {
  answerText: string;
  fillerWordsCount?: number | null;
  answerLength?: number | null;
  fluencyScore?: number | null;
  clarityScore?: number | null;
  pauseCount?: number | null;
};

export type ConfidenceAnalysisResult = {
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  reasons: string[];
  improvementTips: string[];
};

const tokenizer = new natural.WordTokenizer();

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tokenize(text: string) {
  return tokenizer
    .tokenize(String(text ?? "").toLowerCase())
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

function repetitionRate(words: string[]) {
  if (words.length < 4) return 0;

  let repeatedAdjacentWords = 0;
  for (let i = 1; i < words.length; i += 1) {
    if (words[i] === words[i - 1]) repeatedAdjacentWords += 1;
  }

  const phrases = new Map<string, number>();
  for (let i = 0; i <= words.length - 3; i += 1) {
    const phrase = words.slice(i, i + 3).join(" ");
    phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
  }
  const repeatedPhrases = Array.from(phrases.values()).reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0
  );

  return Math.min(1, (repeatedAdjacentWords + repeatedPhrases * 2) / Math.max(1, words.length));
}

function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function analyzeCommunicationConfidence(input: ConfidenceAnalysisInput): ConfidenceAnalysisResult {
  const words = tokenize(input.answerText);
  const answerLength = input.answerLength ?? words.length;
  const fillerWordsCount = input.fillerWordsCount ?? 0;
  const fluencyScore = input.fluencyScore ?? 50;
  const clarityScore = input.clarityScore ?? 50;
  const repetition = repetitionRate(words);
  const fillerRate = answerLength > 0 ? fillerWordsCount / answerLength : 0;
  const pausePenalty = typeof input.pauseCount === "number" ? Math.min(18, input.pauseCount * 2) : 0;
  const lengthScore = answerLength >= 45 ? 100 : answerLength >= 25 ? 82 : answerLength >= 12 ? 62 : 38;
  const repetitionScore = clampScore(100 - repetition * 260);
  const fillerScore = clampScore(100 - fillerRate * 260);
  const confidenceScore = clampScore(
    fluencyScore * 0.32 +
      clarityScore * 0.28 +
      lengthScore * 0.18 +
      repetitionScore * 0.12 +
      fillerScore * 0.1 -
      pausePenalty
  );
  const level = confidenceLevel(confidenceScore);

  const reasons: string[] = [
    `Fluency score: ${clampScore(fluencyScore)}/100.`,
    `Clarity score: ${clampScore(clarityScore)}/100.`,
    `Answer length: ${answerLength} words.`,
    `Filler words detected: ${fillerWordsCount}.`,
  ];
  if (repetition > 0.08) reasons.push("Repeated words or phrases lowered the estimate.");
  else reasons.push("Repetition was not a major issue.");
  if (typeof input.pauseCount === "number") reasons.push(`Pause markers detected: ${input.pauseCount}.`);
  else reasons.push("Pause data was not available, so it was not used.");

  const improvementTips: string[] = [];
  if (answerLength < 25) improvementTips.push("Give a fuller answer with a short example or tradeoff.");
  if (fillerRate > 0.05) improvementTips.push("Reduce filler words by pausing briefly before continuing.");
  if (repetition > 0.08) improvementTips.push("Avoid repeating the same phrase; move to the next point clearly.");
  if (clarityScore < 70) improvementTips.push("Structure answers as point, explanation, example, and conclusion.");
  if (fluencyScore < 70) improvementTips.push("Practice a steady pace and finish sentences before starting the next idea.");
  if (!improvementTips.length) improvementTips.push("Keep the same structure and add concise examples where useful.");

  return {
    confidenceScore,
    confidenceLevel: level,
    reasons,
    improvementTips,
  };
}
