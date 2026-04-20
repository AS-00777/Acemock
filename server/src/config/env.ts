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
  JWT_SECRET: requireEnv("JWT_SECRET"),
  GEMINI_API_KEY: requireEnv("GEMINI_API_KEY"),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
};

if (!Number.isFinite(env.PORT) || env.PORT <= 0) {
  throw new Error("Invalid PORT");
}
