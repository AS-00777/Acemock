import fs from "fs";
import type { NextFunction, Response } from "express";
import { ApiError } from "../middleware/error.middleware";
import type { AuthRequest } from "../types/request";
import { checkAtsWithPython, getPythonNlpHealth } from "../services/pythonNlp.service";

export const health = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const python = await getPythonNlpHealth();
    res.json({ status: "ok", python });
  } catch (err) {
    next(err);
  }
};

export const check = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    if (!req.file) throw new ApiError(400, "resume file is required");

    const result = await checkAtsWithPython({
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    res.json({ result });
  } catch (err) {
    next(err);
  } finally {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
};
