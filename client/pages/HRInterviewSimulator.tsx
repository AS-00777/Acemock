import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

type HrQuestion = {
  order: number;
  questionId: string;
  question: string;
  category: string;
};

type HrInterview = {
  id: number;
  role: string;
  experience: string;
  difficulty: string;
  totalQuestions: number;
  questions: HrQuestion[];
};

type ConversationState =
  | 'PREPARING'
  | 'GREETING'
  | 'AI_SPEAKING'
  | 'USER_LISTENING'
  | 'USER_SPEAKING'
  | 'SILENCE_DETECTED'
  | 'PROCESSING'
  | 'FOLLOW_UP'
  | 'NEXT_QUESTION'
  | 'COMPLETED'
  | 'ABANDONED';

type NetworkState = {
  label: 'Good connection' | 'Slow connection' | 'Offline';
  bars: 1 | 2 | 3;
};

const QUESTION_SECONDS = 180;
const AUTO_PAUSE_SILENCE_TIMEOUT_MS = 6000;
const GREETING =
  "Hi, I'm Priya Sharma, your HR interviewer for today. I'll be asking you a few questions about your communication, teamwork, confidence, and career goals. Please answer naturally, just like you would in a real interview. Let's get started.";

const preferredVoiceNames = [
  'Microsoft Aria Online',
  'Microsoft Jenny Online',
  'Microsoft Sonia Online',
  'Microsoft Zira',
  'Google UK English Female',
  'Google US English',
  'Samantha',
  'Karen',
  'Moira',
];

const transitions = [
  "Let's start with a simple introduction.",
  'Now I would like to understand your work style.',
  'Let us move to a teamwork question.',
  'Let us continue with another HR scenario.',
  'Now I would like to understand how you handle challenges.',
  'Let us talk about adaptability.',
  'Next, I want to understand your leadership and culture fit.',
  'Finally, let us close with one general HR question.',
];

const afterSaveTransitions = [
  'Let us continue.',
  'We will move to the next one.',
  'Here is the next question.',
];

const emptyAnswerTransition = "I didn't catch your answer. You can try again or continue.";

const getSpeechRecognition = () => {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const meaningfulWordCount = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !['uh', 'um', 'hmm', 'like', 'actually'].includes(word)).length;

const isMeaninglessClientAnswer = (value: string) => {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  const bad = new Set(['', 'uh', 'um', 'hmm', 'yes', 'no', "i don't know", 'i dont know', 'nothing', 'no idea', 'not developed any skills']);
  if (bad.has(normalized)) return true;
  return meaningfulWordCount(value) < 5;
};

const getNetworkState = (): NetworkState => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { label: 'Offline', bars: 1 };
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const downlink = Number(connection?.downlink ?? 10);
  if (effectiveType.includes('2g') || downlink < 0.8) return { label: 'Slow connection', bars: 1 };
  if (effectiveType.includes('3g') || downlink < 2) return { label: 'Slow connection', bars: 2 };
  return { label: 'Good connection', bars: 3 };
};

