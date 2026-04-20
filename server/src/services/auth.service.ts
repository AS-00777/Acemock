import crypto from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import { exec, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";
import { signAccessToken } from "../utils/jwt";

const SCRYPT_KEYLEN = 64;

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const hashHex = parts[2];
  const derived = await scryptAsync(password, salt);
  const a = Buffer.from(hashHex, "hex");
  return a.length === derived.length && crypto.timingSafeEqual(a, derived);
}

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password: string;
  created_at: Date;
  deleted_at: Date | null;
};

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
    [input.email]
  );
  if (existing.length) throw new ApiError(409, "Email already in use");

  const passwordHash = await hashPassword(input.password);
  const result = await exec("INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, NOW())", [
    input.name,
    input.email,
    passwordHash,
  ]);

  const rows = await query<UserRow[]>(
    "SELECT id, name, email, password, created_at, deleted_at FROM users WHERE id = ? LIMIT 1",
    [result.insertId]
  );
  const user = rows[0];
  const token = signAccessToken({ userId: user.id, email: user.email });

  return {
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.created_at },
    token,
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const rows = await query<UserRow[]>(
    "SELECT id, name, email, password, created_at, deleted_at FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1",
    [input.email]
  );
  const user = rows[0];
  if (!user) throw new ApiError(401, "Invalid email or password");

  const ok = await verifyPassword(input.password, user.password);
  if (!ok) throw new ApiError(401, "Invalid email or password");

  const token = signAccessToken({ userId: user.id, email: user.email });
  return {
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.created_at },
    token,
  };
}

