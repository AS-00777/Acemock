import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import CodingEditor from "../components/CodingEditor";
import { api, ApiError } from "../services/api";
import { toastError, toastInfo } from "../services/toast";
import { useAuth } from "../context/AuthContext";
import { Icons } from "../constants";

type QuestionType = "theory" | "coding" | "code" | "sql" | "mcq" | "practical" | "scenario";
type Difficulty = "easy" | "medium" | "hard";

type InterviewDetailsResponse = {
  interview: {
    id: number;
    role: string;
    experience: string;
    personality: string;
    followUpCount: number;
    difficulty: string | null;
    techStack: any;
    status: "IN_PROGRESS" | "COMPLETED";
    questions: Array<{
      id: number;
      questionText: string;
      type: QuestionType;
      difficulty?: string | null;
      testCases?: CodingTestCase[];
      skill?: string | null;
      language?: string | null;
      starterCode?: string | null;
      constraints?: string[];
      expectedOutput?: string | null;
      evaluationType?: string | null;
      canRunCode?: boolean;
      options?: string[];
      answers: Array<{
        id: number;
        answerText: string;
        followUpQuestion?: string | null;
        followUpAnswer?: string | null;
        interviewerReaction?: string | null;
        code: string | null;
        language: string | null;
        score: number | null;
        rating: "Poor" | "Average" | "Good" | "Excellent" | null;
        feedback: string | null;
        createdAt: string;
      }>;
    }>;
    result: null | { overallScore: number; summary: string };
  };
};

type QuestionResponse = {
  question: {
    id: number;
    questionText: string;
    type: QuestionType;
    difficulty?: string | null;
    testCases?: CodingTestCase[];
    skill?: string | null;
    language?: string | null;
    starterCode?: string | null;
    constraints?: string[];
    expectedOutput?: string | null;
    evaluationType?: string | null;
    canRunCode?: boolean;
    options?: string[];
  };
};
type CompleteResponse = { result: { id: number; interviewId: number; overallScore: number; summary: string; createdAt: string } };
type CodingTestCase = {
  input: unknown;
  expectedOutput?: unknown;
  expected?: unknown;
  output?: unknown;
};
type RunCodeCaseResult = {
  input: unknown;
  expected: unknown;
  actual?: unknown;
  passed: boolean;
  error?: string;
};
type RunCodeResponse = {
  ok: boolean;
  message: string;
  passed: number;
  total: number;
  results: RunCodeCaseResult[];
};
type ProctoringResponse = {
  violation: boolean;
  warningCount: number;
  banned: boolean;
  reason: string;
  message: string;
};

type ProctoringToastStyle = {
  icon: string;
  label: string;
  className: string;
};

type ProctoringToastState = {
  id: number;
  message: string;
  style: ProctoringToastStyle;
};

type AnswerResponse = {
  answer: {
    id: number;
    questionId: number;
    answerText: string;
    score: number | null;
    rating: "Poor" | "Average" | "Good" | "Excellent" | null;
    feedback: string | null;
    createdAt: string;
  };
  evaluation: null | { score: number; rating: "Poor" | "Average" | "Good" | "Excellent"; feedback: string; correct?: boolean };
};

type AudioAnswerResponse = {
  success: boolean;
  message: string;
  audioReceived: boolean;
  answerId: number;
  audioFilePath: string;
  audioStatus: "uploaded" | "pending_transcription" | "transcribed" | "failed";
  transcript: string;
  rawTranscript?: string;
  correctedTranscript?: string;
  transcriptionEngine: "whisper" | "placeholder" | null;
};
type FollowUpResponse = {
  followUpNeeded: boolean;
  reason: string;
  interviewerReaction: string;
  followUpQuestion: string | null;
};

type CurrentQuestion = {
  id: number;
  text: string;
  type: QuestionType;
  difficulty: Difficulty | null;
  testCases?: CodingTestCase[];
  skill?: string | null;
  language?: string | null;
  starterCode?: string | null;
  constraints?: string[];
  expectedOutput?: string | null;
  evaluationType?: string | null;
  canRunCode?: boolean;
  options?: string[];
};

function isCodeAnswerQuestion(question: CurrentQuestion | null) {
  if (!question) return false;
  return question.type === "coding" || question.type === "code" || question.type === "sql" || question.type === "practical";
}

type TranscriptItem = {
  questionId: number;
  questionText: string;
  type: QuestionType;
  answerText: string;
  code?: string;
  language?: string;
  score10?: number; // 0-10
  rating?: "Poor" | "Average" | "Good" | "Excellent";
  feedback?: string;
};

const MAX_QUESTIONS = 10;
const THEORY_SECONDS = 3 * 60;
const CODING_SECONDS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 15 * 60,
  medium: 25 * 60,
  hard: 35 * 60,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isAllQuestionsAnsweredError(err: unknown) {
  return err instanceof ApiError && err.message.toLowerCase().includes("all interview questions");
}

function normalizeDifficulty(value: unknown): Difficulty {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "easy" || normalized === "medium" || normalized === "hard" ? normalized : "medium";
}

function normalizeQuestionDifficulty(value: unknown): Difficulty | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "easy" || normalized === "medium" || normalized === "hard" ? normalized : null;
}

