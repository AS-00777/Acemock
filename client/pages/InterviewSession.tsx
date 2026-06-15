import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api, ApiError } from "../services/api";
import { toastError } from "../services/toast";
import { useAuth } from "../context/AuthContext";
import { Icons } from "../constants";

type QuestionType = "theory" | "coding";

type InterviewDetailsResponse = {
  interview: {
    id: number;
    role: string;
    experience: string;
    difficulty: "Easy" | "Medium" | "Hard" | null;
    techStack: any;
    status: "IN_PROGRESS" | "COMPLETED";
    questions: Array<{
      id: number;
      questionText: string;
      type: QuestionType;
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

type QuestionResponse = { question: { id: number; questionText: string; type: QuestionType } };

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
  evaluation: { score: number; rating: "Poor" | "Average" | "Good" | "Excellent"; feedback: string };
};

type CurrentQuestion = { id: number; text: string; type: QuestionType };

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
const DEFAULT_SECONDS = 60;

const LANGUAGES = ["TypeScript", "JavaScript", "Python", "Java", "C++"] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function InterviewSession() {
  const navigate = useNavigate();
  const { id } = useParams();
  const interviewId = Number(id);
  const { profile, logout } = useAuth();

  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  const [timeLeft, setTimeLeft] = useState(DEFAULT_SECONDS);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [answerText, setAnswerText] = useState("");

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("TypeScript");

  const [busy, setBusy] = useState<null | "initial" | "saving">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedQuestionId, setSavedQuestionId] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const micEnabledRef = useRef(true);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

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
        if (isRecordingRef.current && micEnabledRef.current) {
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
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      stopMediaTracks();
    };
  }, [ensureMediaStream, stopMediaTracks]);

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
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
    if (!micEnabled && isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsRecording(false);
    }
  }, [micEnabled, isRecording]);

  const speakQuestion = useCallback(
    (text: string) => {
      if (!voiceEnabled) return;
      if (!window.speechSynthesis) return;
      const t = text.trim();
      if (!t) return;
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(t);
      msg.rate = 0.95;
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

  const toggleRecording = useCallback(() => {
    if (!micEnabled) return;
    const rec = recognitionRef.current;
    if (!rec) return;
    if (isRecording) {
      rec.stop();
      setIsRecording(false);
      return;
    }
    try {
      rec.start();
      setIsRecording(true);
      if (!isTimerActive) setIsTimerActive(true);
    } catch {}
  }, [isRecording, isTimerActive, micEnabled]);

  const clearInputs = useCallback(() => {
    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsRecording(false);
    }
    setAnswerText("");
    setInterimTranscript("");
    setCode("");
  }, [isRecording]);

  const fetchNextQuestion = useCallback(
    async (nextNumber: number) => {
      const q = await api.post<QuestionResponse>(`/interview/${interviewId}/question`, {});
      setCurrentQuestion({ id: q.question.id, text: q.question.questionText, type: q.question.type });
      setQuestionNumber(nextNumber);
      setSavedQuestionId(null);
      setTimeLeft(DEFAULT_SECONDS);
      setIsTimerActive(false);
    },
    [interviewId]
  );

  const loadOrGenerateQuestion = useCallback(async () => {
    const details = await api.get<InterviewDetailsResponse>(`/interview/${interviewId}`);
    if (details.interview.status === "COMPLETED") {
      navigate(`/result/${interviewId}`);
      return;
    }

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

    const pending = details.interview.questions.find((q) => q.answers.length === 0);
    if (pending) {
      setCurrentQuestion({ id: pending.id, text: pending.questionText, type: pending.type });
      setQuestionNumber(answered.length + 1);
      return;
    }

    const nextNumber = answered.length + 1;
    await fetchNextQuestion(nextNumber);
  }, [fetchNextQuestion, interviewId, navigate]);

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
      .finally(() => setBusy(null));
  }, [interviewId, loadOrGenerateQuestion, logout, navigate]);

  const handleFinishEarly = useCallback(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    stopMediaTracks();
    navigate("/dashboard");
  }, [navigate, stopMediaTracks]);

  const submitAndNext = useCallback(async () => {
    if (!currentQuestion) return;
    if (busy) return;

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    setIsTimerActive(false);

    if (savedQuestionId === currentQuestion.id && questionNumber < MAX_QUESTIONS) {
      setBusy("saving");
      setError(null);
      try {
        await fetchNextQuestion(questionNumber + 1);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) logout();
        const msg = err?.message || "Failed to load next question.";
        setError(msg);
        toastError(msg);
      } finally {
        setBusy(null);
      }
      return;
    }

    const payload: any = { questionId: currentQuestion.id };
    if (currentQuestion.type === "coding") {
      payload.code = code.trim() || undefined;
      payload.language = language;
      payload.answerText = answerText.trim();
    } else {
      payload.answerText = answerText.trim() || "(No verbal response)";
    }

    setBusy("saving");
    setError(null);
    try {
      const r = await api.post<AnswerResponse>(`/interview/${interviewId}/answer`, payload);

      setTranscript((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          questionText: currentQuestion.text,
          type: currentQuestion.type,
          answerText: payload.answerText ?? "",
          code: payload.code,
          language: payload.language,
          score10: r.evaluation.score,
          rating: r.evaluation.rating,
          feedback: r.evaluation.feedback,
        },
      ]);

      setSavedQuestionId(currentQuestion.id);
      setAnswerText("");
      setInterimTranscript("");
      setCode("");
      setTimeLeft(DEFAULT_SECONDS);

      if (questionNumber < MAX_QUESTIONS) {
        await fetchNextQuestion(questionNumber + 1);
      } else {
        await api.post(`/interview/${interviewId}/complete`, {});
        stopMediaTracks();
        navigate(`/result/${interviewId}`);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      const msg = err?.message || "Failed to save answer.";
      setError(msg);
      toastError(msg);
    } finally {
      setBusy(null);
    }
  }, [
    answerText,
    busy,
    code,
    currentQuestion,
    fetchNextQuestion,
    interviewId,
    language,
    logout,
    navigate,
    questionNumber,
    savedQuestionId,
    stopMediaTracks,
  ]);

  const currentQText = useMemo(() => currentQuestion?.text || "Loading...", [currentQuestion]);
  const scorePercent = useMemo(() => {
    const last = transcript[transcript.length - 1];
    if (!last?.score10 && last?.score10 !== 0) return null;
    return clamp(Math.round(last.score10 * 10), 0, 100);
  }, [transcript]);

  const timerPct = useMemo(() => clamp(Math.round((timeLeft / DEFAULT_SECONDS) * 100), 0, 100), [timeLeft]);
  const showOverlay = busy !== null;

  return (
    <Layout>
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
                Question {questionNumber} of {MAX_QUESTIONS}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 border border-blue-100 dark:border-blue-900/30">
              {currentQuestion?.type === "coding" ? "Coding" : "Theory"}
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
                  00:{String(timeLeft).padStart(2, "0")}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-neutral-900 overflow-hidden">
                <div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${timerPct}%` }} />
              </div>
              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => setIsTimerActive((v) => !v)}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 dark:bg-neutral-800 text-white font-black text-xs uppercase tracking-widest"
                >
                  {isTimerActive ? "Pause" : "Start"}
                </button>
                <button
                  onClick={() => setTimeLeft(DEFAULT_SECONDS)}
                  className="py-3 px-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 font-black text-xs uppercase tracking-widest"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-slate-100 dark:border-neutral-800 shadow-sm p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                Question
              </div>
              {scorePercent !== null && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
                  Last Score {scorePercent}%
                </div>
              )}
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-neutral-100"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onFocus={() => !isTimerActive && setIsTimerActive(true)}
                  className="w-full h-64 sm:h-72 bg-slate-900 text-emerald-300 font-mono text-sm p-5 rounded-3xl outline-none resize-none border-2 border-slate-800 focus:border-blue-500 transition-colors"
                  placeholder={`Write your solution in ${language}...`}
                />

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
            ) : (
              <div className="mt-8 space-y-4">
                <div className="bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-3xl p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-400 mb-2">
                    Verbal Answer Preview
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
                    onClick={toggleRecording}
                    disabled={!micEnabled}
                    className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                      isRecording
                        ? "bg-red-600 text-white animate-pulse"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    } disabled:opacity-50`}
                  >
                    {isRecording ? "Stop Recording" : "Speak Answer"}
                  </button>
                  <button
                    onClick={clearInputs}
                    className="py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest bg-white dark:bg-neutral-950 text-slate-700 dark:text-neutral-200 border border-slate-100 dark:border-neutral-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={submitAndNext}
                disabled={busy !== null || !currentQuestion}
                className="sm:col-span-2 w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-widest disabled:opacity-60"
              >
                {questionNumber === MAX_QUESTIONS ? "Finish Interview" : "Submit & Next"}
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
              {busy === "initial" ? "Preparing Session..." : "Evaluating Answer..."}
            </div>
            <div className="text-sm font-semibold text-slate-500 dark:text-neutral-400 mt-2">
              {busy === "initial"
                ? "Connecting to your interview workspace."
                : "Saving your answer and generating feedback."}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
