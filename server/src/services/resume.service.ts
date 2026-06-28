import path from "path";
import type { RowDataPacket } from "mysql2/promise";
import { exec, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";
import { extractJsonObject, openRouterChat } from "./gemini.service";
import { extractResumeWithPython } from "./pythonNlp.service";
import { startInterview } from "./interview.service";

type Difficulty = "easy" | "medium" | "hard";
type ResumeProfile = {
  candidateName: string | null;
  detectedRole: string;
  detectedExperience: "Fresher" | "Intern" | "Experienced";
  detectedDifficulty: "Easy" | "Medium" | "Hard";
  skills: string[];
  programmingLanguages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  projects: Array<{ name: string; description: string; technologies: string[] }>;
  education: string[];
  certifications: string[];
  questionFocusAreas: string[];
};

type ResumeRow = RowDataPacket & {
  id: number;
  user_id: number;
  parsed_profile: any;
};

function clip(text: unknown, maxChars: number) {
  const value = String(text ?? "").trim();
  return value.length <= maxChars ? value : `${value.slice(0, maxChars)}...`;
}

function sanitizeFileName(name: string) {
  const base = path.basename(name || "resume.pdf").replace(/[^\w.\- ()]/g, "_").slice(0, 180);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

function uniqueClean(values: unknown, limit = 30) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of values) {
    const value = String(item ?? "").replace(/\s+/g, " ").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value.slice(0, 80));
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeExperience(value: unknown): ResumeProfile["detectedExperience"] {
  return value === "Intern" || value === "Experienced" || value === "Fresher" ? value : "Fresher";
}

function normalizeDifficulty(value: unknown): ResumeProfile["detectedDifficulty"] {
  return value === "Easy" || value === "Hard" || value === "Medium" ? value : "Medium";
}

function toDifficulty(value: ResumeProfile["detectedDifficulty"]): Difficulty {
  return value === "Easy" ? "easy" : value === "Hard" ? "hard" : "medium";
}

function normalizeProfile(raw: Record<string, unknown>): ResumeProfile {
  const projectsRaw = Array.isArray(raw.projects) ? raw.projects : [];
  const profile: ResumeProfile = {
    candidateName: typeof raw.candidateName === "string" && raw.candidateName.trim() ? clip(raw.candidateName, 120) : null,
    detectedRole: clip(raw.detectedRole || "Software Developer", 120),
    detectedExperience: normalizeExperience(raw.detectedExperience),
    detectedDifficulty: normalizeDifficulty(raw.detectedDifficulty),
    skills: uniqueClean(raw.skills),
    programmingLanguages: uniqueClean(raw.programmingLanguages),
    frameworks: uniqueClean(raw.frameworks),
    databases: uniqueClean(raw.databases),
    tools: uniqueClean(raw.tools),
    projects: projectsRaw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        name: clip(item.name || "Project", 120),
        description: clip(item.description || "", 500),
        technologies: uniqueClean(item.technologies, 12),
      }))
      .filter((project) => project.name || project.description)
      .slice(0, 8),
    education: uniqueClean(raw.education, 12),
    certifications: uniqueClean(raw.certifications, 12),
    questionFocusAreas: uniqueClean(raw.questionFocusAreas, 12),
  };

  const combinedSkills = [
    ...profile.skills,
    ...profile.programmingLanguages,
    ...profile.frameworks,
    ...profile.databases,
    ...profile.tools,
  ];
  if (!combinedSkills.length) {
    throw new ApiError(422, "Could not detect enough resume skills to start an interview.");
  }
  return profile;
}

export async function analyzeResumeProfile(extractedText: string): Promise<ResumeProfile> {
  const prompt = [
    "You are a resume parser for an interview practice product.",
    "Convert the resume text into STRICT JSON only. No markdown, no prose, no comments.",
    "Do not invent skills. Only extract what is present or strongly implied by projects, work, education, or certifications.",
    "If role is unclear, infer the most suitable fresher role from projects and skills.",
    "Keep skills unique, clean, and specific.",
    "Use exactly this JSON shape:",
    `{"candidateName":null,"detectedRole":"","detectedExperience":"Fresher","detectedDifficulty":"Medium","skills":[],"programmingLanguages":[],"frameworks":[],"databases":[],"tools":[],"projects":[{"name":"","description":"","technologies":[]}],"education":[],"certifications":[],"questionFocusAreas":[]}`,
    "Allowed detectedExperience values: Fresher, Intern, Experienced.",
    "Allowed detectedDifficulty values: Easy, Medium, Hard.",
    `Resume text:\n${clip(extractedText, 12000)}`,
  ].join("\n");

  const response = await openRouterChat(prompt, { timeoutMs: 30000, maxTokens: 2200 });
  if (!response.ok) {
    throw new ApiError(502, "Resume profile analysis failed. Please try again.");
  }

  const parsed = extractJsonObject(response.text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(502, "Resume profile analysis returned invalid JSON. Please try again.");
  }

  return normalizeProfile(parsed as Record<string, unknown>);
}

