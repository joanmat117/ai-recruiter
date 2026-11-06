import { Injectable, Logger } from '@nestjs/common';
import { EvaluateCandidateUseCase, EvaluateCandidateInput } from '../use-cases/evaluate-candidate.use-case';
import { RecruiterOutput } from '../state/recruiter.state';

@Injectable()
export class RecruiterService {
  private readonly logger = new Logger(RecruiterService.name);

  constructor(
    private readonly evaluateCandidateUseCase: EvaluateCandidateUseCase
  ) {}

  async evaluateWithCvText(input: EvaluateCandidateInput): Promise<RecruiterOutput> {
    return this.evaluateCandidateUseCase.execute(input);
  }
}