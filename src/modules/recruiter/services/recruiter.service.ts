import { Injectable, Logger } from '@nestjs/common';
import { RecruiterOutput, RecruiterState } from '../state/recruiter.state';
import recruiterGraph from '../graph/recruiter.graph';
import { LlmProviderFactory } from 'src/modules/llm/llm-provider.factory';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecruiterService {
  private readonly logger = new Logger(RecruiterService.name);
  private readonly llmProvider: BaseChatModel

  constructor(
    private readonly llmProviderFactory: LlmProviderFactory,
    private readonly configService: ConfigService
  ) {
    this.llmProvider = this.llmProviderFactory.createProvider(
      this.configService.get<string>('LLM_PROVIDER') || 'openai'
    );

  }

  async evaluateCandidate(
    jobDescription: string,
    jobTitle: string,
  ): Promise<RecruiterOutput> {

    const result = await recruiterGraph.invoke({
      jobDescription,
      jobTitle,
    }, {
      configurable: {
        llm: this.llmProvider
      }
    })

    return result
  }

  async evaluateBatch(
    cvBuffers: Buffer[],
    jobDescription: string,
    jobTitle?: string,
    llmProvider?: string,
  ): Promise<{ jobId: string; status: string }[]> {
    const results: { jobId: string; status: string }[] = [];

    for (const cvBuffer of cvBuffers) {
      try {
        const result = await this.evaluateCandidate(cvBuffer, jobDescription, jobTitle, llmProvider);
        results.push({
          jobId: this.generateJobId(),
          status: result.currentStep === 'complete' ? 'completed' : 'failed',
        });
      } catch (error) {
        results.push({
          jobId: this.generateJobId(),
          status: 'failed',
        });
      }
    }

    return results;
  }

  async reEvaluate(
    jobId: string,
    llmProvider: string,
  ): Promise<RecruiterState | null> {
    const existing = this.jobStatuses.get(jobId);
    if (!existing || !existing.cvBuffer) {
      return null;
    }

    return this.evaluateCandidate(
      existing.cvBuffer,
      existing.jobDescription || '',
      existing.jobTitle,
      llmProvider,
    );
  }

  async compareCandidates(
    evaluations: RecruiterState[],
  ): Promise<{
    rankings: Array<{
      rank: number;
      jobId: string;
      score: number;
      recommendation: string;
      strengths: string[];
    }>;
    summary: string;
  }> {
    const sorted = [...evaluations].sort((a, b) => b.scores.overall - a.scores.overall);

    const rankings = sorted.map((eval_, index) => ({
      rank: index + 1,
      jobId: `job-${index}`,
      score: eval_.scores.overall,
      recommendation: eval_.recommendation,
      strengths: eval_.strengths,
    }));

    return {
      rankings,
      summary: `Top candidate scored ${rankings[0]?.score || 0}/100 with recommendation: ${rankings[0]?.recommendation || 'N/A'}`,
    };
  }

  getJobStatus(jobId: string): RecruiterState | undefined {
    return this.jobStatuses.get(jobId);
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
