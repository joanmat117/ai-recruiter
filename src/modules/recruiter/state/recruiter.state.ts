import { Annotation } from '@langchain/langgraph';
import { StateSteps } from '../types/recruiter-state.type';

// ===== TIPOS COMPARTIDOS =====
export interface CandidateProfile {
  skills: string[];
  yearsOfExperience: number;
  experience: {
    startDate?: string;
    endDate?: string;
    summary: string;
  }[];
  education: {
    degree: string;
    field: string;
    institution?: string;
  }[];
  languages: {
    language: string;
    proficiency: string;
  };
}

export interface JobAnalysis {
  required: {
    skills: string[];
    yearsOfExperience: number;
    education: string;
  };
  preferred: {
    skills: string[];
  };
}

export interface MatchResult {
  score: number; // 0-100
  details: {
    skills: { matched: string[]; missing: string[]; score: number };
    experience: { score: number; reasoning: string };
    education: { score: number; reasoning: string };
  };
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  greenFlags: string[];
}

export interface Recommendation {
  decision: 'ADVANCE' | 'REVIEW' | 'REJECT';
  confidence: number;
  reasoning: string;
}

export interface Scores {
  overall: number;
  skills: number;
  experience: number;
  education: number;
}

export interface Output {
  interviewQuestions: string[];
  feedbackForCandidate: string;
  salarySuggestion: string;
  nextSteps: string[];
}

export interface Meta {
  step: StateSteps;
  errors: string[];
  warnings: string[];
  processingTime: number;
  timestamp: Date;
}

// ===== ESTADO INTERNO =====
export const RecruiterStateAnnotation = Annotation.Root({
  // Input
  cvText: Annotation<string>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,

  // Datos parseados
  candidate: Annotation<CandidateProfile>,
  job: Annotation<JobAnalysis>,

  // Resultados del matching
  match: Annotation<MatchResult>,
  recommendation: Annotation<Recommendation>,

  // Scores calculados
  scores: Annotation<Scores>,

  // Output generado
  output: Annotation<Output>,

  // Metadata
  meta: Annotation<Meta>,
});

// ===== INPUT PÚBLICO =====
export const RecruiterInputAnnotation = Annotation.Root({
  cvText: Annotation<string>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,
});

// ===== OUTPUT PÚBLICO =====
export const RecruiterOutputAnnotation = Annotation.Root({
  decision: Annotation<Recommendation['decision']>,
  confidence: Annotation<number>,
  reasoning: Annotation<string>,
  score: Annotation<number>,
  strengths: Annotation<string[]>,
  weaknesses: Annotation<string[]>,
  interviewQuestions: Annotation<string[]>,
  feedbackForCandidate: Annotation<string>,
  nextSteps: Annotation<string[]>,
  scores: Annotation<Scores>,
  recommendation: Annotation<Recommendation>,
  match: Annotation<MatchResult>,
  output: Annotation<Output>,
  meta: Annotation<Meta>,
});

// Tipos derivados
export type IRecruiterState = typeof RecruiterStateAnnotation.State;
export type IRecruiterInput = typeof RecruiterInputAnnotation.State;
export type IRecruiterOutput = typeof RecruiterOutputAnnotation.State;

// Export type aliases for backward compatibility
export type RecruiterState = IRecruiterState;
export type RecruiterInput = IRecruiterInput;
export type RecruiterOutput = IRecruiterOutput;