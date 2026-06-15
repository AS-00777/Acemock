import { Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { AuthRequest } from "../types/request";
import { findOrCreateUserFromClerk } from "../services/user.service";

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ message: "Missing or invalid Clerk session" });
    }

    req.user = await findOrCreateUserFromClerk(userId);
    next();
  } catch (err) {
    next(err);
  }
};
