import type { RowDataPacket } from "mysql2/promise";
import { env } from "../config/env";
import { exec, query } from "../config/db";
import { ApiError } from "../middleware/error.middleware";
import { banUserForMonitoringViolation, getUserBanStatus } from "./ban.service";

const PERSON_CONFIDENCE = 0.7;
const PHONE_CONFIDENCE = 0.6;
const MIN_PERSON_AREA_RATIO = 0.12;
const MIN_PHONE_AREA_RATIO = 0.002;
const CONSECUTIVE_VIOLATION_CHECKS = 3;
const NO_CANDIDATE_NOTICE_CHECKS = 3;
const WARNING_COOLDOWN_MS = 10000;
const BAN_WARNING_THRESHOLD = 4;
const BAN_MESSAGE = "Interview stopped due to repeated monitoring violations. You may try again after 3 hours.";

const WARNING_MESSAGES = [
  "Warning 1: Multiple persons or restricted objects detected. Please ensure you are alone and remove restricted devices.",
  "Warning 2: Repeated monitoring violation detected.",
  "Final Warning: Continued violations will terminate the interview.",
] as const;

type MonitoringReason = "Multiple persons detected." | "Mobile phone detected.";

type Prediction = {
  class?: string;
  class_name?: string;
  className?: string;
  label?: string;
  name?: string;
  detected_class?: string;
  confidence?: number;
  score?: number;
  probability?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  w?: number;
  h?: number;
  box?: { width?: number; height?: number; w?: number; h?: number };
  bbox?: { width?: number; height?: number; w?: number; h?: number };
  bounding_box?: { width?: number; height?: number; w?: number; h?: number };
};

type ProctoringDebugInfo = {
  rawPredictionCount: number;
  parsedPredictionCount: number;
  detectedClasses: string[];
};

type InterviewMonitorRow = RowDataPacket & {
  id: number;
  user_id: number;
  status: "IN_PROGRESS" | "COMPLETED";
  warning_count: number;
};

type MonitoringState = {
  lastCountedWarningAt: number;
  consecutiveViolationKey: string;
  consecutiveViolationCount: number;
  consecutiveNoCandidateCount: number;
};

const stateByInterview = new Map<number, MonitoringState>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function normalizeFrameToBuffer(frame: unknown) {
  if (Buffer.isBuffer(frame)) {
    return { buffer: frame, mimeType: "image/jpeg", frameSize: getJpegSize(frame) };
  }

  if (
    frame &&
    typeof frame === "object" &&
    Array.isArray((frame as any).data) &&
    (frame as any).type === "Buffer"
  ) {
    const buffer = Buffer.from((frame as any).data);
    return { buffer, mimeType: "image/jpeg", frameSize: getJpegSize(buffer) };
  }

  const value = String(frame ?? "").trim();
  if (!value) throw new ApiError(400, "frame is required");
  const dataUrlMatch = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : "image/jpeg";
  const base64 = dataUrlMatch ? dataUrlMatch[2] : value;
  const buffer = Buffer.from(base64.replace(/\s/g, ""), "base64");
  return { buffer, mimeType, frameSize: getJpegSize(buffer) };
}

function normalizeClassName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getPredictionClass(prediction: Prediction) {
  return normalizeClassName(
    prediction.class ??
      prediction.class_name ??
      prediction.className ??
      prediction.label ??
      prediction.name ??
      prediction.detected_class
  );
}

function getConfidence(prediction: Prediction) {
  const n = Number(prediction.confidence ?? prediction.score ?? prediction.probability);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function normalizeDimension(value: unknown, frameDimension?: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 1 && frameDimension && frameDimension > 1) return n * frameDimension;
  return n;
}

function getBoxDimensions(prediction: Prediction, frameSize?: { width: number; height: number } | null) {
  const box = prediction.box ?? prediction.bbox ?? prediction.bounding_box;
  const width = normalizeDimension(prediction.width ?? prediction.w ?? box?.width ?? box?.w, frameSize?.width);
  const height = normalizeDimension(prediction.height ?? prediction.h ?? box?.height ?? box?.h, frameSize?.height);
  return { width, height };
}

