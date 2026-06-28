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
  OPENROUTER_ATS_MODEL: process.env.OPENROUTER_ATS_MODEL ?? "google/gemma-4-31b-it:free",
  OPENROUTER_FALLBACK_MODEL: process.env.OPENROUTER_FALLBACK_MODEL ?? "openrouter/free",
  PYTHON_NLP_URL: process.env.PYTHON_NLP_URL ?? "http://localhost:8001",
  ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY,
  ROBOFLOW_API_URL: process.env.ROBOFLOW_API_URL,
  ROBOFLOW_WORKSPACE: process.env.ROBOFLOW_WORKSPACE,
  ROBOFLOW_WORKFLOW_ID: process.env.ROBOFLOW_WORKFLOW_ID,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
};

if (!Number.isFinite(env.PORT) || env.PORT <= 0) {
  throw new Error("Invalid PORT");
}
