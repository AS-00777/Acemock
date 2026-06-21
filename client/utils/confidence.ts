export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export function normalizeConfidence(value: unknown): { score: number | null; level: ConfidenceLevel | null } {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return { score: null, level: null };
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return { score: null, level: null };

  const score = Math.max(0, Math.min(100, numericValue));
  const level: ConfidenceLevel = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  return { score, level };
}
