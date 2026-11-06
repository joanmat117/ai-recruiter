import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IEvaluationGraph } from '../interfaces/evaluation-graph.interface';
import { RecruiterInput, RecruiterOutput } from '../state/recruiter.state';
import { ScoringPolicy } from '../policies/scoring.policy';
import { RunnableConfig } from '@langchain/core/runnables';

export interface EvaluateCandidateInput {
  cvText: string;
  jobDescription: string;
  jobTitle?: string;
}

@Injectable()
export class EvaluateCandidateUseCase {
  private readonly logger = new Logger(EvaluateCandidateUseCase.name);

  constructor(
    @Inject('EVALUATION_GRAPH') private readonly graph: IEvaluationGraph,
    private readonly scoringPolicy: ScoringPolicy
  ) {}

  async execute(input: EvaluateCandidateInput, config?: RunnableConfig): Promise<RecruiterOutput> {
    this.logger.log(`Iniciando evaluación para: ${input.jobTitle || 'Untitled'}`);

    const graphInput: RecruiterInput = {
      cvText: input.cvText,
      jobDescription: input.jobDescription,
      jobTitle: input.jobTitle || 'Untitled Position',
    };

    const result = await this.graph.invoke(graphInput, config);

    // Aplicar policy de scoring (thresholds, decisión final)
    const decision = this.scoringPolicy.decide(result.scores.overall);
    return {
      ...result,
      recommendation: {
        ...result.recommendation,
        decision,
        reasoning: `${result.recommendation.reasoning} | Policy: ${decision} at ${result.scores.overall}`,
      },
    };
  }
}