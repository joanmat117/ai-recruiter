import { RecruiterOutput } from '../state/recruiter.state';

export interface IEvaluationRepository {
  save(input: EvaluationInput): Promise<EvaluationOutput>;
  findByJobId(jobId: string): Promise<EvaluationOutput | null>;
  findByS3Key(s3Key: string): Promise<EvaluationOutput | null>;
  findRecent(limit?: number): Promise<EvaluationOutput[]>;
  searchByEmbedding(embedding: number[], limit?: number): Promise<EvaluationOutput[]>; // Fase 5
}

export const EVALUATION_REPOSITORY = Symbol('IEvaluationRepository');

export interface EvaluationInput {
  jobId: string;
  s3Key: string;
  cvText: string;
  jobDescription: string;
  jobTitle?: string;
  cvEmbedding?: number[]; // pgvector
  scores: RecruiterOutput['scores'];
  recommendation: RecruiterOutput['recommendation'];
  matchDetails: RecruiterOutput['match'];
  output: RecruiterOutput['output'];
  meta: RecruiterOutput['meta'];
}

export interface EvaluationOutput extends EvaluationInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}