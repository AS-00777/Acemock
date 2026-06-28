import fs from "fs";
import type { NextFunction, Response } from "express";
import { ApiError } from "../middleware/error.middleware";
import type { AuthRequest } from "../types/request";
import { analyzeResumeJdWithPython } from "../services/pythonNlp.service";
import { getResumeJdSuggestions } from "../services/openRouterResumeSuggestions.service";

export const analyze = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    if (!req.file) throw new ApiError(400, "resume file is required");

    const targetRole = String(req.body?.targetRole ?? "").trim();
    const jobDescription = String(req.body?.jobDescription ?? "").trim();
    if (!targetRole) throw new ApiError(400, "targetRole is required");
    if (!jobDescription) throw new ApiError(400, "jobDescription is required");

    const analysis = await analyzeResumeJdWithPython({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      targetRole,
      jobDescription,
    });

    const ai = await getResumeJdSuggestions({
      targetRole,
      jobDescription,
      missingSkills: analysis.missingSkills,
      partialMatches: analysis.partialMatches,
      weakProjectAlignment: analysis.weakProjectAlignment,
      localSuggestions: analysis.suggestedImprovements,
    });

    res.json({ result: { ...analysis, suggestedImprovements: ai.suggestions, suggestionSource: ai.source } });
  } catch (err) {
    next(err);
  } finally {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
};