function getAreaRatio(prediction: Prediction, frameSize?: { width: number; height: number } | null) {
  if (!frameSize?.width || !frameSize.height) return null;
  const box = getBoxDimensions(prediction, frameSize);
  if (!box.width || !box.height) return null;
  return Math.max(0, Math.min(1, (box.width * box.height) / (frameSize.width * frameSize.height)));
}

function collectNestedPredictions(value: unknown, out: Prediction[] = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectNestedPredictions(item, out);
    return out;
  }

  const raw = value as Record<string, unknown>;
  if (
    ("confidence" in raw || "score" in raw || "probability" in raw) &&
    ("class" in raw || "class_name" in raw || "className" in raw || "label" in raw || "name" in raw || "detected_class" in raw)
  ) {
    out.push(raw as Prediction);
  }

  for (const nested of Object.values(raw)) {
    if (nested && typeof nested === "object") collectNestedPredictions(nested, out);
  }
  return out;
}

function extractPredictions(response: unknown) {
  const root = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  const candidates = [
    root.predictions,
    Array.isArray(root.outputs) ? (root.outputs[0] as any)?.predictions : undefined,
    root.result && typeof root.result === "object" ? (root.result as any).predictions : undefined,
    response,
  ];

  const seen = new Set<Prediction>();
  const predictions: Prediction[] = [];
  for (const candidate of candidates) {
    for (const prediction of collectNestedPredictions(candidate)) {
      if (seen.has(prediction)) continue;
      seen.add(prediction);
      predictions.push(prediction);
    }
  }
  return predictions;
}

function stripLargeImagePayloads(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = stripLargeImagePayloads(value[index]);
    }
    return value;
  }

  const raw = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();
    if (
      typeof nested === "string" &&
      (lowerKey.includes("image") || lowerKey.includes("base64") || nested.length > 50000)
    ) {
      raw[key] = "[omitted image payload]";
    } else {
      raw[key] = stripLargeImagePayloads(nested);
    }
  }
  return raw;
}

function requireRoboflowEnv() {
  const apiKey = env.ROBOFLOW_API_KEY?.trim();
  const apiUrl = env.ROBOFLOW_API_URL?.trim().replace(/\/+$/, "");
  const workspace = env.ROBOFLOW_WORKSPACE?.trim().replace(/^\/+|\/+$/g, "");
  const workflowId = env.ROBOFLOW_WORKFLOW_ID?.trim().replace(/^\/+|\/+$/g, "");
  if (!apiKey) throw new ApiError(503, "Roboflow API key is not configured");
  if (!apiUrl) throw new ApiError(503, "ROBOFLOW_API_URL is not configured");
  if (!workspace) throw new ApiError(503, "ROBOFLOW_WORKSPACE is not configured");
  if (!workflowId) throw new ApiError(503, "ROBOFLOW_WORKFLOW_ID is not configured");
  const path = `/infer/workflows/${encodeURIComponent(workspace)}/${encodeURIComponent(workflowId)}`;
  return {
    apiKey,
    endpoint: `${apiUrl}${path}?api_key=${encodeURIComponent(apiKey)}`,
    safeEndpoint: `${apiUrl}${path}?api_key=[redacted]`,
  };
}

