import { IsString, IsOptional, IsEnum } from 'class-validator';
import { LlmProvider } from '../enums/llm-provider.enum';

export class EvaluateCandidateDto {
  @IsString()
  jobDescription: string;

  @IsOptional()
  @IsEnum(LlmProvider)
  llmProvider?: LlmProvider;
}
