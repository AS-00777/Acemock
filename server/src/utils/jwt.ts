import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthTokenPayload = {
  userId: number;
  email: string;
};

export function signAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}

