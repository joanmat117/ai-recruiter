import { IsString, IsOptional, Validate } from 'class-validator';
import { EvaluationRequest } from '../../modules/recruiter/value-objects/evaluation-request.vo';
import { S3KeyValidator } from '../../modules/recruiter/validators/s3-key.validator';
import { JobDescriptionValidator } from '../../modules/recruiter/validators/job-description.validator';

export class EvaluateCandidateDto {
  @IsString()
  @Validate(S3KeyValidator)
  s3Key: string;

  @IsString()
  @Validate(JobDescriptionValidator)
  jobDescription: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  toRequest(): EvaluationRequest {
    return EvaluationRequest.from(this);
  }
}