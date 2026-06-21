import natural from "natural";

export type NlpAnalysisInput = {
  question: string;
  expectedConcepts?: string[];
  userAnswer: string;
};

export type NlpAnalysisResult = {
  answerLength: number;
  nlpScore: number;
  missingConcepts: string[];
  fillerWordsCount: number;
  fluencyScore: number;
  clarityScore: number;
  summary: string;
};

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

const FILLER_WORDS = new Set([
  "um",
  "uh",
  "erm",
  "ah",
  "like",
  "actually",
  "basically",
  "literally",
  "probably",
  "maybe",
  "kind",
  "sort",
  "just",
  "so",
  "well",
  "okay",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function words(text: string) {
  return tokenizer
    .tokenize(String(text ?? "").toLowerCase())
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

function contentWords(text: string) {
  return words(text).filter((word) => !STOP_WORDS.has(word));
}

function stemSet(text: string) {
  return new Set(contentWords(text).map((word) => stemmer.stem(word)));
}

function conceptCovered(concept: string, answerStems: Set<string>, answerText: string) {
  const normalizedConcept = concept.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalizedConcept) return true;
  if (answerText.includes(normalizedConcept)) return true;

  const conceptStems = contentWords(concept).map((word) => stemmer.stem(word));
  if (!conceptStems.length) return true;
  const matched = conceptStems.filter((stem) => answerStems.has(stem)).length;
  return matched / conceptStems.length >= 0.6;
}

function sentenceCount(text: string) {
  const parts = String(text ?? "")
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return Math.max(1, parts.length);
}

export function analyzeAnswerNlp(input: NlpAnalysisInput): NlpAnalysisResult {
  const answer = String(input.userAnswer ?? "").trim();
  const answerWords = words(answer);
  const answerLength = answerWords.length;
  const lowerAnswer = answer.toLowerCase().replace(/\s+/g, " ").trim();
  const answerStems = stemSet(answer);

  const concepts = (input.expectedConcepts ?? [])
    .map((concept) => String(concept ?? "").trim())
    .filter(Boolean);
  const missingConcepts = concepts.filter((concept) => !conceptCovered(concept, answerStems, lowerAnswer));
  const coverageScore = concepts.length
    ? ((concepts.length - missingConcepts.length) / concepts.length) * 100
    : 70;

  const fillerWordsCount = answerWords.filter((word) => FILLER_WORDS.has(word)).length;
  const fillerRate = answerLength ? fillerWordsCount / answerLength : 0;
  const avgSentenceLength = answerLength / sentenceCount(answer);
  const lengthScore = answerLength >= 45 ? 100 : answerLength >= 20 ? 75 : answerLength >= 8 ? 45 : 20;
  const sentenceScore = avgSentenceLength >= 6 && avgSentenceLength <= 28 ? 100 : avgSentenceLength <= 40 ? 72 : 45;
  const clarityScore = clampScore(lengthScore * 0.45 + sentenceScore * 0.35 + coverageScore * 0.2);
  const fluencyScore = clampScore(100 - fillerRate * 240 - Math.max(0, avgSentenceLength - 30) * 1.5);
  const nlpScore = clampScore(coverageScore * 0.45 + clarityScore * 0.3 + fluencyScore * 0.25);

  const summary =
    answerLength === 0
      ? "No answer text available for NLP analysis."
      : `Answer has ${answerLength} words, ${fillerWordsCount} filler words, and covers ${
          concepts.length - missingConcepts.length
        } of ${concepts.length} expected concepts.`;

  return {
    answerLength,
    nlpScore,
    missingConcepts,
    fillerWordsCount,
    fluencyScore,
    clarityScore,
    summary,
  };
}
