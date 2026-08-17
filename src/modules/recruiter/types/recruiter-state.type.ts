
export interface CandidateSkills { hard: string[]; soft: string[]; tools: string[] }

export interface CandidateExperience { years: number; summary: string; companies: string[]; roles: string[] }

export interface CandidateEducation { degree: string; institution: string; year: number }

export interface SkillMatch { matched: string[]; missing: string[]; matchPercentage: number }

export interface ExperienceMatch { meetsRequirement: boolean; yearsMatch: number; relevanceScore: number }

export interface EducationMatch { meetsRequirement: boolean; relevancyScore: number }

export interface Scores { overall: number; skills: number; experience: number; education: number; }

export type Recommendation = 'strong_hire' | 'hire' | 'consider' | 'reject'

export enum StateSteps {
  Idle = 'idle',
  Parsing = 'parsing',
  Analyzing = 'analyzing',
  Matching = 'matching',
  Scoring = 'scoring',
  Feedback = 'feedback',
  Complete = 'complete',
  Error = 'error',
}

export type LlmProvider = 'openai' | 'openrouter' | 'gemini'
