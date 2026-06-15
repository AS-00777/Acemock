import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  CLERK_SECRET_KEY: requireEnv("CLERK_SECRET_KEY"),
  JWT_SECRET: process.env.JWT_SECRET ?? "unused-clerk-jwt-secret",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
};

if (!Number.isFinite(env.PORT) || env.PORT <= 0) {
  throw new Error("Invalid PORT");
}
