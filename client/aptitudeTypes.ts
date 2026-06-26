export type AptitudeQuestion = {
  questionId: string;
  source: string;
  company: string;
  section: string;
  topic: string;
  difficulty: string;
  question: string;
  options: Record<'A' | 'B' | 'C' | 'D', string>;
};

export type PerformanceItem = {
  name: string;
  total: number;
  correct: number;
  answered: number;
  accuracy: number;
};

export type AptitudeAnalysis = {
  score: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
  sectionPerformance: PerformanceItem[];
  topicPerformance: PerformanceItem[];
  difficultyPerformance: PerformanceItem[];
  averageTime: number;
  weakTopics: string[];
  strongTopics: string[];
};

export type AptitudeResultData = AptitudeAnalysis & {
  test: {
    testId: number;
    title: string;
    company: string | null;
    section: string | null;
    topic: string | null;
    difficulty: string | null;
    durationMinutes: number;
    status: string;
    startedAt: string;
    completedAt: string;
  };
  questions: Array<AptitudeQuestion & {
    selectedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    timeTakenSeconds: number;
  }>;
};
