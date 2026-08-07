import { Annotation } from "@langchain/langgraph";
import { CandidateEducation, CandidateExperience, CandidateSkills, EducationMatch, ExperienceMatch, Recommendation, Scores, SkillMatch, StateSteps } from "../types/recruiter-state.type";

// Helper reducer para listas acumulativas
const append = <T>(left: T[], right: T[]): T[] => [...left, ...right];

/**
 * RecruiterStateAnnotation — Estado INTERNO del grafo.
 *
 * Es el "expediente" completo que circula entre nodos.
 * Los campos se escriben a mano alzada para que todos los nodos
 * los lean/escriban. El input y output schemas (abajo) controlan
 * qué ve el mundo exterior.
 */
export const RecruiterStateAnnotation = Annotation.Root({
  // ===== INPUT =====
  cvBuffer: Annotation<Buffer>,
  cvText: Annotation<string>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,

  // ===== EXTRACCIÓN DEL CV =====
  candidateSkills: Annotation<CandidateSkills>,
  candidateExperience: Annotation<CandidateExperience>,
  candidateEducation: Annotation<CandidateEducation[]>,
  candidateLanguages: Annotation<string[]>,
  candidateCertifications: Annotation<string[]>,

  // ===== ANÁLISIS DE OFERTA =====
  requiredSkills: Annotation<string[]>,
  preferredSkills: Annotation<string[]>,
  yearsExperienceRequired: Annotation<number>,
  educationRequired: Annotation<string>,
  industryKeywords: Annotation<string[]>,

  // ===== MATCHING =====
  skillMatch: Annotation<SkillMatch>,
  experienceMatch: Annotation<ExperienceMatch>,
  educationMatch: Annotation<EducationMatch>,

  // ===== SCORING =====
  scores: Annotation<Scores>,

  // ===== DECISIONES =====
  recommendation: Annotation<Recommendation>,
  confidenceLevel: Annotation<number>,
  reasoning: Annotation<string>,
  strengths: Annotation<string[]>({ reducer: append }),
  weaknesses: Annotation<string[]>({ reducer: append }),
  redFlags: Annotation<string[]>({ reducer: append }),
  greenFlags: Annotation<string[]>({ reducer: append }),

  // ===== OUTPUT =====
  interviewQuestions: Annotation<string[]>({ reducer: append }),
  feedbackForCandidate: Annotation<string>,
  salaryRecommendation: Annotation<string>,
  nextSteps: Annotation<string[]>({ reducer: append }),

  // ===== METADATA =====
  currentStep: Annotation<StateSteps>,
  errors: Annotation<string[]>({ reducer: append }),
  warnings: Annotation<string[]>({ reducer: append }),
  processingTime: Annotation<number>,
  timestamp: Annotation<Date>,
});

/**
 * RecruiterInputAnnotation — Lo que el mundo EXTERIOR puede pasar a invoke().
 * Es un subconjunto del state: solo lo que el grafo necesita para arrancar.
 */
export const RecruiterInputAnnotation = Annotation.Root({
  cvBuffer: Annotation<Buffer>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,
});

/**
 * RecruiterOutputAnnotation — Lo que el mundo EXTERIOR recibe de invoke().
 * Es un subconjunto del state: solo lo que tiene valor para el consumidor.
 * El resto (candidateSkills, skillMatch, etc.) queda privado al grafo.
 */
export const RecruiterOutputAnnotation = Annotation.Root({
  // ===== SCORING =====
  scores: Annotation<Scores>,

  // ===== DECISIONES =====
  recommendation: Annotation<Recommendation>,
  confidenceLevel: Annotation<number>,
  reasoning: Annotation<string>,
  strengths: Annotation<string[]>({ reducer: append }),
  weaknesses: Annotation<string[]>({ reducer: append }),
  redFlags: Annotation<string[]>({ reducer: append }),
  greenFlags: Annotation<string[]>({ reducer: append }),

  // ===== OUTPUT =====
  interviewQuestions: Annotation<string[]>({ reducer: append }),
  feedbackForCandidate: Annotation<string>,
  salaryRecommendation: Annotation<string>,
  nextSteps: Annotation<string[]>({ reducer: append }),

  // ===== METADATA =====
  currentStep: Annotation<StateSteps>,
  errors: Annotation<string[]>({ reducer: append }),
  warnings: Annotation<string[]>({ reducer: append }),
  processingTime: Annotation<number>,
  timestamp: Annotation<Date>,
});

// Tipos derivados — un solo lugar define el schema, TS deriva el resto.
// `RecruiterState` se mantiene para compatibilidad con RecruiterService.
export type RecruiterState = typeof RecruiterStateAnnotation.State;
export type RecruiterInput = typeof RecruiterInputAnnotation.State;
export type RecruiterOutput = typeof RecruiterOutputAnnotation.State;
