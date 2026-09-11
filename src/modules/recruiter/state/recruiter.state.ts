import { Annotation } from "@langchain/langgraph";

// ===== TIPOS COMPARTIDOS =====
export interface CandidateProfile {
  skills: string[];
  yearsOfExperience: number;
  experience: {
    startDate?: string,
    endDate?: string;
    summary: string
  }[];
  education: {
    degree: string;
    field: string;
    institution?: string;
  }[];
  languages: {
    language: string,
    proficiency: string
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
  decision: 'ADVANCE' | 'REJECT' | 'REVIEW';
  confidence: number;
  reasoning: string;
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

  // Output generado
  output: Annotation<{
    interviewQuestions: string[];
    feedbackForCandidate: string;
    salarySuggestion: string;
    nextSteps: string[];
  }>,

  // Metadata
  meta: Annotation<{
    step: 'parse' | 'analyze' | 'match' | 'recommend' | 'complete';
    errors: string[];
    warnings: string[];
    processingTime: number;
    timestamp: Date;
  }>,
});

// ===== INPUT PÚBLICO =====
export const RecruiterInputAnnotation = Annotation.Root({
  cvText: Annotation<string>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,
});

// ===== OUTPUT PÚBLICO =====
export const RecruiterOutputAnnotation = Annotation.Root({
  // Solo lo esencial
  decision: Annotation<Recommendation['decision']>,
  confidence: Annotation<number>,
  reasoning: Annotation<string>,

  // Para transparencia
  score: Annotation<number>,
  strengths: Annotation<string[]>,
  weaknesses: Annotation<string[]>,

  // Accionable
  interviewQuestions: Annotation<string[]>,
  feedbackForCandidate: Annotation<string>,
  nextSteps: Annotation<string[]>,
});

// Tipos derivados
export type IRecruiterState = typeof RecruiterStateAnnotation.State;
export type IRecruiterInput = typeof RecruiterInputAnnotation.State;
export type IRecruiterOutput = typeof RecruiterOutputAnnotation.State;