function getQuestionTimerSeconds(question: CurrentQuestion | null, interviewDifficulty: Difficulty) {
  if (!question) return THEORY_SECONDS;
  const isRealPractical = question.type === "practical" && Boolean(question.constraints?.length && question.expectedOutput);
  if (question.type !== "coding" && !isRealPractical) return THEORY_SECONDS;
  return CODING_SECONDS_BY_DIFFICULTY[question.difficulty ?? interviewDifficulty];
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatRunValue(value: unknown) {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getProctoringToastStyle(warningCount: number, banned: boolean): ProctoringToastStyle {
  if (banned) {
    return {
      icon: "⛔",
      label: "Interview Stopped",
      className: "border-red-300 bg-red-600 text-white shadow-red-950/25",
    };
  }

  if (warningCount >= 3) {
    return {
      icon: "🚨",
      label: "Final Warning",
      className: "border-red-300 bg-red-600 text-white shadow-red-950/25",
    };
  }

  return {
    icon: "⚠️",
    label: `Warning ${Math.max(1, warningCount)}`,
    className: "border-amber-300 bg-amber-400 text-amber-950 shadow-amber-950/20",
  };
}

function getPrimaryProctoringReason(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("mobile") || normalized.includes("phone")) return "Mobile phone detected.";
  if (normalized.includes("multiple") || normalized.includes("person")) return "Multiple persons detected.";
  return reason.trim() || "Monitoring violation detected.";
}

function getProctoringDisplayMessage(reason: string, warningCount: number, banned: boolean) {
  if (banned) {
    return "⛔ Interview stopped due to repeated monitoring violations. You are banned for 3 hours.";
  }

  if (warningCount >= 3) {
    return "🚨 Final Warning: Continued violation will terminate your interview.";
  }

  const primaryReason = getPrimaryProctoringReason(reason);
  if (primaryReason === "Mobile phone detected.") {
    return `⚠️ Warning ${warningCount}: Mobile phone detected. Please do not use mobile phone during the interview.`;
  }
  if (primaryReason === "Multiple persons detected.") {
    return `⚠️ Warning ${warningCount}: Multiple persons detected. Please ensure you are alone.`;
  }
  return `⚠️ Warning ${warningCount}: ${primaryReason} Please follow the interview monitoring rules.`;
}

function getProctoringVoiceMessage(reason: string, warningCount: number, banned: boolean) {
  if (banned) {
    return "Interview stopped due to repeated monitoring violations. You are banned for three hours.";
  }
  if (warningCount >= 3) {
    return "Final warning. If this violation continues, your interview will be terminated.";
  }

  const primaryReason = getPrimaryProctoringReason(reason);
  if (primaryReason === "Mobile phone detected.") {
    return "Please do not use mobile phone while giving the interview.";
  }
  if (primaryReason === "Multiple persons detected.") {
    return "Another person is detected. Please ensure you are alone during the interview.";
  }
  return "Monitoring warning. Please follow the interview rules.";
}

function speakProctoringWarning(message: string) {
  if (!message.trim()) return;
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function debugInterview(...args: unknown[]) {
  if (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    console.debug("[InterviewSession]", ...args);
  }
}

function appendUniqueTranscript(current: string, next: string) {
  const clean = next.replace(/\s+/g, " ").trim();
  if (!clean) return current.trim();
  const base = current.replace(/\s+/g, " ").trim();
  if (!base) return clean;
  const baseLower = base.toLowerCase();
  const cleanLower = clean.toLowerCase();
  if (baseLower.endsWith(cleanLower)) return base;
  return `${base} ${clean}`.trim();
}

export default function InterviewSession() {
  const navigate = useNavigate();
  const { id } = useParams();
  const interviewId = Number(id);
  const { profile, logout } = useAuth();

  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(MAX_QUESTIONS);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [interviewDifficulty, setInterviewDifficulty] = useState<Difficulty>("medium");

  const [timeLeft, setTimeLeft] = useState(THEORY_SECONDS);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isQuestionSpeaking, setIsQuestionSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [interviewerReaction, setInterviewerReaction] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [isFollowUpActive, setIsFollowUpActive] = useState(false);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [runCodeResult, setRunCodeResult] = useState<RunCodeResponse | null>(null);

  const [busy, setBusy] = useState<null | "initial" | "saving" | "completing">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedQuestionId, setSavedQuestionId] = useState<number | null>(null);
  const [savedAnswerId, setSavedAnswerId] = useState<number | null>(null);
  const [proctoringToast, setProctoringToast] = useState<ProctoringToastState | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const answerAudioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const recognitionShouldRestartRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const lastFinalTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);
  const isRecordingPausedRef = useRef(false);
  const micEnabledRef = useRef(true);
  const completeRequestedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const codeInitializedQuestionRef = useRef<number | null>(null);
  const codeTouchedQuestionRef = useRef<number | null>(null);
  const proctoringInFlightRef = useRef(false);
  const terminatedByProctoringRef = useRef(false);
  const proctoringToastTimerRef = useRef<number | null>(null);
  const speechCompletionRef = useRef<(() => void) | null>(null);
  const speechSequenceRef = useRef(0);
  const transitionIndexRef = useRef(0);
  const followUpRequestedQuestionRef = useRef<number | null>(null);
  const followUpRequestInFlightRef = useRef(false);
  const spokenFollowUpRef = useRef<string>("");

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    isRecordingPausedRef.current = isRecordingPaused;
  }, [isRecordingPaused]);
  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopAnswerAudioTracks = useCallback(() => {
    answerAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
    answerAudioStreamRef.current = null;
  }, []);

  const resetRecordingState = useCallback(() => {
    stopRecordingTimer();
    setIsRecording(false);
    setIsRecordingPaused(false);
    isRecordingRef.current = false;
    isRecordingPausedRef.current = false;
    setRecordingSeconds(0);
  }, [stopRecordingTimer]);

  useEffect(() => {
    if (!currentQuestion) return;
    if (codeInitializedQuestionRef.current === currentQuestion.id) return;
    codeInitializedQuestionRef.current = currentQuestion.id;
    setRunCodeResult(null);

    if (!isCodeAnswerQuestion(currentQuestion)) {
      setCode("");
      return;
    }

    const context = `${currentQuestion.skill ?? ""} ${currentQuestion.text}`;
    const questionLanguage = currentQuestion.language?.trim() || (/\bsql\b|query/i.test(context) ? "SQL" : /html|css|frontend|component/i.test(context) ? "HTML" : "TypeScript");
    setLanguage(questionLanguage);
    setCode((prev) =>
      codeTouchedQuestionRef.current === currentQuestion.id && prev.trim()
        ? prev
        : currentQuestion.starterCode || ""
    );
  }, [currentQuestion?.id, currentQuestion?.type]);

  const attachVideoStream = useCallback(() => {
    const stream = streamRef.current;
    const el = videoElRef.current;
    if (!stream || !el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, []);

  const ensureMediaStream = useCallback(async () => {
    if (streamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    streamRef.current = stream;
    attachVideoStream();
  }, [attachVideoStream]);

  const stopMediaTracks = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoElRef.current) videoElRef.current.srcObject = null;
  }, []);

  const cleanupInterviewMedia = useCallback(() => {
    recognitionShouldRestartRef.current = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speechCompletionRef.current?.();
    speechCompletionRef.current = null;
    setIsQuestionSpeaking(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;
    stopRecordingTimer();
    setIsRecording(false);
    setIsRecordingPaused(false);
    isRecordingRef.current = false;
    isRecordingPausedRef.current = false;
    setRecordingSeconds(0);
    stopAnswerAudioTracks();
    stopMediaTracks();
  }, [stopAnswerAudioTracks, stopMediaTracks, stopRecordingTimer]);

  const resetAnswerDraft = useCallback(() => {
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    lastFinalTranscriptRef.current = "";
    audioChunksRef.current = [];
    setAnswerText("");
    setInterimTranscript("");
    setSelectedOption("");
    setError(null);
  }, []);

  const captureMonitoringFrame = useCallback(() => {
    const video = videoElRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    if (!video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    const width = 640;
    const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.65);
  }, []);

  const showProctoringWarning = useCallback((result: ProctoringResponse) => {
    const warningIssued = Boolean(result.message || result.banned);
    if (!warningIssued) return;

    const message = getProctoringDisplayMessage(result.reason, result.warningCount, result.banned);
    const voiceMessage = getProctoringVoiceMessage(result.reason, result.warningCount, result.banned);
    setProctoringToast({
      id: Date.now(),
      message,
      style: getProctoringToastStyle(result.warningCount, result.banned),
    });

    if (proctoringToastTimerRef.current) {
      window.clearTimeout(proctoringToastTimerRef.current);
    }
    proctoringToastTimerRef.current = window.setTimeout(() => {
      setProctoringToast(null);
      proctoringToastTimerRef.current = null;
    }, 5000);

    speakProctoringWarning(voiceMessage);
  }, []);

  const stopForProctoringBan = useCallback((result: ProctoringResponse) => {
    terminatedByProctoringRef.current = true;
    completeRequestedRef.current = true;
    setIsTimerActive(false);
    cleanupInterviewMedia();
    showProctoringWarning(result);
    window.setTimeout(() => navigate("/dashboard"), 1200);
  }, [cleanupInterviewMedia, navigate, showProctoringWarning]);

  useEffect(() => {
    // init: speech recognition + getUserMedia (once)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event: any) => {
        let interimText = "";
        let finalText = finalTranscriptRef.current;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const part = String(event.results[i][0].transcript || "").trim();
          if (!part) continue;
          if (event.results[i].isFinal) {
            const resultKey = `${i}:${part.toLowerCase()}`;
            if (lastFinalTranscriptRef.current !== resultKey) {
              finalText = appendUniqueTranscript(finalText, part);
              lastFinalTranscriptRef.current = resultKey;
            }
          } else {
            interimText = `${interimText} ${part}`.trim();
          }
        }
        finalTranscriptRef.current = finalText;
        interimTranscriptRef.current = interimText;
        setAnswerText(finalText);
        setInterimTranscript(interimText);
        debugInterview("transcript updated", { finalLength: finalText.length, interimLength: interimText.length });
      };
      rec.onerror = (event: any) => {
        const type = String(event?.error || "");
        debugInterview("recognition error", type);
        if (type === "no-speech") {
          setError("We could not hear you clearly. Please try again.");
          return;
        }
        if (type === "audio-capture") {
          recognitionShouldRestartRef.current = false;
          setError("Voice capture is unavailable. Please allow microphone access and try again.");
          return;
        }
        if (type === "not-allowed" || type === "service-not-allowed") {
          recognitionShouldRestartRef.current = false;
          setError("Voice capture is unavailable. Please allow microphone access and try again.");
          return;
        }
        if (type === "network") {
          recognitionShouldRestartRef.current = false;
          setError("Voice capture is unavailable. Please allow microphone access and try again.");
        }
      };
      rec.onend = () => {
        debugInterview("recognition ended");
        if (recognitionShouldRestartRef.current && isRecordingRef.current && !isRecordingPausedRef.current && micEnabledRef.current) {
          try {
            rec.start();
          } catch {}
        }
      };
      recognitionRef.current = rec;
    }

    ensureMediaStream().catch((e) => {
      console.error("Media access error:", e);
      setError("Voice capture is unavailable. Please allow microphone access and try again.");
    });

    return () => {
      if (proctoringToastTimerRef.current) window.clearTimeout(proctoringToastTimerRef.current);
      cleanupInterviewMedia();
    };
  }, [cleanupInterviewMedia, ensureMediaStream]);

  useEffect(() => {
    // Persist stream across re-renders; re-attach whenever the video element exists.
    attachVideoStream();
  });

  useEffect(() => {
    const cleanup = () => cleanupInterviewMedia();
    window.addEventListener("pagehide", cleanup);
    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("pagehide", cleanup);
      window.removeEventListener("beforeunload", cleanup);
    };
  }, [cleanupInterviewMedia]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = cameraEnabled));
  }, [cameraEnabled]);

  useEffect(() => {
    if (!Number.isFinite(interviewId) || interviewId <= 0) return;
    if (!currentQuestion) return;
    if (busy === "initial" || busy === "completing") return;
    if (!cameraEnabled) return;

    const runCheck = async () => {
      if (proctoringInFlightRef.current || terminatedByProctoringRef.current) return;
      const frame = captureMonitoringFrame();
      if (!frame) return;

      proctoringInFlightRef.current = true;
      try {
        const result = await api.post<ProctoringResponse>("/proctoring/check-frame", {
          interviewId,
          frame,
        });

        if (result.banned) {
          stopForProctoringBan(result);
          return;
        }

        if (result.message) {
          showProctoringWarning(result);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        // Proctoring is important, but a transient network/model error should not freeze the interview UI.
        console.warn("Proctoring check failed", err);
      } finally {
        proctoringInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(runCheck, 2000);
    runCheck();
    return () => window.clearInterval(interval);
  }, [
    busy,
    cameraEnabled,
    captureMonitoringFrame,
    currentQuestion,
    interviewId,
    logout,
    showProctoringWarning,
    stopForProctoringBan,
  ]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
    if (!micEnabled && isRecording) {
      recognitionShouldRestartRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {}
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      stopAnswerAudioTracks();
      resetRecordingState();
    }
  }, [micEnabled, isRecording, resetRecordingState, stopAnswerAudioTracks]);

  const speakQuestion = useCallback(
    (text: string) => {
      if (!voiceEnabled) return;
      if (!window.speechSynthesis) return;
      const t = text.trim();
      if (!t) return;
      speechSequenceRef.current += 1;
      speechCompletionRef.current?.();
      speechCompletionRef.current = null;
      window.speechSynthesis.cancel();
      setIsQuestionSpeaking(true);
      const msg = new SpeechSynthesisUtterance(t);
      msg.rate = 0.95;
      msg.onstart = () => setIsQuestionSpeaking(true);
      msg.onend = () => setIsQuestionSpeaking(false);
      msg.onerror = () => setIsQuestionSpeaking(false);
      const voices = window.speechSynthesis.getVoices();
      const pref = profile?.voicePreference || "female";
      const filtered = voices.filter((v) => {
        const name = v.name.toLowerCase();
        return pref === "male"
          ? name.includes("male") || name.includes("guy") || name.includes("daniel")
          : name.includes("female") || name.includes("samantha") || name.includes("google us english");
      });
      msg.voice = filtered.length > 0 ? filtered[0] : voices[0];
      window.speechSynthesis.speak(msg);
    },
    [profile?.voicePreference, voiceEnabled]
  );

  const speakInterviewerTurn = useCallback((reaction: string, followUp?: string | null): Promise<void> => {
    if (!voiceEnabled || !window.speechSynthesis) return Promise.resolve();
    const sequence = ++speechSequenceRef.current;
    speechCompletionRef.current?.();
    speechCompletionRef.current = null;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const pref = profile?.voicePreference || "female";
    const voice = voices.find((v) => pref === "male"
      ? /male|guy|daniel/i.test(v.name)
      : /female|samantha|google us english/i.test(v.name)) || voices[0];
    const speakPart = (text: string) => new Promise<void>((resolve) => {
      speechCompletionRef.current = resolve;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.voice = voice;
      utterance.onstart = () => setIsQuestionSpeaking(true);
      const finish = () => { setIsQuestionSpeaking(false); speechCompletionRef.current = null; resolve(); };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
    return (async () => {
      if (reaction.trim()) await speakPart(reaction);
      if (followUp?.trim() && sequence === speechSequenceRef.current) await speakPart(followUp);
    })();
  }, [profile?.voicePreference, voiceEnabled]);

  useEffect(() => {
    const text = currentQuestion?.text ?? "";
    if (!voiceEnabled) return;
    if (!text.trim()) return;
    if (busy) return;
    if (isFollowUpActive) return;
    speakQuestion(text);
  }, [busy, currentQuestion?.id, currentQuestion?.text, isFollowUpActive, speakQuestion, voiceEnabled]);

  useEffect(() => {
    if (!isTimerActive) return;
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [isTimerActive, timeLeft]);

  const startAnswerRecording = useCallback(async () => {
    if (!currentQuestion || busy || isRecording) return;
    if (!micEnabled) {
      setError("Microphone is turned off. Enable it before starting your answer.");
      return;
    }
    if (isQuestionSpeaking || window.speechSynthesis?.speaking) {
      setError("Wait for the AI to finish speaking before starting your answer.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice capture is unavailable. Please allow microphone access and try again.");
      return;
    }
    if (!recognitionRef.current) {
      setError("Voice capture is unavailable. Please allow microphone access and try again.");
      return;
    }

    setError(null);
    finalTranscriptRef.current = answerText.trim();
    interimTranscriptRef.current = "";
    setInterimTranscript("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== "live") {
        throw new Error("No active microphone track was found.");
      }
      answerAudioStreamRef.current = stream;

      if (typeof MediaRecorder !== "undefined") {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (event) => {
          if (!isRecordingPausedRef.current && event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onerror = () => {
          mediaRecorderRef.current = null;
          setError("Audio recording failed, but transcript capture can continue.");
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      } else {
        mediaRecorderRef.current = null;
        setError("Audio recording is not supported in this browser. Voice transcript capture will still be attempted.");
      }

      try {
        if (recognitionRef.current) {
          recognitionShouldRestartRef.current = true;
          recognitionRef.current.onend = () => {
            debugInterview("recognition ended");
            if (recognitionShouldRestartRef.current && isRecordingRef.current && !isRecordingPausedRef.current && micEnabledRef.current) {
              try {
                recognitionRef.current?.start();
              } catch {}
            }
          };
          recognitionRef.current.start();
          debugInterview("recognition started");
        }
      } catch {
        recognitionShouldRestartRef.current = false;
        setError("Voice capture is unavailable. Please allow microphone access and try again.");
      }

      setIsRecording(true);
      isRecordingRef.current = true;
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
      if (!isTimerActive) setIsTimerActive(true);
    } catch (err: any) {
      stopAnswerAudioTracks();
      resetRecordingState();
      const denied =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError" ||
        err?.name === "SecurityError";
      const msg = denied
        ? "Voice capture is unavailable. Please allow microphone access and try again."
        : "Could not start microphone recording. Please check your mic and try again.";
      setError(msg);
      toastError(msg);
    }
  }, [
    busy,
    currentQuestion,
    isQuestionSpeaking,
    isRecording,
    isTimerActive,
    micEnabled,
    resetRecordingState,
    stopAnswerAudioTracks,
    answerText,
  ]);

  const stopAnswerRecording = useCallback(async () => {
    stopRecordingTimer();
    recognitionShouldRestartRef.current = false;
    try {
      if (recognitionRef.current) recognitionRef.current.onend = null;
      recognitionRef.current?.stop();
    } catch {}

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      mediaRecorderRef.current = null;
      resetRecordingState();
      stopAnswerAudioTracks();
      return new Blob(audioChunksRef.current, { type: "audio/webm" });
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      recorder.onerror = () => reject(new Error("Recording failed."));
      try {
        if (recorder.state === "recording" && typeof recorder.requestData === "function") recorder.requestData();
        recorder.stop();
      } catch (err) {
        reject(err);
      }
    });

    mediaRecorderRef.current = null;
    resetRecordingState();
    stopAnswerAudioTracks();
    return blob;
  }, [resetRecordingState, stopAnswerAudioTracks, stopRecordingTimer]);

  const pauseAnswerRecording = useCallback(() => {
    if (!isRecording || isRecordingPaused) return;
    const recorder = mediaRecorderRef.current;
    recognitionShouldRestartRef.current = false;
    isRecordingPausedRef.current = true;
    setIsRecordingPaused(true);
    stopRecordingTimer();
    try {
      recognitionRef.current?.stop();
    } catch {}
    try {
      if (recorder?.state === "recording" && typeof recorder.pause === "function") recorder.pause();
    } catch {}
  }, [isRecording, isRecordingPaused, stopRecordingTimer]);

  const resumeAnswerRecording = useCallback(() => {
    if (!isRecording || !isRecordingPaused) return;
    const recorder = mediaRecorderRef.current;
    isRecordingPausedRef.current = false;
    setIsRecordingPaused(false);
    try {
      if (recorder?.state === "paused" && typeof recorder.resume === "function") recorder.resume();
    } catch {}
    try {
      recognitionShouldRestartRef.current = true;
      if (recognitionRef.current) {
        recognitionRef.current.onend = () => {
          debugInterview("recognition ended");
          if (recognitionShouldRestartRef.current && isRecordingRef.current && !isRecordingPausedRef.current && micEnabledRef.current) {
            try {
              recognitionRef.current?.start();
            } catch {}
          }
        };
      }
      recognitionRef.current?.start();
      debugInterview("recognition started");
    } catch {}
    if (recordingTimerRef.current === null) {
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    }
  }, [isRecording, isRecordingPaused]);

  const uploadAudioAnswer = useCallback(
    async (audioBlob: Blob, answerId: number) => {
      if (!currentQuestion) throw new Error("No question is active.");
      if (!audioBlob.size) throw new Error("No audio captured. Please record your answer again.");

      const form = new FormData();
      form.append("audio", audioBlob, `answer-${interviewId}-${currentQuestion.id}.webm`);
      form.append("interviewId", String(interviewId));
      form.append("sessionId", String(interviewId));
      form.append("questionId", String(currentQuestion.id));
      form.append("answerId", String(answerId));
      form.append("questionText", currentQuestion.text);

      return api.postForm<AudioAnswerResponse>("/interview/answers/audio", form);
    },
    [currentQuestion, interviewId]
  );

  const clearInputs = useCallback(() => {
    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      stopAnswerAudioTracks();
      resetRecordingState();
    }
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    audioChunksRef.current = [];
    setAnswerText("");
    setSelectedOption("");
    setInterimTranscript("");
    setCode("");
    setRunCodeResult(null);
  }, [isRecording, resetRecordingState, stopAnswerAudioTracks]);

  const handleRunCode = useCallback(async () => {
    if (!currentQuestion || currentQuestion.type !== "coding") return;
    if (isRunningCode) return;

    setIsRunningCode(true);
    setRunCodeResult(null);
    try {
      const result = await api.post<RunCodeResponse>(`/interview/${interviewId}/run-code`, {
        questionId: currentQuestion.id,
        code,
        language,
        testCases: currentQuestion.testCases ?? [],
      });
      setRunCodeResult(result);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      const msg = err?.message || "Failed to run code.";
      setRunCodeResult({
        ok: false,
        message: msg,
        passed: 0,
        total: 0,
        results: [],
      });
      toastError(msg);
    } finally {
      setIsRunningCode(false);
    }
  }, [code, currentQuestion, interviewId, isRunningCode, language, logout]);

  const completeInterview = useCallback(async () => {
    if (completeRequestedRef.current) return;
    completeRequestedRef.current = true;
    setBusy("completing");
    setError(null);
    try {
      await api.post<CompleteResponse>(`/interview/${interviewId}/complete`, {});
      cleanupInterviewMedia();
      navigate(`/result/${interviewId}`);
    } catch (err: any) {
      completeRequestedRef.current = false;
      if (err instanceof ApiError && err.status === 401) logout();
      const msg = err?.message || "Failed to generate final feedback.";
      setError(msg);
      toastError(msg);
      throw err;
    }
  }, [cleanupInterviewMedia, interviewId, logout, navigate]);

  const fetchNextQuestion = useCallback(
    async (nextNumber: number, difficultyOverride?: Difficulty) => {
      try {
        const q = await api.post<QuestionResponse>(`/interview/${interviewId}/question`, {});
        const nextQuestion: CurrentQuestion = {
          id: q.question.id,
          text: q.question.questionText,
          type: q.question.type,
          difficulty: normalizeQuestionDifficulty(q.question.difficulty),
          testCases: Array.isArray(q.question.testCases) ? q.question.testCases : undefined,
          skill: q.question.skill,
          language: q.question.language,
          starterCode: q.question.starterCode,
          constraints: q.question.constraints,
          expectedOutput: q.question.expectedOutput,
          evaluationType: q.question.evaluationType,
          canRunCode: q.question.canRunCode,
          options: q.question.options,
        };
        setCurrentQuestion(nextQuestion);
        setQuestionNumber(nextNumber);
        setTotalQuestions((prev) => Math.max(prev, nextNumber));
        setSavedQuestionId(null);
        setSavedAnswerId(null);
        resetAnswerDraft();
        followUpRequestedQuestionRef.current = null;
        followUpRequestInFlightRef.current = false;
        spokenFollowUpRef.current = "";
        setInterviewerReaction("");
        setFollowUpQuestion(null);
        setIsFollowUpActive(false);
        setTimeLeft(getQuestionTimerSeconds(nextQuestion, difficultyOverride ?? interviewDifficulty));
        setIsTimerActive(true);
      } catch (err) {
        if (isAllQuestionsAnsweredError(err)) {
          await completeInterview();
          return;
        }
        throw err;
      }
    },
    [completeInterview, interviewDifficulty, interviewId, resetAnswerDraft]
  );

  const loadOrGenerateQuestion = useCallback(async () => {
    const details = await api.get<InterviewDetailsResponse>(`/interview/${interviewId}`);
    if (details.interview.status === "COMPLETED") {
      navigate(`/result/${interviewId}`);
      return;
    }
    const nextInterviewDifficulty = normalizeDifficulty(details.interview.difficulty);
    setInterviewDifficulty(nextInterviewDifficulty);
    const knownTotal = details.interview.questions.length || MAX_QUESTIONS;
    setTotalQuestions(knownTotal);

    const answered: TranscriptItem[] = [];
    for (const q of details.interview.questions) {
      const a = q.answers[0];
      if (!a) continue;
      answered.push({
        questionId: q.id,
        questionText: q.questionText,
        type: q.type,
        answerText: a.answerText,
        code: a.code ?? undefined,
        language: a.language ?? undefined,
        score10: a.score === null ? undefined : a.score,
        rating: a.rating ?? undefined,
        feedback: a.feedback ?? undefined,
      });
    }
    setTranscript(answered);

    const outstandingFollowUpIndex = details.interview.questions.findIndex((q) => {
      const answer = q.answers[0];
      return Boolean(answer?.followUpQuestion && !answer.followUpAnswer);
    });
    if (outstandingFollowUpIndex >= 0) {
      const q = details.interview.questions[outstandingFollowUpIndex];
      const a = q.answers[0];
      const resumedQuestion: CurrentQuestion = {
        id: q.id, text: q.questionText, type: q.type,
        difficulty: normalizeQuestionDifficulty(q.difficulty), testCases: q.testCases,
        skill: q.skill, language: q.language, starterCode: q.starterCode,
        constraints: q.constraints, expectedOutput: q.expectedOutput,
        evaluationType: q.evaluationType, canRunCode: q.canRunCode, options: q.options,
      };
      setCurrentQuestion(resumedQuestion);
      setQuestionNumber(outstandingFollowUpIndex + 1);
      resetAnswerDraft();
      setSavedQuestionId(q.id);
      setSavedAnswerId(a.id);
      followUpRequestedQuestionRef.current = q.id;
      spokenFollowUpRef.current = `${q.id}:${a.followUpQuestion || ""}`;
      setInterviewerReaction(a.interviewerReaction || "Okay, let's explore this a little further.");
      setFollowUpQuestion(a.followUpQuestion || null);
      setIsFollowUpActive(true);
      setTimeLeft(THEORY_SECONDS);
      setIsTimerActive(true);
      return;
    }

    const pendingIndex = details.interview.questions.findIndex((q) => q.answers.length === 0);
    const pending = pendingIndex >= 0 ? details.interview.questions[pendingIndex] : null;
    if (pending) {
      const pendingQuestion: CurrentQuestion = {
        id: pending.id,
        text: pending.questionText,
        type: pending.type,
        difficulty: normalizeQuestionDifficulty(pending.difficulty),
        testCases: Array.isArray(pending.testCases) ? pending.testCases : undefined,
        skill: pending.skill,
        language: pending.language,
        starterCode: pending.starterCode,
        constraints: pending.constraints,
        expectedOutput: pending.expectedOutput,
        evaluationType: pending.evaluationType,
        canRunCode: pending.canRunCode,
        options: pending.options,
      };
      setCurrentQuestion(pendingQuestion);
      setQuestionNumber(pendingIndex + 1);
      resetAnswerDraft();
      setSavedQuestionId(null);
      setSavedAnswerId(null);
      followUpRequestedQuestionRef.current = null;
      followUpRequestInFlightRef.current = false;
      spokenFollowUpRef.current = "";
      setTimeLeft(getQuestionTimerSeconds(pendingQuestion, nextInterviewDifficulty));
      setIsTimerActive(true);
      return;
    }

    if (details.interview.questions.length > 0) {
      await completeInterview();
      return;
    }

    const nextNumber = answered.length + 1;
    await fetchNextQuestion(nextNumber, nextInterviewDifficulty);
  }, [completeInterview, fetchNextQuestion, interviewId, navigate, resetAnswerDraft]);

  useEffect(() => {
    if (!Number.isFinite(interviewId) || interviewId <= 0) {
      navigate("/interview-form");
      return;
    }
    setBusy("initial");
    loadOrGenerateQuestion()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout();
        navigate("/dashboard");
      })
      .finally(() => {
        if (!completeRequestedRef.current) setBusy(null);
      });
  }, [interviewId, loadOrGenerateQuestion, logout, navigate]);

  const handleFinishEarly = useCallback(() => {
    cleanupInterviewMedia();
    navigate("/dashboard");
  }, [cleanupInterviewMedia, navigate]);

  const getFinalVerbalAnswer = useCallback(() => {
    const stateText = answerText.trim();
    const finalText = finalTranscriptRef.current.trim();
    const base = stateText.length >= finalText.length ? stateText : finalText;
    const latestInterim = (interimTranscriptRef.current || interimTranscript).trim();
    if (!latestInterim || base.includes(latestInterim)) return base.trim();
    return `${base} ${latestInterim}`.trim();
  }, [answerText, interimTranscript]);

  const submitAndNext = useCallback(async (
    mode: "manual" | "auto" = "manual",
    options: { audioBlob?: Blob } = {}
  ) => {
    if (!currentQuestion) return;
    if (busy) return;
    if (submitInFlightRef.current) return;
    if (mode === "manual" && (isQuestionSpeaking || window.speechSynthesis?.speaking)) {
      setError("Please wait for the AI interviewer to finish speaking.");
      return;
    }
    submitInFlightRef.current = true;

    if (currentQuestion.type === "mcq" && !selectedOption && mode === "manual") {
      const msg = "Select an option before submitting.";
      setError(msg);
      toastError(msg);
      submitInFlightRef.current = false;
      return;
    }

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsQuestionSpeaking(false);
    const answerBeforeStopping = getFinalVerbalAnswer();
    let audioBlob = options.audioBlob;
    if (isRecording && !audioBlob) {
      try {
        audioBlob = await stopAnswerRecording();
      } catch (err: any) {
        const fallbackAnswer = getFinalVerbalAnswer() || answerBeforeStopping;
        if (fallbackAnswer && !isCodeAnswerQuestion(currentQuestion) && currentQuestion.type !== "mcq") {
          audioBlob = undefined;
        } else {
          const msg = err?.message || "Recording failed. Please try again.";
          setError(msg);
          toastError(msg);
          submitInFlightRef.current = false;
          return;
        }
      }
    } else if (recognitionRef.current) {
      recognitionShouldRestartRef.current = false;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
      stopAnswerAudioTracks();
      resetRecordingState();
    }
    const finalVerbalAnswer = getFinalVerbalAnswer();
    if (!isCodeAnswerQuestion(currentQuestion) && currentQuestion.type !== "mcq" && !finalVerbalAnswer) {
      const msg = "No answer detected. Please speak again or type your answer.";
      setError(msg);
      toastError(msg);
      submitInFlightRef.current = false;
      return;
    }
    setIsTimerActive(false);
    const isLastQuestion = questionNumber >= totalQuestions;
    const nextTransition = () => {
      if (isLastQuestion) return "Thanks. That was the final question. I'm submitting your interview for evaluation.";
      const transitions = [
        "Alright, let's continue.",
        "Okay, moving ahead.",
        "Thanks for your answer. Let's go to the next one.",
        "Good, let's look at another question.",
        "Understood. Here is the next question.",
      ];
      const transition = transitions[transitionIndexRef.current % transitions.length];
      transitionIndexRef.current += 1;
      return transition;
    };

    if (isFollowUpActive) {
      const followUpAnswer = finalVerbalAnswer;
      if (!followUpAnswer) {
        const msg = "No answer detected. Please speak again or type your answer.";
        setError(msg);
        toastError(msg);
        submitInFlightRef.current = false;
        return;
      }
      setBusy("saving");
      setError(null);
      try {
        if (!savedAnswerId) throw new Error("The main answer could not be found.");
        await api.post(`/interview/${interviewId}/follow-up-answer`, {
          answerId: savedAnswerId,
          followUpAnswer,
          timeTakenSeconds: Math.max(0, THEORY_SECONDS - timeLeft),
        });
        setIsFollowUpActive(false);
        setFollowUpQuestion(null);
        resetAnswerDraft();
        if (isLastQuestion) {
          await speakInterviewerTurn(nextTransition());
          await completeInterview();
        }
        else await fetchNextQuestion(questionNumber + 1);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) logout();
        const msg = err?.message || "Failed to save the follow-up answer.";
        setError(msg);
        toastError(msg);
      } finally {
        if (!completeRequestedRef.current) submitInFlightRef.current = false;
        if (!completeRequestedRef.current) setBusy(null);
      }
      return;
    }

    if (savedQuestionId === currentQuestion.id) {
      setBusy("saving");
      setError(null);
      try {
        if (audioBlob) {
          if (!savedAnswerId) throw new Error("Saved answer was not found for audio upload.");
          try {
            await uploadAudioAnswer(audioBlob, savedAnswerId);
          } catch (audioErr) {
            console.warn("Audio upload failed after answer was saved", audioErr);
          }
        }
        if (isLastQuestion) {
          await speakInterviewerTurn(nextTransition());
          await completeInterview();
        } else {
          await fetchNextQuestion(questionNumber + 1);
        }
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) logout();
        const msg = err?.message || "Failed to load next question.";
        setError(msg);
        toastError(msg);
      } finally {
        if (!completeRequestedRef.current) submitInFlightRef.current = false;
        if (!completeRequestedRef.current) setBusy(null);
      }
      return;
    }

    const payload: any = {
      questionId: currentQuestion.id,
      timeTakenSeconds: Math.max(0, getQuestionTimerSeconds(currentQuestion, interviewDifficulty) - timeLeft),
    };
    if (isCodeAnswerQuestion(currentQuestion)) {
      const trimmedCode = code.trim();
      payload.code = trimmedCode || undefined;
      payload.language = language;
      payload.answerText = trimmedCode || "(No code submitted)";
    } else if (currentQuestion.type === "mcq") {
      payload.answerText = selectedOption || "(No selection)";
    } else {
      payload.answerText = finalVerbalAnswer;
    }

    setBusy("saving");
    setError(null);
    try {
      const answerResponse = await api.post<AnswerResponse>(`/interview/${interviewId}/answer`, payload);
      debugInterview("answer submitted", { questionId: currentQuestion.id, answerLength: String(payload.answerText || "").length });

      setSavedQuestionId(currentQuestion.id);
      setSavedAnswerId(answerResponse.answer.id);
      if (answerResponse.evaluation && currentQuestion.type === "mcq") {
        toastInfo(`${answerResponse.evaluation.correct ? "Correct." : "Incorrect."} ${answerResponse.evaluation.feedback}`, 5000);
      }

      let submittedAnswerText = payload.answerText ?? "";
      if (audioBlob) {
        try {
          const audioResponse = await uploadAudioAnswer(audioBlob, answerResponse.answer.id);
          const backendTranscript =
            audioResponse.correctedTranscript?.trim() ||
            audioResponse.transcript?.trim() ||
            audioResponse.rawTranscript?.trim();
          if (backendTranscript) submittedAnswerText = backendTranscript;
        } catch (audioErr) {
          console.warn("Audio upload failed; continuing with captured transcript", audioErr);
        }
      }

      setTranscript((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          questionText: currentQuestion.text,
          type: currentQuestion.type,
          answerText: submittedAnswerText,
          code: payload.code,
          language: payload.language,
        },
      ]);

      resetAnswerDraft();
      setCode("");
      setTimeLeft(getQuestionTimerSeconds(currentQuestion, interviewDifficulty));

      const answerForFollowUp = submittedAnswerText.trim();
      const eligibleType = currentQuestion.type === "theory" || currentQuestion.type === "scenario";
      const words = answerForFollowUp.split(/\s+/).filter(Boolean);
      const likelyNeedsCheck = words.length < 45 || /\b(i don'?t know|not sure|no idea|maybe|probably|something|stuff|it depends)\b/i.test(answerForFollowUp);
      if (mode !== "auto" && timeLeft > 0 && eligibleType && likelyNeedsCheck) {
        if (followUpRequestedQuestionRef.current === currentQuestion.id || followUpRequestInFlightRef.current) {
          const reaction = nextTransition();
          setInterviewerReaction(reaction);
          await speakInterviewerTurn(reaction);
          if (!isLastQuestion) await fetchNextQuestion(questionNumber + 1);
          else await completeInterview();
          return;
        }
        followUpRequestedQuestionRef.current = currentQuestion.id;
        followUpRequestInFlightRef.current = true;
        setIsGeneratingFollowUp(true);
        try {
          const decision = await api.post<FollowUpResponse>(`/interview/${interviewId}/follow-up`, {
            questionId: currentQuestion.id,
            answerId: answerResponse.answer.id,
            timerExpired: false,
          });
          setInterviewerReaction(decision.interviewerReaction);
          if (decision.followUpNeeded && decision.followUpQuestion) {
            setFollowUpQuestion(decision.followUpQuestion);
            setIsFollowUpActive(true);
            setAnswerText("");
            setTimeLeft(THEORY_SECONDS);
            setIsTimerActive(true);
            setBusy(null);
            setIsGeneratingFollowUp(false);
            const spokenKey = `${currentQuestion.id}:${decision.followUpQuestion}`;
            if (spokenFollowUpRef.current !== spokenKey) {
              spokenFollowUpRef.current = spokenKey;
              await speakInterviewerTurn(decision.interviewerReaction, decision.followUpQuestion);
            }
            return;
          }
          await speakInterviewerTurn(nextTransition());
        } catch {
          const fallback = nextTransition();
          setInterviewerReaction(fallback);
          await speakInterviewerTurn(fallback);
        } finally {
          followUpRequestInFlightRef.current = false;
          setIsGeneratingFollowUp(false);
        }
      } else {
        const reaction = nextTransition();
        setInterviewerReaction(reaction);
        await speakInterviewerTurn(reaction);
      }

      if (!isLastQuestion) {
        await fetchNextQuestion(questionNumber + 1);
      } else {
        await completeInterview();
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      const msg = err?.message || (audioBlob ? "Failed to upload audio answer." : "Failed to save answer.");
      setError(msg);
      toastError(msg);
    } finally {
      if (!completeRequestedRef.current) submitInFlightRef.current = false;
      if (!completeRequestedRef.current) setBusy(null);
    }
  }, [
    answerText,
    busy,
    code,
    completeInterview,
    currentQuestion,
    fetchNextQuestion,
    getFinalVerbalAnswer,
    interviewDifficulty,
    interviewId,
    language,
    logout,
    navigate,
    questionNumber,
    resetRecordingState,
    savedAnswerId,
    savedQuestionId,
    selectedOption,
    stopAnswerAudioTracks,
    stopAnswerRecording,
    totalQuestions,
    uploadAudioAnswer,
    isRecording,
    isQuestionSpeaking,
    isFollowUpActive,
    resetAnswerDraft,
    speakInterviewerTurn,
    timeLeft,
  ]);

  useEffect(() => {
    if (!isTimerActive) return;
    if (timeLeft > 0) return;
    if (!currentQuestion) return;
    if (busy) return;
    if (completeRequestedRef.current || terminatedByProctoringRef.current) return;
    submitAndNext("auto");
  }, [busy, currentQuestion, isTimerActive, submitAndNext, timeLeft]);

  const currentQText = useMemo(() => currentQuestion?.text || "Loading...", [currentQuestion]);
  const timerDuration = useMemo(
    () => getQuestionTimerSeconds(currentQuestion, interviewDifficulty),
    [currentQuestion, interviewDifficulty]
  );
  const timerPct = useMemo(
    () => clamp(Math.round((timeLeft / Math.max(1, timerDuration)) * 100), 0, 100),
    [timeLeft, timerDuration]
  );
  const timerDisplay = useMemo(() => formatTimer(timeLeft), [timeLeft]);
  const recordingDisplay = useMemo(() => formatTimer(recordingSeconds), [recordingSeconds]);
  const showOverlay = busy !== null;

  return (
    <Layout>
      {proctoringToast && (
        <div className="fixed top-4 left-1/2 z-[220] w-[min(92vw,680px)] -translate-x-1/2 px-2" aria-live="assertive">
          <div
            className={`rounded-2xl border-2 px-5 py-4 shadow-2xl flex items-start gap-4 ${proctoringToast.style.className}`}
          >
            <div className="text-2xl leading-none" aria-hidden="true">
              {proctoringToast.style.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-widest opacity-90">
                {proctoringToast.style.label}
              </div>
              <div className="mt-1 text-sm sm:text-base font-black leading-snug break-words">
                {proctoringToast.message}
              </div>
            </div>
            <button
              onClick={() => setProctoringToast(null)}
              className="shrink-0 rounded-lg px-2 text-xl font-black opacity-80 hover:opacity-100"
              aria-label="Dismiss proctoring warning"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 overflow-x-hidden">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 break-words text-sm font-semibold text-red-700 dark:text-red-200">
              {error}
              {savedQuestionId && (
                <span className="opacity-80"> (Answer may already be saved; retry to continue.)</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => submitAndNext()}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase"
              >
                Retry
              </button>
              <button
                onClick={() => setError(null)}
                className="px-3 py-2 rounded-xl bg-white/70 dark:bg-neutral-950/30 text-slate-600 dark:text-neutral-200 text-xs font-black uppercase"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 dark:bg-neutral-800 text-white flex items-center justify-center font-black">
              AM
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                Interview Session
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-neutral-100 font-poppins break-words">
                Question {questionNumber} of {totalQuestions}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 border border-blue-100 dark:border-blue-900/30">
              {currentQuestion?.type ? currentQuestion.type.charAt(0).toUpperCase() + currentQuestion.type.slice(1) : "Question"}
            </span>
            <button
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${
                voiceEnabled
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900/30"
                  : "bg-slate-50 dark:bg-neutral-900 text-slate-600 dark:text-neutral-200 border-slate-100 dark:border-neutral-800"
              }`}
            >
              Voice {voiceEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <section className="min-w-0 bg-white dark:bg-neutral-900 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-sm p-4 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                Camera
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCameraEnabled((v) => !v)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                    cameraEnabled
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900/30"
                      : "bg-slate-50 dark:bg-neutral-950 text-slate-600 dark:text-neutral-200 border-slate-100 dark:border-neutral-800"
                  }`}
                >
                  {cameraEnabled ? "Cam On" : "Cam Off"}
                </button>
                <button
                  onClick={() => setMicEnabled((v) => !v)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                    micEnabled
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900/30"
                      : "bg-slate-50 dark:bg-neutral-950 text-slate-600 dark:text-neutral-200 border-slate-100 dark:border-neutral-800"
                  }`}
                >
                  {micEnabled ? "Mic On" : "Mic Off"}
                </button>
              </div>
            </div>

            <div className="relative rounded-3xl overflow-hidden border border-slate-100 dark:border-neutral-800 bg-slate-900">
              <video
                ref={(el) => {
                  videoElRef.current = el;
                  attachVideoStream();
                }}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover"
              />
              {!cameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-200">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/70 mx-auto mb-3 flex items-center justify-center">
                      <Icons.Camera />
                    </div>
                    <div className="text-xs font-black uppercase tracking-widest opacity-80">Camera Off</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                  Timer
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-neutral-100 tabular-nums">
                  {timerDisplay}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-neutral-900 overflow-hidden">
                <div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${timerPct}%` }} />
              </div>
            </div>
          </section>

          <section className="min-w-0 bg-white dark:bg-neutral-900 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-sm p-4 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className={`text-[10px] font-black uppercase tracking-widest ${isFollowUpActive ? "text-blue-600 dark:text-blue-300" : "text-slate-400 dark:text-neutral-400"}`}>
                {isFollowUpActive ? "Follow-up" : "Question"}
              </div>
              {isGeneratingFollowUp && <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-300"><span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> Preparing follow-up...</div>}
              {isQuestionSpeaking && <div className="text-xs font-bold text-emerald-600 dark:text-emerald-300">AI is speaking...</div>}
            </div>

            <div className={isFollowUpActive ? "rounded-3xl border-2 border-blue-200 bg-blue-50/70 p-6 dark:border-blue-900/50 dark:bg-blue-950/20" : ""} aria-live="polite">
              {isFollowUpActive && <div className="mb-3 text-sm font-semibold text-blue-700 dark:text-blue-300">Based on your previous answer:</div>}
              <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-neutral-100 leading-snug font-poppins break-words">
                {isFollowUpActive && followUpQuestion ? followUpQuestion : currentQText}
              </h2>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!isFollowUpActive && <button onClick={() => speakQuestion(currentQText)} disabled={isRecording || isQuestionSpeaking} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase text-slate-600 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300">Repeat question</button>}
              {isFollowUpActive && <button onClick={() => followUpQuestion && speakQuestion(followUpQuestion)} disabled={!followUpQuestion || isRecording || isQuestionSpeaking} className="rounded-xl border border-blue-200 px-3 py-2 text-[10px] font-black uppercase text-blue-700 disabled:opacity-40 dark:border-blue-900 dark:text-blue-300">Repeat follow-up</button>}
              <button onClick={() => { speechSequenceRef.current += 1; window.speechSynthesis?.cancel(); speechCompletionRef.current?.(); speechCompletionRef.current = null; setIsQuestionSpeaking(false); }} disabled={!isQuestionSpeaking} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase text-slate-600 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300">Stop speaking</button>
            </div>

            {isCodeAnswerQuestion(currentQuestion) ? (
              <div className="mt-8 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                    Code Editor
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-neutral-300">
                      {currentQuestion.skill ? `${currentQuestion.skill} / ` : ""}{language}
                    </span>
                  </div>
                </div>

                <CodingEditor
                  value={code}
                  language={language}
                  dark={profile?.theme === "Dark"}
                  onChange={(nextCode) => {
                    codeTouchedQuestionRef.current = currentQuestion?.id ?? null;
                    setRunCodeResult(null);
                    setCode(nextCode);
                  }}
                  onFocus={() => !isTimerActive && setIsTimerActive(true)}
                />

                <div className="border-y border-slate-100 dark:border-neutral-800 py-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                    {currentQuestion.evaluationType === "layout" ? "Requirement Checklist" : "Visible Test Cases"}
                  </div>
                  <div className="mt-3 space-y-3">
                    {(currentQuestion.testCases ?? []).map((testCase, index) => (
                      <div key={index} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                        <div className="mb-3 font-black text-slate-900 dark:text-neutral-100">Test Case {index + 1}</div>
                        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="min-w-0">
                          <div className="font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                            Input:
                          </div>
                          <pre className="mt-2 max-w-full whitespace-pre-wrap break-all rounded-md bg-white p-3 font-mono leading-5 text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">
                            {formatRunValue(testCase.input)}
                          </pre>
                        </div>
                        <div className="min-w-0">
                          <div className="font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                            Expected Output:
                          </div>
                          <pre className="mt-2 max-w-full whitespace-pre-wrap break-all rounded-md bg-white p-3 font-mono leading-5 text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">
                            {formatRunValue(testCase.expectedOutput ?? testCase.expected ?? testCase.output)}
                          </pre>
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {currentQuestion.constraints?.length ? (
                    <div className="mt-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Constraints</div>
                      <ul className="mt-2 list-disc pl-5 space-y-1 text-xs font-semibold text-slate-700 dark:text-neutral-200">
                        {currentQuestion.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {runCodeResult && (
                  <div className="rounded-3xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                        Test Results
                      </div>
                      {runCodeResult.total > 0 && (
                        <div
                          className={`text-xs font-black tabular-nums ${
                            runCodeResult.passed === runCodeResult.total
                              ? "text-emerald-600 dark:text-emerald-300"
                              : "text-amber-600 dark:text-amber-300"
                          }`}
                        >
                          {runCodeResult.passed}/{runCodeResult.total} Passed
                        </div>
                      )}
                    </div>
                    <div
                      className={`mt-2 text-sm font-bold ${
                        runCodeResult.ok
                          ? "text-slate-700 dark:text-neutral-200"
                          : "text-slate-600 dark:text-neutral-300"
                      }`}
                    >
                      {runCodeResult.message}
                    </div>
                    {runCodeResult.results.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {runCodeResult.results.map((result, index) => (
                          <div
                            key={index}
                            className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-xs font-black text-slate-900 dark:text-neutral-100">
                                Case {index + 1}
                              </div>
                              <div
                                className={`text-[10px] font-black uppercase tracking-widest ${
                                  result.passed
                                    ? "text-emerald-600 dark:text-emerald-300"
                                    : "text-red-600 dark:text-red-300"
                                }`}
                              >
                                {result.passed ? "Passed" : "Failed"}
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div>
                                <div className="font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                                  Input
                                </div>
                                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-slate-700 dark:text-neutral-200">
                                  {formatRunValue(result.input)}
                                </pre>
                              </div>
                              <div>
                                <div className="font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                                  Expected
                                </div>
                                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-slate-700 dark:text-neutral-200">
                                  {formatRunValue(result.expected)}
                                </pre>
                              </div>
                              <div>
                                <div className="font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                                  Actual
                                </div>
                                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-slate-700 dark:text-neutral-200">
                                  {result.error ?? formatRunValue(result.actual)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : currentQuestion?.type === "mcq" ? (
              <fieldset className="mt-8 space-y-3">
                <legend className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400 mb-3">
                  Select One Answer
                </legend>
                {(currentQuestion.options ?? []).map((option, index) => {
                  const optionKey = String.fromCharCode(65 + index);
                  const checked = selectedOption === optionKey;
                  return (
                    <label
                      key={optionKey}
                      className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                        checked
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={optionKey}
                        checked={checked}
                        onChange={() => setSelectedOption(optionKey)}
                        className="mt-1 h-4 w-4 accent-blue-600"
                      />
                      <span className="text-sm font-semibold leading-6 text-slate-800 dark:text-neutral-100">
                        <span className="mr-2 font-black text-slate-500 dark:text-neutral-400">{optionKey}.</span>
                        {option}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <div className="mt-8 space-y-4">
                {currentQuestion?.type === "practical" && currentQuestion.constraints?.length ? (
                  <div className="border-y border-slate-100 py-4 dark:border-neutral-800">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">Task Requirements</div>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-semibold text-slate-700 dark:text-neutral-200">
                      {currentQuestion.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
                    </ul>
                  </div>
                ) : null}
                <div className="relative bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-3xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                      Verbal Answer Preview
                    </div>
                    <div
                      className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        isRecordingPaused
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-300"
                          : isRecording
                            ? "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-300"
                            : "bg-slate-100 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isRecordingPaused ? "bg-amber-500" : isRecording ? "bg-red-600 animate-pulse" : "bg-slate-400"}`} />
                      <span>{isRecordingPaused ? "Paused" : isRecording ? "Recording" : "Not Started"}</span>
                      {(isRecording || isRecordingPaused) && <span className="tabular-nums">{recordingDisplay}</span>}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-neutral-100 min-h-[64px]">
                    {answerText || interimTranscript ? (
                      <>
                        {answerText}
                        <span className="text-slate-400"> {interimTranscript}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Your speech will appear here...</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={
                      isRecordingPaused
                        ? resumeAnswerRecording
                        : isRecording
                          ? pauseAnswerRecording
                          : startAnswerRecording
                    }
                    disabled={!micEnabled || busy !== null || (!isRecording && isQuestionSpeaking)}
                    className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRecordingPaused
                      ? "Resume Answer"
                      : isRecording
                        ? "Pause Answer"
                        : isQuestionSpeaking
                          ? "Wait for Question"
                          : "Start Answer"}
                  </button>
                  <button
                    onClick={clearInputs}
                    disabled={busy !== null}
                    className="py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest bg-white dark:bg-neutral-950 text-slate-700 dark:text-neutral-200 border border-slate-100 dark:border-neutral-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => submitAndNext()}
                disabled={busy !== null || !currentQuestion || isQuestionSpeaking}
                className="sm:col-span-2 w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest disabled:opacity-60"
              >
                {isFollowUpActive ? "Submit Follow-up" : questionNumber >= totalQuestions ? "Finish Interview" : "Submit & Next"}
              </button>
              <button
                onClick={handleFinishEarly}
                className="w-full py-4 rounded-2xl bg-white dark:bg-neutral-950 border-2 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-300 font-black text-sm uppercase tracking-widest"
              >
                Quit
              </button>
            </div>
          </section>
        </div>
      </div>

      {showOverlay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/50" />
          <div className="relative mx-4 w-full max-w-sm bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-2xl p-6 sm:p-10 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <div className="text-2xl font-black text-slate-900 dark:text-neutral-100 font-poppins">
              {busy === "initial"
                ? "Preparing Session..."
                : busy === "completing"
                  ? "Generating final feedback..."
                  : "Saving Answer..."}
            </div>
            <div className="text-sm font-semibold text-slate-500 dark:text-neutral-400 mt-2">
              {busy === "initial"
                ? "Connecting to your interview workspace."
                : busy === "completing"
                  ? "Scoring your interview and preparing your results."
                  : "Saving your answer and loading the next question."}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
