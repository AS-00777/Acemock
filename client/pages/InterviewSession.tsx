import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import CodingEditor from "../components/CodingEditor";
import { api, ApiError } from "../services/api";
import { toastError, toastInfo } from "../services/toast";
import { useAuth } from "../context/AuthContext";
import { Icons } from "../constants";

type QuestionType = "theory" | "coding" | "mcq" | "practical" | "scenario";
type Difficulty = "easy" | "medium" | "hard";

type InterviewDetailsResponse = {
  interview: {
    id: number;
    role: string;
    experience: string;
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
  if (!question || question.type === "theory") return THEORY_SECONDS;
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
    isRecordingPausedRef.current = false;
    setRecordingSeconds(0);
  }, [stopRecordingTimer]);

  useEffect(() => {
    if (!currentQuestion) return;
    if (codeInitializedQuestionRef.current === currentQuestion.id) return;
    codeInitializedQuestionRef.current = currentQuestion.id;
    setRunCodeResult(null);

    if (currentQuestion.type !== "coding") {
      setCode("");
      return;
    }

    const questionLanguage = currentQuestion.language?.trim() || "TypeScript";
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
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    resetRecordingState();
    if (mediaRecorderRef.current?.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    stopAnswerAudioTracks();
    setIsTimerActive(false);
    stopMediaTracks();
    showProctoringWarning(result);
    window.setTimeout(() => navigate("/dashboard"), 1200);
  }, [navigate, resetRecordingState, showProctoringWarning, stopAnswerAudioTracks, stopMediaTracks]);

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
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const part = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setAnswerText((prev) => (prev + " " + part).trim());
            setInterimTranscript("");
          } else {
            interimText += part;
          }
        }
        setInterimTranscript(interimText);
      };
      rec.onend = () => {
        if (isRecordingRef.current && !isRecordingPausedRef.current && micEnabledRef.current) {
          try {
            rec.start();
          } catch {}
        }
      };
      recognitionRef.current = rec;
    }

    ensureMediaStream().catch((e) => {
      console.error("Media access error:", e);
      setError("Camera/Mic permission is required to continue.");
    });

    return () => {
      if (proctoringToastTimerRef.current) {
        window.clearTimeout(proctoringToastTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      stopRecordingTimer();
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      stopAnswerAudioTracks();
      stopMediaTracks();
    };
  }, [ensureMediaStream, stopAnswerAudioTracks, stopMediaTracks, stopRecordingTimer]);

  useEffect(() => {
    // Persist stream across re-renders; re-attach whenever the video element exists.
    attachVideoStream();
  });

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

  useEffect(() => {
    const text = currentQuestion?.text ?? "";
    if (!voiceEnabled) return;
    if (!text.trim()) return;
    if (busy) return;
    speakQuestion(text);
  }, [busy, currentQuestion?.id, currentQuestion?.text, speakQuestion, voiceEnabled]);

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
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser. You can still type your answer.");
      return;
    }

    setError(null);
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
      answerAudioStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (!isRecordingPausedRef.current && event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        resetRecordingState();
        stopAnswerAudioTracks();
        setError("Recording failed. Please try again.");
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;

      try {
        if (recognitionRef.current) {
          recognitionRef.current.onend = () => {
            if (isRecordingRef.current && !isRecordingPausedRef.current && micEnabledRef.current) {
              try {
                recognitionRef.current?.start();
              } catch {}
            }
          };
        }
        recognitionRef.current?.start();
      } catch {}

      setIsRecording(true);
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
        ? "Microphone permission was denied. Allow mic access or use the text answer fallback."
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
  ]);

  const stopAnswerRecording = useCallback(async () => {
    stopRecordingTimer();
    try {
      if (recognitionRef.current) recognitionRef.current.onend = null;
      recognitionRef.current?.stop();
    } catch {}

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
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
      if (recognitionRef.current) {
        recognitionRef.current.onend = () => {
          if (isRecordingRef.current && !isRecordingPausedRef.current && micEnabledRef.current) {
            try {
              recognitionRef.current?.start();
            } catch {}
          }
        };
      }
      recognitionRef.current?.start();
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
      stopMediaTracks();
      navigate(`/result/${interviewId}`);
    } catch (err: any) {
      completeRequestedRef.current = false;
      if (err instanceof ApiError && err.status === 401) logout();
      const msg = err?.message || "Failed to generate final feedback.";
      setError(msg);
      toastError(msg);
      throw err;
    }
  }, [interviewId, logout, navigate, stopMediaTracks]);

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
    [completeInterview, interviewDifficulty, interviewId]
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
      setSavedQuestionId(null);
      setSavedAnswerId(null);
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
  }, [completeInterview, fetchNextQuestion, interviewId, navigate]);

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
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsQuestionSpeaking(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current?.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    stopAnswerAudioTracks();
    resetRecordingState();
    stopMediaTracks();
    navigate("/dashboard");
  }, [navigate, resetRecordingState, stopAnswerAudioTracks, stopMediaTracks]);

  const submitAndNext = useCallback(async (
    mode: "manual" | "auto" = "manual",
    options: { audioBlob?: Blob } = {}
  ) => {
    if (!currentQuestion) return;
    if (busy) return;
    if (submitInFlightRef.current) return;
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
    let audioBlob = options.audioBlob;
    if (isRecording && !audioBlob) {
      try {
        audioBlob = await stopAnswerRecording();
        if (!audioBlob.size) throw new Error("No audio captured. Please record your answer again.");
      } catch (err: any) {
        const msg = err?.message || "Recording failed. Please try again.";
        setError(msg);
        toastError(msg);
        submitInFlightRef.current = false;
        return;
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
      stopAnswerAudioTracks();
      resetRecordingState();
    }
    setIsTimerActive(false);
    const isLastQuestion = questionNumber >= totalQuestions;

    if (savedQuestionId === currentQuestion.id) {
      setBusy("saving");
      setError(null);
      try {
        if (audioBlob) {
          if (!savedAnswerId) throw new Error("Saved answer was not found for audio upload.");
          await uploadAudioAnswer(audioBlob, savedAnswerId);
        }
        if (isLastQuestion) {
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

    const payload: any = { questionId: currentQuestion.id };
    if (currentQuestion.type === "coding") {
      const trimmedCode = code.trim();
      const trimmedAnswer = answerText.trim();
      payload.code = trimmedCode || undefined;
      payload.language = language;
      payload.answerText = trimmedAnswer || (mode === "auto" && !trimmedCode ? "(No code submitted)" : "");
    } else if (currentQuestion.type === "mcq") {
      payload.answerText = selectedOption || "(No selection)";
    } else {
      payload.answerText = answerText.trim() || "(No verbal response)";
    }

    setBusy("saving");
    setError(null);
    try {
      const answerResponse = await api.post<AnswerResponse>(`/interview/${interviewId}/answer`, payload);

      setSavedQuestionId(currentQuestion.id);
      setSavedAnswerId(answerResponse.answer.id);
      if (answerResponse.evaluation && currentQuestion.type === "mcq") {
        toastInfo(`${answerResponse.evaluation.correct ? "Correct." : "Incorrect."} ${answerResponse.evaluation.feedback}`, 5000);
      }

      let submittedAnswerText = payload.answerText ?? "";
      if (audioBlob) {
        const audioResponse = await uploadAudioAnswer(audioBlob, answerResponse.answer.id);
        const backendTranscript =
          audioResponse.correctedTranscript?.trim() ||
          audioResponse.transcript?.trim() ||
          audioResponse.rawTranscript?.trim();
        if (backendTranscript) submittedAnswerText = backendTranscript;
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

      setAnswerText("");
      setSelectedOption("");
      setInterimTranscript("");
      setCode("");
      setTimeLeft(getQuestionTimerSeconds(currentQuestion, interviewDifficulty));

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-5 py-4 flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-red-700 dark:text-red-200">
              {error}
              {savedQuestionId && (
                <span className="opacity-80"> (Answer may already be saved; retry to continue.)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 dark:bg-neutral-800 text-white flex items-center justify-center font-black">
              AM
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                Interview Session
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-neutral-100 font-poppins">
                Question {questionNumber} of {totalQuestions}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            <button
              onClick={() => speakQuestion(currentQText)}
              disabled={isRecording}
              className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-50 dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 border border-slate-100 dark:border-neutral-800 flex items-center gap-2"
            >
              <Icons.Replay /> Replay
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                Camera
              </div>
              <div className="flex items-center gap-2">
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
              <div className="flex items-center justify-between">
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

          <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-sm p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                Question
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-neutral-100 leading-snug font-poppins">
              {currentQText}
            </h2>

            {currentQuestion?.type === "coding" ? (
              <div className="mt-8 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                    Code Editor
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-neutral-300">
                      {currentQuestion.skill ? `${currentQuestion.skill} / ` : ""}{language}
                    </span>
                    {currentQuestion.canRunCode ? (
                      <button
                        onClick={handleRunCode}
                        disabled={isRunningCode}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                      >
                        {isRunningCode ? "Running..." : "Run Code"}
                      </button>
                    ) : null}
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
                    <div className="flex items-center justify-between gap-3">
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
                            <div className="flex items-center justify-between gap-3">
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

                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400 mb-2">
                    Explanation (optional)
                  </div>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="w-full h-24 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-3xl px-5 py-4 outline-none text-sm font-semibold text-slate-900 dark:text-neutral-100 resize-none"
                    placeholder="Explain your approach, complexity, tradeoffs, and edge cases..."
                  />
                </div>
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
                disabled={busy !== null || !currentQuestion}
                className="sm:col-span-2 w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest disabled:opacity-60"
              >
                {questionNumber >= totalQuestions ? "Finish Interview" : "Submit & Next"}
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
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-2xl p-10 max-w-sm w-full text-center">
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
