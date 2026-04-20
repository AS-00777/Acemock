import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/request";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "../config/db";
import { verifyAccessToken } from "../utils/jwt";

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : "";

    if (!token) {
      return res.status(401).json({ message: "Missing Authorization token" });
    }

    const payload = verifyAccessToken(token);

    const rows = await query<
      (RowDataPacket & {
        id: number;
        email: string;
        name: string;
        deleted_at: Date | null;
      })[]
    >(
      "SELECT id, email, name, deleted_at FROM users WHERE id = ? LIMIT 1",
      [payload.userId]
    );

    const user = rows[0];

    if (!user || user.deleted_at) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};