export async function analyzeResumeUpload(params: {
  userId: number;
  file: Express.Multer.File;
}) {
  const safeFileName = sanitizeFileName(params.file.originalname);
  const extraction = await extractResumeWithPython({
    buffer: params.file.buffer,
    originalName: safeFileName,
    mimeType: params.file.mimetype,
  });

  const extractedText = String(extraction.extracted_text ?? "").trim();
  console.info("[resume] extraction", {
    documentType: extraction.document_type,
    extractedTextLength: extractedText.length,
    linkedInDetected: Boolean(extraction.has_linkedin),
    githubDetected: Boolean(extraction.has_github),
  });

  if (extraction.document_type !== "resume") {
    throw new ApiError(400, extraction.document_type === "unreadable"
      ? "Could not read enough resume text. Please upload a text-readable PDF resume."
      : "This document does not look like a resume. Please upload a valid resume PDF.");
  }
  if (extractedText.length < 500) {
    throw new ApiError(400, "Could not extract enough resume text. Please upload a text-readable resume PDF.");
  }

  const profile = await analyzeResumeProfile(extractedText);
  const result = await exec(
    "INSERT INTO resumes (user_id, file_name, extracted_text, parsed_profile, document_type, validation_status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [
      params.userId,
      safeFileName,
      extractedText,
      JSON.stringify(profile),
      extraction.document_type,
      "valid",
    ]
  );

  return {
    success: true,
    resumeId: result.insertId,
    profile,
    signals: {
      hasLinkedin: Boolean(extraction.has_linkedin),
      hasGithub: Boolean(extraction.has_github),
      readableWordCount: extraction.readable_word_count,
      sectionSignals: extraction.section_signals,
    },
  };
}

export async function startResumeInterview(params: { userId: number; resumeId: number }) {
  const rows = await query<ResumeRow[]>(
    "SELECT id, user_id, parsed_profile FROM resumes WHERE id = ? LIMIT 1",
    [params.resumeId]
  );
  const resume = rows[0];
  if (!resume) throw new ApiError(404, "Resume not found");
  if (resume.user_id !== params.userId) throw new ApiError(403, "Forbidden");

  const profile = typeof resume.parsed_profile === "string"
    ? JSON.parse(resume.parsed_profile)
    : resume.parsed_profile;
  const normalized = normalizeProfile(profile as Record<string, unknown>);
  const techStack = {
    skills: uniqueClean([
      ...normalized.skills,
      ...normalized.programmingLanguages,
      ...normalized.frameworks,
      ...normalized.databases,
      ...normalized.tools,
    ], 30),
    difficulty: normalized.detectedDifficulty,
    source: "RESUME",
    interview_source: "RESUME",
    resumeId: params.resumeId,
    resumeProfile: normalized,
  };

  const interview = await startInterview({
    userId: params.userId,
    role: normalized.detectedRole,
    experience: normalized.detectedExperience,
    difficulty: toDifficulty(normalized.detectedDifficulty),
    techStack,
    personality: "Senior Engineering Manager",
    interviewSource: "RESUME",
    resumeId: params.resumeId,
  });

  return {
    success: true,
    interview: {
      id: interview.id,
      userId: interview.user_id,
      role: interview.role,
      experience: interview.experience,
      difficulty: (interview as any).difficulty ?? toDifficulty(normalized.detectedDifficulty),
      techStack: interview.tech_stack,
      status: interview.status,
      createdAt: interview.created_at,
      completedAt: interview.completed_at,
      interviewSource: "RESUME",
      resumeId: params.resumeId,
    },
  };
}
