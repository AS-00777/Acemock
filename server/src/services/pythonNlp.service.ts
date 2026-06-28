import fs from "fs";
import { env } from "../config/env";
import { ApiError } from "../middleware/error.middleware";

export type AtsCheckResult = {
  atsScore: number;
  parseScore: number;
  readabilityScore: number;
  sectionCoverageScore: number;
  formattingScore: number;
  keywordQualityScore: number;
  contactDetection: Record<string, boolean>;
  detectedSkills: string[];
  strengths: string[];
  improvements: string[];
  formattingIssues: string[];
  sectionIssues: string[];
  sectionsFound: string[];
  wordCount: number;
  summary: string;
  documentType?: "resume" | "offer_letter" | "certificate" | "unreadable" | "unknown";
  documentConfidence?: number;
  documentReasons?: string[];
  status?: "ok" | "invalid_document" | "unreadable";
  message?: string;
  overallScore?: number;
};

export type ResumeJdAnalyzeResult = {
  overallMatchScore: number;
  skillMatchScore: number;
  semanticMatchScore: number;
  experienceRelevanceScore: number;
  sectionRelevanceScore: number;
  keywordCoverageScore: number;
  matchedSkills: Array<{ requiredSkill: string; resumeSkill: string; matchType: string; score: number }>;
  missingSkills: string[];
  partialMatches: Array<{ requiredSkill: string; resumeSkill: string; matchType: string; score: number }>;
  weakProjectAlignment: string[];
  suggestedImprovements: string[];
  extractedRequiredSkills: string[];
  resumeSkills: string[];
  semanticModel: string;
  confidenceLabel: string;
  summary: string;
};

export type ResumeExtractResult = {
  document_type: "resume" | "invalid_document" | "unreadable";
  extracted_text: string;
  has_linkedin: boolean;
  has_github: boolean;
  readable_word_count: number;
  section_signals: string[];
};

export async function extractResumeWithPython(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<ResumeExtractResult> {
  const form = new FormData();
  const arrayBuffer = params.buffer.buffer.slice(
    params.buffer.byteOffset,
    params.buffer.byteOffset + params.buffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: params.mimeType || "application/pdf" });
  form.append("resume", blob, params.originalName);

  let response: Response;
  try {
    response = await fetch(`${env.PYTHON_NLP_URL.replace(/\/+$/, "")}/resume/extract`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(502, "Python NLP service is not reachable. Start it on port 8001 and try again.", {
      cause: String((err as Error)?.message ?? err),
    });
  }

  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : "Resume extraction failed";
    throw new ApiError(response.status >= 500 ? 502 : response.status, message, data);
  }

  return data as ResumeExtractResult;
}

export async function checkAtsWithPython(params: {
  filePath: string;
  originalName: string;
  mimeType: string;
}): Promise<AtsCheckResult> {
  const form = new FormData();
  const bytes = await fs.promises.readFile(params.filePath);
  const blob = new Blob([bytes], { type: params.mimeType || "application/octet-stream" });
  form.append("resume", blob, params.originalName);

  let response: Response;
  try {
    response = await fetch(`${env.PYTHON_NLP_URL.replace(/\/+$/, "")}/ats/check`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(502, "Python NLP service is not reachable. Start it on port 8001 and try again.", {
      cause: String((err as Error)?.message ?? err),
    });
  }

  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : "ATS analysis failed";
    throw new ApiError(response.status >= 500 ? 502 : response.status, message, data);
  }

  return data as AtsCheckResult;
}

export async function analyzeResumeJdWithPython(params: {
  filePath: string;
  originalName: string;
  mimeType: string;
  targetRole: string;
  jobDescription: string;
}): Promise<ResumeJdAnalyzeResult> {
  const form = new FormData();
  const bytes = await fs.promises.readFile(params.filePath);
  const blob = new Blob([bytes], { type: params.mimeType || "application/octet-stream" });
  form.append("resume", blob, params.originalName);
  form.append("targetRole", params.targetRole);
  form.append("jobDescription", params.jobDescription);

  let response: Response;
  try {
    response = await fetch(`${env.PYTHON_NLP_URL.replace(/\/+$/, "")}/resume-jd/analyze`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new ApiError(502, "Python NLP service is not reachable. Start it on port 8001 and try again.", {
      cause: String((err as Error)?.message ?? err),
    });
  }

  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : "Resume vs JD analysis failed";
    throw new ApiError(response.status >= 500 ? 502 : response.status, message, data);
  }

  return data as ResumeJdAnalyzeResult;
}

export async function getPythonNlpHealth(): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${env.PYTHON_NLP_URL.replace(/\/+$/, "")}/health`);
  } catch (err) {
    throw new ApiError(502, "Python NLP service is not reachable. Start it on port 8001 and try again.", {
      cause: String((err as Error)?.message ?? err),
    });
  }

  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status >= 500 ? 502 : response.status, "Python NLP health check failed", data);
  }

  return data;
}