const HRInterviewSimulator: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [interview] = useState<HrInterview | null>(() => {
    const fromState = (location.state as any)?.interview;
    if (fromState?.id) return fromState;
    if (!id) return null;
    try {
      return JSON.parse(window.localStorage.getItem(`acemock_hr_interview_${id}`) || 'null');
    } catch {
      return null;
    }
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [manualAnswer, setManualAnswer] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [conversationState, setConversationState] = useState<ConversationState>('PREPARING');
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(() => new Set());
  const [followUpsAsked, setFollowUpsAsked] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [noiseWarning, setNoiseWarning] = useState('');
  const [network, setNetwork] = useState<NetworkState>(() => getNetworkState());
  const [silenceAttempts, setSilenceAttempts] = useState(0);
  const [answerCaptureState, setAnswerCaptureState] = useState<'idle' | 'listening' | 'paused'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const answerRecorderRef = useRef<MediaRecorder | null>(null);
  const answerAudioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const conversationStateRef = useRef<ConversationState>('PREPARING');
  const answerCaptureStateRef = useRef<'idle' | 'listening' | 'paused'>('idle');
  const mainAnswerRef = useRef('');
  const followUpAnswerRef = useRef('');
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const currentQuestionIdRef = useRef('');
  const activeTargetRef = useRef<'main' | 'followup'>('main');
  const savingRef = useRef(false);
  const submittedRef = useRef<Set<string>>(new Set());
  const emptyAnswerPromptedRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const noSpeechTimerRef = useRef<number | null>(null);
  const recognitionActiveRef = useRef(false);
  const intentionalRecognitionStopRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserFrameRef = useRef<number | null>(null);
  const highNoiseMsRef = useRef(0);
  const lastSoundAtRef = useRef(Date.now());

  const question = interview?.questions[currentIndex] ?? null;
  const completedCount = submittedIds.size;
  const liveMainTranscript = `${currentTranscript} ${interimTranscript}`.trim();
  const fullAnswer = (manualAnswer || liveMainTranscript).trim();

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
    silenceTimerRef.current = null;
    noSpeechTimerRef.current = null;
  }, []);

  const cleanupAudio = useCallback(() => {
    window.speechSynthesis?.cancel();
    try {
      intentionalRecognitionStopRef.current = true;
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop?.();
    } catch {}
    try {
      if (answerRecorderRef.current && answerRecorderRef.current.state !== 'inactive') answerRecorderRef.current.stop();
    } catch {}
    recognitionRef.current = null;
    answerRecorderRef.current = null;
    setAnswerCaptureState('idle');
    clearTimers();
  }, [clearTimers]);

  const stopMedia = useCallback(() => {
    if (analyserFrameRef.current) cancelAnimationFrame(analyserFrameRef.current);
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetAnswerState = useCallback(() => {
    cleanupAudio();
    mainAnswerRef.current = '';
    followUpAnswerRef.current = '';
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setCurrentTranscript('');
    setInterimTranscript('');
    setManualAnswer('');
    setFollowUpQuestion('');
    setFollowUpAnswer('');
    setSilenceAttempts(0);
    setNoiseWarning('');
    setFallbackOpen(false);
    setIsManualMode(false);
    setAnswerCaptureState('idle');
    answerAudioChunksRef.current = [];
    emptyAnswerPromptedRef.current = false;
    setSecondsLeft(QUESTION_SECONDS);
  }, [cleanupAudio]);

  const getBestVoice = useCallback(() => {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    for (const preferred of preferredVoiceNames) {
      const found = voices.find((voice) => voice.name.toLowerCase().includes(preferred.toLowerCase()));
      if (found) return found;
    }
    const fallback = voices.find((voice) => /female|zira|sonia|aria|jenny|samantha|karen|moira/i.test(voice.name) && /^en/i.test(voice.lang))
      ?? voices.find((voice) => /^en/i.test(voice.lang))
      ?? voices[0]
      ?? null;
    if (!fallback) console.debug('Using browser default voice. Install/use Microsoft Edge voices for more natural speech.');
    return fallback;
  }, []);

  const pauseAnswerCapture = useCallback((nextState: 'idle' | 'paused' = 'paused') => {
    intentionalRecognitionStopRef.current = true;
    recognitionActiveRef.current = false;
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
    silenceTimerRef.current = null;
    noSpeechTimerRef.current = null;
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    try {
      if (nextState === 'idle' && answerRecorderRef.current && answerRecorderRef.current.state !== 'inactive') {
        answerRecorderRef.current.stop();
        answerRecorderRef.current = null;
      } else if (answerRecorderRef.current?.state === 'recording') {
        answerRecorderRef.current.pause();
      }
    } catch {}
    setAnswerCaptureState(nextState);
    setConversationState('USER_LISTENING');
  }, []);

  const scheduleSilenceAutoPause = useCallback(() => {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);

    // HR answers often include natural thinking pauses. Silence never submits
    // an answer; after a longer continuous quiet window, capture is only paused
    // so the user can resume, clear, or continue intentionally.
    silenceTimerRef.current = window.setTimeout(() => {
      const silentForMs = Date.now() - lastSoundAtRef.current;

      if (silentForMs < AUTO_PAUSE_SILENCE_TIMEOUT_MS) {
        scheduleSilenceAutoPause();
        return;
      }

      if (!savingRef.current && recognitionActiveRef.current) pauseAnswerCapture('paused');
    }, AUTO_PAUSE_SILENCE_TIMEOUT_MS);
  }, [pauseAnswerCapture]);

  const startListening = useCallback((target: 'main' | 'followup' = 'main') => {
    activeTargetRef.current = target;
    setConversationState('USER_LISTENING');
    setMediaError('');
    if (!micEnabled || micBlocked) {
      setFallbackOpen(true);
      return;
    }

    const Recognition = getSpeechRecognition();
    const audioTrack = streamRef.current?.getAudioTracks()[0];

    try {
      if (!answerRecorderRef.current && audioTrack && typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(new MediaStream([audioTrack]));
        recorder.ondataavailable = (event) => {
          if (event.data?.size) answerAudioChunksRef.current.push(event.data);
        };
        recorder.start();
        answerRecorderRef.current = recorder;
      } else if (answerRecorderRef.current?.state === 'paused') {
        answerRecorderRef.current.resume();
      }
    } catch {
      setFallbackOpen(true);
    }

    if (!Recognition) {
      setFallbackOpen(true);
      setIsManualMode(true);
      setMediaError('Speech recognition is unavailable in this browser. You can type your answer.');
      recognitionActiveRef.current = true;
      setAnswerCaptureState('listening');
      scheduleSilenceAutoPause();
      return;
    }

    try {
      intentionalRecognitionStopRef.current = true;
      recognitionRef.current?.stop?.();
    } catch {}

    try {
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onaudiostart = () => {
        recognitionActiveRef.current = true;
      };
      recognition.onspeechstart = () => {
        lastSoundAtRef.current = Date.now();
        if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      };
      recognition.onspeechend = () => {
        scheduleSilenceAutoPause();
      };
      recognition.onresult = (event: any) => {
        clearTimers();
        lastSoundAtRef.current = Date.now();
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = String(event.results[i][0].transcript || '').trim();
          if (!transcript) continue;
          if (event.results[i].isFinal) {
            if (target === 'main') mainAnswerRef.current = `${mainAnswerRef.current} ${transcript}`.trim();
            else followUpAnswerRef.current = `${followUpAnswerRef.current} ${transcript}`.trim();
          } else {
            interim += ` ${transcript}`;
          }
        }
        interimTranscriptRef.current = interim.trim();
        const baseValue = target === 'main' ? mainAnswerRef.current.trim() : followUpAnswerRef.current.trim();
        const shownValue = `${baseValue} ${interimTranscriptRef.current}`.trim();
        if (target === 'main') {
          setCurrentTranscript(baseValue);
          setInterimTranscript(interimTranscriptRef.current);
        } else {
          setFollowUpAnswer(shownValue);
        }
        setConversationState(meaningfulWordCount(shownValue) > 0 ? 'USER_SPEAKING' : 'USER_LISTENING');
        scheduleSilenceAutoPause();
      };
      recognition.onerror = (event: any) => {
        recognitionActiveRef.current = false;
        setFallbackOpen(true);
        setIsManualMode(true);
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setMediaError('Speech transcript permission was blocked. You can type your answer.');
        }
      };
      recognition.onend = () => {
        recognitionActiveRef.current = false;
      };
      intentionalRecognitionStopRef.current = false;
      recognition.start();
      recognitionActiveRef.current = true;
      recognitionRef.current = recognition;
      setAnswerCaptureState('listening');
      scheduleSilenceAutoPause();
    } catch {
      recognitionActiveRef.current = Boolean(audioTrack);
      setFallbackOpen(true);
      setIsManualMode(true);
      setAnswerCaptureState(audioTrack ? 'listening' : 'idle');
    }
  }, [clearTimers, micBlocked, micEnabled, scheduleSilenceAutoPause]);

  const speak = useCallback((text: string, state: ConversationState, onEnd?: () => void) => {
    cleanupAudio();
    setConversationState(state);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.94;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    utterance.onend = () => window.setTimeout(() => onEnd?.(), 250);
    utterance.onerror = () => window.setTimeout(() => onEnd?.(), 250);
    window.speechSynthesis?.speak(utterance);
  }, [cleanupAudio, getBestVoice]);

  const askQuestion = useCallback((index: number) => {
    const q = interview?.questions[index];
    if (!q) return;
    const transition = transitions[Math.min(index, transitions.length - 1)];
    speak(`${transition} ${q.question}`, 'AI_SPEAKING', () => setConversationState('USER_LISTENING'));
  }, [interview, speak]);

  const shouldConsiderFollowUp = useCallback((answer: string) => {
    const words = meaningfulWordCount(answer);
    if (followUpsAsked >= 3 || words < 8) return false;
    const hasExample = /\b(example|project|situation|when|once|during|in my|at my|college|internship|work)\b/i.test(answer);
    const hasOutcome = /\b(result|outcome|impact|learned|improved|resolved|achieved|completed|success)\b/i.test(answer);
    const hasOwnership = /\b(i|my|me|we)\b/i.test(answer);
    return words < 45 || !hasExample || !hasOutcome || !hasOwnership;
  }, [followUpsAsked]);

  const goToNextQuestion = useCallback(() => {
    if (!interview) return;
    if (currentIndex >= interview.questions.length - 1) {
      setConversationState('COMPLETED');
      speak("That concludes your HR interview. I'm preparing your report now.", 'AI_SPEAKING', () => {
        cleanupAudio();
        stopMedia();
        navigate(`/hr-interview/result/${interview.id}`);
      });
      return;
    }
    const nextIndex = currentIndex + 1;
    setConversationState('NEXT_QUESTION');
    setCurrentIndex(nextIndex);
    window.setTimeout(() => askQuestion(nextIndex), 350);
  }, [askQuestion, cleanupAudio, currentIndex, interview, navigate, speak, stopMedia]);

  async function saveAnswer(overrideFollowUpAnswer?: string, submitMode: 'manual' | 'timer' = 'manual') {
    if (!interview || !question || savingRef.current || submittedRef.current.has(question.questionId)) return;
    const answerText = (manualAnswer || mainAnswerRef.current || currentTranscript || finalTranscriptRef.current || interimTranscriptRef.current).trim();

    savingRef.current = true;
    setSaving(true);
    pauseAnswerCapture('idle');
    setConversationState('PROCESSING');
    window.speechSynthesis?.cancel();
    try {
      await api.post('/hr-interview/answer', {
        interviewId: interview.id,
        questionId: question.questionId,
        answerText,
        followUpQuestion,
        followUpAnswer: (overrideFollowUpAnswer ?? followUpAnswer).trim(),
        timeTakenSeconds: QUESTION_SECONDS - secondsLeft,
      });
      submittedRef.current = new Set(submittedRef.current).add(question.questionId);
      setSubmittedIds(new Set(submittedRef.current));
      const transition = isMeaninglessClientAnswer(answerText)
        ? "We'll continue to the next question."
        : afterSaveTransitions[currentIndex % afterSaveTransitions.length];
      speak(transition, 'AI_SPEAKING', goToNextQuestion);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      setError(err?.message || 'Could not save answer.');
      setFallbackOpen(true);
      setConversationState('USER_LISTENING');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function submitMainAnswer(answerOverride?: string, submitMode: 'manual' | 'timer' = 'manual') {
    if (!interview || !question || savingRef.current || submittedRef.current.has(question.questionId)) return;
    const answer = (answerOverride || manualAnswer || mainAnswerRef.current || currentTranscript || finalTranscriptRef.current || interimTranscriptRef.current).trim();
    mainAnswerRef.current = answer;
    pauseAnswerCapture('idle');
    window.speechSynthesis?.cancel();
    if (isMeaninglessClientAnswer(answer)) {
      if (submitMode === 'manual' && !emptyAnswerPromptedRef.current) {
        emptyAnswerPromptedRef.current = true;
        speak(emptyAnswerTransition, 'AI_SPEAKING', () => setConversationState('USER_LISTENING'));
        return;
      }
      await saveAnswer(undefined, submitMode);
      return;
    }
    setConversationState('PROCESSING');
    if (!shouldConsiderFollowUp(answer)) {
      await saveAnswer(undefined, submitMode);
      return;
    }
    try {
      const follow = await api.post<{ followUpQuestion: string | null }>('/hr-interview/follow-up', {
        interviewId: interview.id,
        question: question.question,
        category: question.category,
        answerText: answer,
      });
      if (follow?.followUpQuestion) {
        setFollowUpQuestion(follow.followUpQuestion);
        setFollowUpsAsked((count) => count + 1);
        speak(`I have one follow-up. ${follow.followUpQuestion}`, 'FOLLOW_UP', () => setConversationState('USER_LISTENING'));
        return;
      }
      await saveAnswer(undefined, submitMode);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
      await saveAnswer(undefined, submitMode);
    }
  }

  function handleNoSpeech() {
    if (savingRef.current || submittedRef.current.has(currentQuestionIdRef.current)) return;
    setConversationState('SILENCE_DETECTED');
    setSilenceAttempts((attempts) => attempts + 1);
    pauseAnswerCapture('paused');
    speak(emptyAnswerTransition, 'AI_SPEAKING', () => setConversationState('USER_LISTENING'));
  }

  useEffect(() => {
    const loadVoices = () => setVoicesReady(true);
    loadVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    conversationStateRef.current = conversationState;
  }, [conversationState]);

  useEffect(() => {
    answerCaptureStateRef.current = answerCaptureState;
  }, [answerCaptureState]);

  useEffect(() => {
    const update = () => setNetwork(getNetworkState());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const connection = (navigator as any).connection;
    connection?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      connection?.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    if (!interview) return;
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        setCameraBlocked(stream.getVideoTracks().length === 0);
        setMicBlocked(stream.getAudioTracks().length === 0);
        if (videoRef.current) videoRef.current.srcObject = stream;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          ctx.createMediaStreamSource(new MediaStream([audioTrack])).connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const loop = () => {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
            const level = Math.min(100, Math.round((avg / 90) * 100));
            setAudioLevel(level);
            if (level > 8) {
              lastSoundAtRef.current = Date.now();
              if (answerCaptureStateRef.current === 'listening' && silenceTimerRef.current) {
                window.clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
                scheduleSilenceAutoPause();
              }
            }
            if (answerCaptureStateRef.current === 'listening') {
              if (level < 3) setMediaError("We can't hear you clearly.");
              if (level > 65) highNoiseMsRef.current += 250;
              else highNoiseMsRef.current = Math.max(0, highNoiseMsRef.current - 250);
              if (highNoiseMsRef.current > 3000) {
                setNoiseWarning('Background noise detected. Please move to a quieter place.');
                pauseAnswerCapture('paused');
                speak('There seems to be background noise. Please move to a quieter place, then resume your answer.', 'AI_SPEAKING', () => setConversationState('USER_LISTENING'));
                highNoiseMsRef.current = 0;
              }
            }
            analyserFrameRef.current = requestAnimationFrame(loop);
          };
          loop();
        }
      })
      .catch(() => {
        setCameraBlocked(true);
        setMicBlocked(true);
        setFallbackOpen(true);
        setMediaError('Camera or microphone permission was denied. You can continue with typed answers.');
      });

    return () => {
      cleanupAudio();
      stopMedia();
    };
  }, [cleanupAudio, interview, pauseAnswerCapture, scheduleSilenceAutoPause, speak, stopMedia]);

  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((track) => { track.enabled = cameraEnabled; });
  }, [cameraEnabled]);

  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((track) => { track.enabled = micEnabled; });
    if (!micEnabled) {
      pauseAnswerCapture('idle');
      setFallbackOpen(true);
    }
  }, [micEnabled, pauseAnswerCapture]);

  useEffect(() => {
    resetAnswerState();
    if (question) currentQuestionIdRef.current = question.questionId;
  }, [interview?.id, question?.questionId]);

  useEffect(() => {
    if (!interview || !question || initializedRef.current || !voicesReady) return;
    initializedRef.current = true;
    speak(GREETING, 'GREETING', () => askQuestion(0));
  }, [askQuestion, interview, question, speak, voicesReady]);

  useEffect(() => {
    if (!question || (conversationState !== 'USER_LISTENING' && conversationState !== 'USER_SPEAKING')) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          if (followUpQuestion || activeTargetRef.current === 'followup') saveAnswer(undefined, 'timer');
          else submitMainAnswer(undefined, 'timer');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [conversationState, followUpQuestion, question?.questionId]);

  const confirmQuit = async () => {
    if (!interview) return;
    setConversationState('ABANDONED');
    cleanupAudio();
    stopMedia();
    try {
      await api.post('/hr-interview/abandon', { interviewId: interview.id });
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      navigate('/dashboard');
    }
  };

  const clearCurrentAnswer = () => {
    if (followUpQuestion || activeTargetRef.current === 'followup') {
      followUpAnswerRef.current = '';
      setFollowUpAnswer('');
    } else {
      mainAnswerRef.current = '';
      finalTranscriptRef.current = '';
      setCurrentTranscript('');
      setManualAnswer('');
    }
    interimTranscriptRef.current = '';
    setInterimTranscript('');
    emptyAnswerPromptedRef.current = false;
  };

  const toggleAnswerCapture = () => {
    if (answerCaptureState === 'listening') {
      pauseAnswerCapture('paused');
      return;
    }
    startListening(followUpQuestion ? 'followup' : 'main');
  };

  const continueInterview = () => {
    if (followUpQuestion) saveAnswer(followUpAnswer || manualAnswer);
    else submitMainAnswer(manualAnswer || mainAnswerRef.current || currentTranscript);
  };

  const answerButtonText =
    answerCaptureState === 'listening'
      ? 'Pause Answer'
      : answerCaptureState === 'paused'
        ? 'Resume Answer'
        : 'Start Answer';

  const statusText = (() => {
    if (conversationState === 'GREETING' || conversationState === 'AI_SPEAKING' || conversationState === 'FOLLOW_UP') return 'Speaking';
    if (conversationState === 'PROCESSING') return 'Analyzing your response...';
    if (conversationState === 'SILENCE_DETECTED') return 'Silence detected';
    if (answerCaptureState === 'listening' && conversationState === 'USER_SPEAKING') return 'User speaking';
    if (answerCaptureState === 'listening') return 'Listening...';
    if (answerCaptureState === 'paused') return 'Paused';
    if (conversationState === 'USER_LISTENING') return 'Ready';
    return 'Preparing';
  })();
  const speaking = conversationState === 'GREETING' || conversationState === 'AI_SPEAKING' || conversationState === 'FOLLOW_UP';
  const listening = answerCaptureState === 'listening';

  if (!interview) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-black text-slate-900 dark:text-neutral-100">HR interview session not found</h1>
          <Link to="/hr-interview" className="mt-6 inline-flex rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white">Start Again</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">HR Interview Simulator</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-neutral-100">{interview.role} HR Round</h1>
          </div>
          <button onClick={() => setShowQuitConfirm(true)} className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20">
            Quit Interview
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="relative aspect-video overflow-hidden rounded-3xl bg-neutral-950">
              <video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraEnabled && !cameraBlocked ? '' : 'opacity-20'}`} />
              {(!cameraEnabled || cameraBlocked) && <div className="absolute inset-0 grid place-items-center text-sm font-black text-white">Camera Unavailable</div>}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button onClick={() => setCameraEnabled((v) => !v)} disabled={cameraBlocked} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black dark:border-neutral-800 disabled:opacity-60">
                {cameraBlocked ? 'Camera Blocked' : cameraEnabled ? 'Camera ready' : 'Camera off'}
              </button>
              <button onClick={() => setMicEnabled((v) => !v)} disabled={micBlocked} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black dark:border-neutral-800 disabled:opacity-60">
                {micBlocked ? 'Microphone Blocked' : listening ? 'Listening...' : micEnabled ? 'Microphone ready' : 'Mic off'}
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-xs font-black text-slate-500 dark:text-neutral-400">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-neutral-950">
                <span>{network.label}</span>
                <span className={`flex items-end gap-0.5 ${network.label === 'Offline' ? 'text-red-500' : 'text-blue-500'}`}>
                  {[1, 2, 3].map((bar) => <span key={bar} className={`w-1.5 rounded-sm ${network.bars >= bar ? 'bg-current' : 'bg-slate-300 dark:bg-neutral-700'}`} style={{ height: `${bar * 5 + 5}px` }} />)}
                </span>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-neutral-950">
                <div className="mb-2 flex justify-between"><span>Audio level</span><span>{audioLevel}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${audioLevel}%` }} /></div>
              </div>
              {(mediaError || noiseWarning) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">{noiseWarning || mediaError}</div>}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-lg font-black text-white ${speaking ? 'ring-4 ring-blue-400/30 animate-pulse' : listening ? 'ring-4 ring-emerald-400/30' : ''}`}>
                  PS
                  {listening && <span className="absolute -bottom-1 h-3 w-3 rounded-full bg-emerald-500 animate-ping" />}
                </div>
                <div>
                  <p className="text-lg font-black text-slate-950 dark:text-neutral-100">Priya Sharma</p>
                  <p className="text-sm font-bold text-slate-400 dark:text-neutral-500">HR Interviewer</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                Question {currentIndex + 1} of {interview.questions.length} / {formatTime(secondsLeft)}
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{question?.category}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">{statusText}</span>
              {conversationState === 'PROCESSING' && <span className="text-xl leading-none text-blue-500"><span className="animate-pulse">.</span><span className="animate-pulse delay-150">.</span><span className="animate-pulse delay-300">.</span></span>}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Current question</p>
              <h2 className="text-2xl font-black leading-snug text-slate-950 dark:text-neutral-100">{question?.question}</h2>
              {speaking && <div className="mt-5 flex h-8 items-end gap-1 text-blue-500">{[10, 18, 24, 15, 28, 12, 22].map((h, i) => <span key={i} className="w-1.5 animate-pulse rounded-full bg-current" style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />)}</div>}
              {listening && <div className="mt-5 text-sm font-bold text-emerald-600 dark:text-emerald-300">Listening naturally. Pause when you want to stop capture.</div>}
            </div>

            <div key={`${interview.id}-${question?.questionId}`} className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">Live transcript</p>
                <button onClick={clearCurrentAnswer} disabled={saving || speaking} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-300">Clear</button>
              </div>
              <p className="mt-2 min-h-[72px] whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700 dark:text-neutral-300">
                {fullAnswer || 'Your answer will appear here while you speak.'}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button onClick={toggleAnswerCapture} disabled={saving || speaking || !micEnabled || micBlocked} className="min-h-12 flex-1 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  {answerButtonText}
                </button>
                <button onClick={continueInterview} disabled={saving || speaking} className="min-h-12 flex-1 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : followUpQuestion ? 'Continue' : 'Continue'}
                </button>
              </div>
            </div>

            {followUpQuestion && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <p className="text-sm font-black text-blue-800 dark:text-blue-200">Follow-up: {followUpQuestion}</p>
                <p className="mt-2 min-h-[48px] text-sm font-semibold text-blue-900/80 dark:text-blue-100/80">{followUpAnswer || 'Answer the follow-up naturally.'}</p>
              </div>
            )}

            {fallbackOpen && (
              <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-neutral-800 dark:bg-neutral-950" open={fallbackOpen}>
                <summary className="cursor-pointer text-sm font-black text-slate-700 dark:text-neutral-200">Manual fallback controls</summary>
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => question && speak(question.question, 'AI_SPEAKING', () => setConversationState('USER_LISTENING'))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black dark:border-neutral-800">Repeat question</button>
                    <button onClick={() => setIsManualMode((value) => !value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black dark:border-neutral-800">Type answer manually</button>
                    <button onClick={continueInterview} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">Continue</button>
                  </div>
                  {isManualMode && (
                    <textarea
                      value={followUpQuestion ? followUpAnswer : manualAnswer}
                      onChange={(e) => {
                        if (followUpQuestion) {
                          followUpAnswerRef.current = e.target.value;
                          setFollowUpAnswer(e.target.value);
                        } else {
                          mainAnswerRef.current = e.target.value;
                          setManualAnswer(e.target.value);
                        }
                      }}
                      className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none dark:border-neutral-800 dark:bg-neutral-900"
                      placeholder={followUpQuestion ? 'Type your follow-up answer here.' : 'Type your answer here.'}
                    />
                  )}
                </div>
              </details>
            )}

            {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}
          </section>
        </div>
      </div>

      {showQuitConfirm && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-2xl font-black text-slate-950 dark:text-neutral-100">Quit HR Interview?</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500 dark:text-neutral-400">
              You have completed {completedCount} of {interview.questions.length} questions. Your completed answers will be saved, but this interview will be marked as abandoned.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setShowQuitConfirm(false)} className="min-h-12 flex-1 rounded-2xl border border-slate-200 px-4 text-sm font-black dark:border-neutral-800">Cancel</button>
              <button onClick={async () => {
                setConversationState('ABANDONED');
                cleanupAudio();
                stopMedia();
                try { await api.post('/hr-interview/abandon', { interviewId: interview.id }); } catch (err: any) { if (err instanceof ApiError && err.status === 401) logout(); }
                navigate('/dashboard');
              }} className="min-h-12 flex-1 rounded-2xl bg-red-600 px-4 text-sm font-black text-white">Quit Interview</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default HRInterviewSimulator;
