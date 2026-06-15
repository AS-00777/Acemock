
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  education: string;
  skills: string[];
  yearsExperience: number;
  profileImage?: string;
  resumeUrl?: string;
  streakCount: number;
  lastInterviewDate?: string;
  badges: string[];
  // New Fields
  phoneNumber?: string;
  countryCode?: string;
  country?: string;
  city?: string;
  location?: string; // Legacy field for display
  bio?: string;
  gender?: string;
  experienceLevel?: string;
  preferredLanguage?: string;
  defaultDifficulty?: string;
  interviewMode?: 'Text' | 'Voice';
  theme?: 'Light' | 'Dark';
  voicePreference?: 'male' | 'female';
  // User Type Categorization
  userType?: 'Student' | 'Working Professional' | 'Job Seeker';
  educationLevel?: string;
  fieldOfStudy?: string;
  industry?: string;
  targetRole?: string;
}

export interface Question {
  id: number;
  question: string;
  is_coding: boolean;
  ideal_answer?: string;
  expectedAnswer?: string;
  keyConcepts?: string[];
  difficulty?: string;
  topic?: string;
  boilerplate?: string;
}

export interface InterviewSession {
  id: string;
  date: string;
  domain: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  skills: string[];
  questions: Question[];
  transcript: AnswerRecord[];
  score: number;
  feedback: string;
  overallRating: number;
  status?: 'Complete' | 'Incomplete';
}

export interface AnswerRecord {
  questionId: number;
  questionText: string;
  userAnswer: string;
  feedback?: string;
  score?: number;
  technicalAccuracy?: number;
  conceptCoverage?: number;
  communicationScore?: number;
  semanticSimilarity?: number;
  matchedConcepts?: string[];
  missingConcepts?: string[];
  codingAnswer?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  dateEarned: string;
}
