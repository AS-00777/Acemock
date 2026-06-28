import type { ErrorRequestHandler, RequestHandler } from "express";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Not Found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const mysqlCode = (err as any)?.code as string | undefined;
  if (mysqlCode === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Duplicate entry" });
  }
  if ((err as any)?.name === "MulterError") {
    const code = (err as any)?.code;
    const message = code === "LIMIT_FILE_SIZE" ? "File size must be less than 5MB." : "Invalid file upload.";
    return res.status(400).json({ message });
  }

  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";

  if (status >= 500) {
    console.error(err);
  }

  return res.status(status).json({
    message,
    ...(err instanceof ApiError && err.details ? { details: err.details } : {}),
  });
};
