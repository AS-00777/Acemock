import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/request";
import { ApiError } from "../middleware/error.middleware";
import { getUserBanStatus } from "../services/ban.service";
import { checkProctoringFrame } from "../services/proctoring.service";

export const checkFrame = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const interviewId = Number(req.body?.interviewId);
    if (!Number.isFinite(interviewId) || interviewId <= 0) {
      throw new ApiError(400, "interviewId is required");
    }

    const result = await checkProctoringFrame({
      userId: req.user.id,
      interviewId,
      frame: req.body?.frame ?? req.body?.image ?? req.body?.frameBase64,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const checkBan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const status = await getUserBanStatus(req.user.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
};
