import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { LlmProvider } from '../enums/llm-provider.enum';

export class JobDescriptionDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(LlmProvider)
  llmProvider?: LlmProvider;
}

export class CompareCandidatesDto {
  @IsArray()
  @IsString({ each: true })
  candidateIds: string[];

  @IsOptional()
  @IsString()
  jobDescription?: string;
}

export class InterviewQuestionsDto {
  @IsString()
  candidateId: string;

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsEnum(LlmProvider)
  llmProvider?: LlmProvider;
}

export class FeedbackDto {
  @IsString()
  candidateId: string;

  @IsString()
  evaluationResult: string;

  @IsOptional()
  @IsEnum(LlmProvider)
  llmProvider?: LlmProvider;
}
