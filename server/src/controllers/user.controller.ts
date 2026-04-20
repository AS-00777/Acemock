import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/request";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const rows = await query<
      (RowDataPacket & {
        id: number;
        name: string;
        email: string;
        created_at: Date;
        deleted_at: Date | null;
      })[]
    >(
      "SELECT id, name, email, created_at, deleted_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    const user = rows[0];

    if (!user || user.deleted_at) {
      throw new ApiError(404, "User not found");
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};