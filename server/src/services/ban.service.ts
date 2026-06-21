import type { RowDataPacket } from "mysql2/promise";
import { exec, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";

export const BAN_DURATION_HOURS = 3;

export type BanStatus = {
  banned: boolean;
  bannedUntil: Date | null;
  banReason: string | null;
  remainingMs: number;
  message: string | null;
};

type BanRow = RowDataPacket & {
  banned_until: Date | string | null;
  ban_reason: string | null;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatRemainingBanTime(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export async function getUserBanStatus(userId: number): Promise<BanStatus> {
  const rows = await query<BanRow[]>(
    "SELECT banned_until, ban_reason FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [userId]
  );
  const row = rows[0];
  if (!row) throw new ApiError(404, "User not found");

  const bannedUntil = toDate(row.banned_until);
  const remainingMs = bannedUntil ? bannedUntil.getTime() - Date.now() : 0;
  const banned = Boolean(bannedUntil && remainingMs > 0);

  return {
    banned,
    bannedUntil,
    banReason: row.ban_reason,
    remainingMs: banned ? remainingMs : 0,
    message: banned
      ? `You are temporarily banned from starting interviews. Try again in ${formatRemainingBanTime(remainingMs)}.`
      : null,
  };
}

export async function assertUserCanStartInterview(userId: number) {
  const status = await getUserBanStatus(userId);
  if (!status.banned) return status;
  throw new ApiError(403, status.message || "You are temporarily banned from starting interviews.", {
    banned: true,
    bannedUntil: status.bannedUntil,
    banReason: status.banReason,
    remainingMs: status.remainingMs,
  });
}

export async function banUserForMonitoringViolation(userId: number, reason: string) {
  await exec(
    "UPDATE users SET banned_until = DATE_ADD(NOW(), INTERVAL ? HOUR), ban_reason = ? WHERE id = ?",
    [BAN_DURATION_HOURS, reason, userId]
  );
  return getUserBanStatus(userId);
}
