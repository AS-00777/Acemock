/**
 * Deprecated: Gemini calls must NOT happen from the frontend.
 * All AI generation/evaluation is handled by backend interview endpoints.
 *
 * This file remains only to prevent accidental re-introduction of direct Gemini usage.
 */

export async function generateInterviewQuestions(): Promise<never> {
  throw new Error("Gemini is handled by the backend. Use /api/interview/* endpoints instead.");
}

export async function evaluateInterview(): Promise<never> {
  throw new Error("Gemini is handled by the backend. Use /api/interview/* endpoints instead.");
}

