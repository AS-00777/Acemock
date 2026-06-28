import type { NextFunction, Response } from "express";
import { ApiError } from "../middleware/error.middleware";
import type { AuthRequest } from "../types/request";
import { analyzeResumeUpload, startResumeInterview } from "../services/resume.service";

export async function analyze(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    if (!req.file) throw new ApiError(400, "Resume PDF is required.");

    const result = await analyzeResumeUpload({
      userId: req.user.id,
      file: req.file,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function startFromResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const resumeId = Number(req.params.resumeId);
    if (!Number.isFinite(resumeId) || resumeId <= 0) throw new ApiError(400, "Invalid resume id");

    const result = await startResumeInterview({ userId: req.user.id, resumeId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
