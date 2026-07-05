export interface RecruiterState {
  // INPUT
  cvBuffer?: Buffer;
  cvText?: string;
  jobDescription?: string;
  jobTitle?: string;
  
  // EXTRACCIÓN DEL CV
  candidateSkills: { hard: string[]; soft: string[]; tools: string[]; };
  candidateExperience: { years: number; summary: string; companies: string[]; roles: string[]; };
  candidateEducation: Array<{ degree: string; institution: string; year: number; }>;
  candidateLanguages: string[];
  candidateCertifications: string[];
  
  // ANÁLISIS DE OFERTA
  requiredSkills: string[];
  preferredSkills: string[];
  yearsExperienceRequired: number;
  educationRequired: string;
  industryKeywords: string[];
  
  // MATCHING
  skillMatch: { matched: string[]; missing: string[]; matchPercentage: number; };
  experienceMatch: { meetsRequirement: boolean; yearsMatch: number; relevanceScore: number; };
  educationMatch: { meetsRequirement: boolean; relevancyScore: number; };
  
  // SCORING
  scores: { overall: number; skills: number; experience: number; education: number; };
  
  // DECISIONES
  recommendation: 'strong_hire' | 'hire' | 'consider' | 'reject';
  confidenceLevel: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  greenFlags: string[];
  
  // OUTPUT
  interviewQuestions: string[];
  feedbackForCandidate: string;
  salaryRecommendation?: string;
  nextSteps?: string[];
  
  // METADATA
  currentStep: 'idle' | 'parsing' | 'analyzing' | 'matching' | 'scoring' | 'complete' | 'error';
  errors: string[];
  warnings: string[];
  processingTime: number;
  timestamp: Date;
  llmProvider: 'openai' | 'openrouter' | 'gemini';
}
