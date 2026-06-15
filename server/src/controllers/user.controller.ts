import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/request";
import { ApiError } from "../middleware/error.middleware";
import { getUserProfile, updateUserProfile } from "../services/user.service";

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const user = await getUserProfile(req.user.id);
    if (!user) throw new ApiError(404, "User not found");

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

export const putProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const user = await updateUserProfile(req.user.id, req.body ?? {});
    if (!user) throw new ApiError(404, "User not found");

    res.json({ user });
  } catch (err) {
    next(err);
  }
};
