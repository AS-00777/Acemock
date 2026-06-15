const DEFAULT_BASE_URL = "http://localhost:5000/api";
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || DEFAULT_BASE_URL;
const IS_DEV = Boolean((import.meta as any).env?.DEV);

const RETRY_STATUSES = new Set([502, 503, 504]);

type AuthTokenGetter = (() => Promise<string | null>) | null;

let authTokenGetter: AuthTokenGetter = null;

export function setAuthTokenGetter(getter: AuthTokenGetter) {
  authTokenGetter = getter;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const maxRetries = 2;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const token = authTokenGetter ? await authTokenGetter() : null;
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);

    try {
      if (IS_DEV) console.debug("[api] request", { path, attempt });
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
      });

      const text = await res.text().catch(() => "");
      const data = text
        ? (() => {
            try {
              return JSON.parse(text);
            } catch {
              return text;
            }
          })()
        : null;

      if (!res.ok) {
        const message =
          (data &&
            typeof data === "object" &&
            "message" in (data as any) &&
            String((data as any).message)) ||
          `Request failed (${res.status})`;

        const err = new ApiError(res.status, message, data);
        lastErr = err;

        if (attempt < maxRetries && RETRY_STATUSES.has(res.status)) {
          // Exponential-ish backoff: 400ms, 900ms, ...
          await sleep(400 + attempt * 500);
          continue;
        }

        throw err;
      }

      if (IS_DEV) console.debug("[api] response", { path, status: res.status });
      return data as T;
    } catch (e: any) {
      lastErr = e;
      if (attempt < maxRetries) {
        await sleep(400 + attempt * 500);
        continue;
      }
      if (IS_DEV) console.error("[api] request failed", { path, error: String(e?.message ?? e) });
      throw e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Request failed");
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? "{}" : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? "{}" : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
