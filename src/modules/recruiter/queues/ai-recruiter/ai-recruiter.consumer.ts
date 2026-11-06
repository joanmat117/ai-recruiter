import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, AI_RECRUITER_JOBS } from '../../constants/job-names';
import { Inject, Logger } from '@nestjs/common';
import { EvaluateCandidateUseCase } from '../../use-cases/evaluate-candidate.use-case';
import { EVALUATION_REPOSITORY } from '../../interfaces/evaluation.repository.interface';
import type { IEvaluationRepository } from '../../interfaces/evaluation.repository.interface';
import { RecruiterOutput } from '../../state/recruiter.state';

export type AiRecruiterJob = Job<{
  cvText: string;
  jobDescription: string;
  jobTitle?: string;
  sourceS3Key: string;
}, RecruiterOutput>;

@Processor(QUEUE_NAMES.AI_RECRUITER)
export class AiRecruiterConsumer extends WorkerHost {
  private readonly logger = new Logger(AiRecruiterConsumer.name);

  constructor(
    private readonly evaluateCandidateUseCase: EvaluateCandidateUseCase,
    @Inject(EVALUATION_REPOSITORY) private readonly evaluationRepository: IEvaluationRepository,
  ) {
    super();
  }

  async process(job: AiRecruiterJob): Promise<RecruiterOutput> {
    const jobId = job.id ?? `job-${Date.now()}`;
    this.logger.log(`Evaluando candidato para job ${jobId}`);

    const { cvText, jobDescription, jobTitle, sourceS3Key } = job.data;

    const result = await this.evaluateCandidateUseCase.execute({
      cvText,
      jobDescription,
      jobTitle,
    });

    // Persistir resultado en BD (transaccional con el graph)
    await this.evaluationRepository.save({
      jobId,
      s3Key: sourceS3Key,
      cvText,
      jobDescription,
      jobTitle,
      scores: result.scores,
      recommendation: result.recommendation,
      matchDetails: result.match,
      output: result.output,
      meta: result.meta,
    });

    this.logger.log(`Resultado persistido para job ${jobId}`);
    return result;
  }

  // ELIMINADO onCompleted side effect - la persistencia es transaccional en process()
  
  @OnWorkerEvent('failed')
  async onFailed(job: AiRecruiterJob | undefined, err: Error) {
    this.logger.error(`Evaluación fallida: ${err.message}`);
    // BullMQ maneja retries via job options; DLQ configurado en module
  }
}