async function runRoboflowWorkflow(frame: { buffer: Buffer; mimeType: string }) {
  const roboflow = requireRoboflowEnv();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const imageValue = `data:image/jpeg;base64,${frame.buffer.toString("base64")}`;
      const body = JSON.stringify({
        api_key: roboflow.apiKey,
        inputs: {
          image: {
            type: "base64",
            value: imageValue,
          },
        },
      });

      if (env.NODE_ENV !== "production") {
        console.log("[proctoring] Roboflow request URL:", roboflow.safeEndpoint);
        console.log("[proctoring] Image buffer size:", frame.buffer.byteLength);
      }

      const response = await fetch(roboflow.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      if (env.NODE_ENV !== "production") {
        console.log("[proctoring] Roboflow response status:", response.status);
      }
      if (!response.ok) {
        if (env.NODE_ENV !== "production") {
          console.log("[proctoring] Roboflow error response text:", text);
        }
        throw new ApiError(response.status, `Roboflow workflow failed (${response.status})`, {
          bodySnippet: text.slice(0, 300),
        });
      }
      const result = text ? stripLargeImagePayloads(JSON.parse(text)) : null;
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(500 + attempt * 750);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(502, "Roboflow workflow request failed");
}

function logDetectionDetails(predictions: Prediction[], frameSize?: { width: number; height: number } | null) {
  for (const prediction of predictions) {
    const className = getPredictionClass(prediction) || "unknown";
    const confidence = getConfidence(prediction);
    const box = getBoxDimensions(prediction, frameSize);
    const areaRatio = getAreaRatio(prediction, frameSize);
    console.info("[proctoring] Roboflow detection", {
      className,
      confidence,
      boxWidth: box.width || null,
      boxHeight: box.height || null,
      frameWidth: frameSize?.width ?? null,
      frameHeight: frameSize?.height ?? null,
      areaPercentage: areaRatio === null ? null : Number((areaRatio * 100).toFixed(2)),
    });
  }
}

function analyzePredictions(predictions: Prediction[], frameSize?: { width: number; height: number } | null) {
  const phoneClasses = new Set(["cell phone", "mobile phone", "phone", "cellphone", "mobile"]);
  if (!Array.isArray(predictions)) {
    return { violation: false, reason: "", personCount: 0, noCandidate: false };
  }

  const filteredPersons = predictions.filter((prediction) => {
    const className = getPredictionClass(prediction);
    const confidence = getConfidence(prediction);
    const areaRatio = getAreaRatio(prediction, frameSize);
    return (
      (className === "person" || className === "people") &&
      confidence >= PERSON_CONFIDENCE &&
      areaRatio !== null &&
      areaRatio >= MIN_PERSON_AREA_RATIO
    );
  });

  const hasPhone = predictions.some((prediction) => {
    const className = getPredictionClass(prediction);
    const areaRatio = getAreaRatio(prediction, frameSize);
    return (
      phoneClasses.has(className) &&
      getConfidence(prediction) >= PHONE_CONFIDENCE &&
      (areaRatio === null || areaRatio >= MIN_PHONE_AREA_RATIO)
    );
  });

  const reasons: MonitoringReason[] = [];
  if (filteredPersons.length >= 2) reasons.push("Multiple persons detected.");
  if (hasPhone) reasons.push("Mobile phone detected.");

  return {
    violation: reasons.length > 0,
    reason: reasons.join(" "),
    personCount: filteredPersons.length,
    noCandidate: filteredPersons.length === 0,
  };
}

function createDebugInfo(workflowResult: unknown, predictions: Prediction[]): ProctoringDebugInfo | undefined {
  if (env.NODE_ENV === "production") return undefined;
  return {
    rawPredictionCount: collectNestedPredictions(workflowResult).length,
    parsedPredictionCount: predictions.length,
    detectedClasses: Array.from(new Set(predictions.map(getPredictionClass).filter(Boolean))),
  };
}

function withDebug<T extends Record<string, unknown>>(payload: T, debug?: ProctoringDebugInfo): T & { debug?: ProctoringDebugInfo } {
  if (!debug) return payload;
  return { ...payload, debug };
}

async function getInterviewForMonitoring(interviewId: number, userId: number) {
  const rows = await query<InterviewMonitorRow[]>(
    "SELECT id, user_id, status, warning_count FROM interviews WHERE id = ? LIMIT 1",
    [interviewId]
  );
  const interview = rows[0];
  if (!interview) throw new ApiError(404, "Interview not found");
  if (interview.user_id !== userId) throw new ApiError(403, "Forbidden");
  return interview;
}

function warningMessageFor(count: number) {
  if (count <= 1) return WARNING_MESSAGES[0];
  if (count === 2) return WARNING_MESSAGES[1];
  return WARNING_MESSAGES[2];
}

export async function checkProctoringFrame(params: {
  userId: number;
  interviewId: number;
  frame: unknown;
}) {
  const banStatus = await getUserBanStatus(params.userId);
  if (banStatus.banned) {
    return {
      violation: true,
      warningCount: 0,
      banned: true,
      reason: banStatus.banReason || "Monitoring ban active.",
      message: banStatus.message || BAN_MESSAGE,
    };
  }

  const interview = await getInterviewForMonitoring(params.interviewId, params.userId);
  if (interview.status === "COMPLETED") {
    return {
      violation: false,
      warningCount: interview.warning_count ?? 0,
      banned: false,
      reason: "",
      message: "Interview is already completed.",
    };
  }

  const normalizedFrame = normalizeFrameToBuffer(params.frame);
  const workflowResult = await runRoboflowWorkflow(normalizedFrame);
  const predictions = extractPredictions(workflowResult);
  const debug = createDebugInfo(workflowResult, predictions);
  logDetectionDetails(predictions, normalizedFrame.frameSize);
  if (env.NODE_ENV !== "production") {
    console.log(
      "PARSED PREDICTIONS:",
      JSON.stringify(predictions, null, 2)
    );
  }
  const detection = analyzePredictions(predictions, normalizedFrame.frameSize);
  const state = stateByInterview.get(interview.id) ?? {
    lastCountedWarningAt: 0,
    consecutiveViolationKey: "",
    consecutiveViolationCount: 0,
    consecutiveNoCandidateCount: 0,
  };

  if (!detection.violation) {
    state.consecutiveViolationKey = "";
    state.consecutiveViolationCount = 0;
    state.consecutiveNoCandidateCount = detection.noCandidate ? state.consecutiveNoCandidateCount + 1 : 0;
    stateByInterview.set(interview.id, state);
    if (state.consecutiveNoCandidateCount >= NO_CANDIDATE_NOTICE_CHECKS) {
      return withDebug({
        violation: false,
        warningCount: interview.warning_count ?? 0,
        banned: false,
        reason: "No candidate detected.",
        message: "No candidate detected. Please stay visible in the camera frame.",
      }, debug);
    }
    return withDebug({
      violation: false,
      warningCount: interview.warning_count ?? 0,
      banned: false,
      reason: "",
      message: "",
    }, debug);
  }

  state.consecutiveNoCandidateCount = 0;
  if (state.consecutiveViolationKey === detection.reason) {
    state.consecutiveViolationCount += 1;
  } else {
    state.consecutiveViolationKey = detection.reason;
    state.consecutiveViolationCount = 1;
  }
  stateByInterview.set(interview.id, state);

  if (state.consecutiveViolationCount < CONSECUTIVE_VIOLATION_CHECKS) {
    return withDebug({
      violation: true,
      warningCount: interview.warning_count ?? 0,
      banned: false,
      reason: detection.reason,
      message: "",
    }, debug);
  }

  const now = Date.now();
  if (now - state.lastCountedWarningAt < WARNING_COOLDOWN_MS) {
    return withDebug({
      violation: true,
      warningCount: interview.warning_count ?? 0,
      banned: false,
      reason: detection.reason,
      message: "",
    }, debug);
  }

  state.lastCountedWarningAt = now;
  state.consecutiveViolationCount = 0;
  state.consecutiveViolationKey = "";
  stateByInterview.set(interview.id, state);
  const warningCount = (interview.warning_count ?? 0) + 1;
  await exec("UPDATE interviews SET warning_count = ? WHERE id = ?", [warningCount, interview.id]);

  if (warningCount >= BAN_WARNING_THRESHOLD) {
    await exec("UPDATE interviews SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?", [interview.id]);
    await banUserForMonitoringViolation(params.userId, detection.reason || "Repeated monitoring violations.");
    stateByInterview.delete(interview.id);
    return withDebug({
      violation: true,
      warningCount,
      banned: true,
      reason: detection.reason,
      message: BAN_MESSAGE,
    }, debug);
  }

  return withDebug({
    violation: true,
    warningCount,
    banned: false,
    reason: detection.reason,
    message: warningMessageFor(warningCount),
  }, debug);
}
