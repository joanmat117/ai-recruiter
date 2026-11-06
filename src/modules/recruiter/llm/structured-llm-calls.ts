import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

// --- Analyze Job Description ---
export const JobAnalysisSchema = z.object({
  required: z.object({
    skills: z.array(z.string()),
    yearsOfExperience: z.number().min(0),
    education: z.string(),
  }),
  preferred: z.object({
    skills: z.array(z.string()),
  }),
});
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export class AnalyzeJobDescriptionCall {
  private readonly chain;
  constructor(llm: BaseChatModel) {
    const structuredLlm = llm.withStructuredOutput(JobAnalysisSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `Eres un analista de RRHH experto. Extrae requisitos estructurados de la descripción del puesto.
Identifica skills técnicas requeridas, años de experiencia mínima, nivel educativo, y skills preferidas (nice-to-have).
Responde SOLO con el JSON válido según el schema.`,
      ],
      ['human', 'Job Title: {jobTitle}\n\nJob Description:\n{jobDescription}'],
    ]);
    this.chain = prompt.pipe(structuredLlm);
  }
  async invoke(input: { jobTitle: string; jobDescription: string }): Promise<JobAnalysis> {
    return this.chain.invoke(input);
  }
}

// --- Generate Feedback ---
export const FeedbackSchema = z.object({
  interviewQuestions: z.array(z.string()).max(8),
  feedbackForCandidate: z.string(),
  nextSteps: z.array(z.string()),
  salarySuggestion: z.string(),
});
export type FeedbackOutput = z.infer<typeof FeedbackSchema>;

export interface FeedbackInput {
  candidateProfile: string;
  jobAnalysis: string;
  matchResult: string;
  scores: string;
  recommendation: string;
}

export class GenerateFeedbackCall {
  private readonly chain;
  constructor(llm: BaseChatModel) {
    const structuredLlm = llm.withStructuredOutput(FeedbackSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `Eres un reclutador senior. Genera feedback personalizado y preguntas de entrevista.
Basándote en el perfil del candidato, análisis del puesto, match y scores.
Sé constructivo, específico y accionable. Responde SOLO JSON válido.`,
      ],
      [
        'human',
        `Candidate Profile: {candidateProfile}
Job Analysis: {jobAnalysis}
Match Result: {matchResult}
Scores: {scores}
Recommendation: {recommendation}`,
      ],
    ]);
    this.chain = prompt.pipe(structuredLlm);
  }
  async invoke(input: FeedbackInput): Promise<FeedbackOutput> {
    return this.chain.invoke(input);
  }
}