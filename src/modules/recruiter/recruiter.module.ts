import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LlmModule } from '../../modules/llm/llm.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MemorySaver } from '@langchain/langgraph';
import { QUEUE_NAMES } from './constants/job-names';

import { PdfExtractorTool } from './tools/pdf-extractor.tool';
import { JobMatcherTool } from './tools/job-matcher.tool';
import { RecruiterService } from './services/recruiter.service';
import { RecruiterController } from './controllers/recruiter.controller';
import { UploadController } from './controllers/upload.controller';
import { PdfConsumer } from './queues/pdf/pdf.consumer';
import { AiRecruiterConsumer } from './queues/ai-recruiter/ai-recruiter.consumer';
import { EXTRACTED_PDF_REPOSITORY } from './interfaces/extracted-pdf.repository.interface';
import { InMemoryExtractedPdfRepository } from './repositories/in-memory-extracted-pdf.repository';
import { FILE_STORAGE } from './interfaces/file-storage.interface';
import { S3FileStorageAdapter } from './adapters/s3-file-storage.adapter';
import { IEvaluationGraph } from './interfaces/evaluation-graph.interface';
import { createEvaluationGraph } from './graph/recruiter.graph';
import { LlmProviderFactory } from '../../modules/llm/llm-provider.factory';
import { ScoringPolicy } from './policies/scoring.policy';
import { EvaluateCandidateUseCase } from './use-cases/evaluate-candidate.use-case';
import { AnalyzeJobDescriptionCall, GenerateFeedbackCall } from './llm/structured-llm-calls';
import { EVALUATION_REPOSITORY } from './interfaces/evaluation.repository.interface';
import { DrizzleEvaluationRepository } from './repositories/drizzle-evaluation.repository';

@Module({
  imports: [
    CommonModule,
    LlmModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.PDF_EXTRACTION,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 5 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.AI_RECRUITER,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 3 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  providers: [
    RecruiterService,
    PdfExtractorTool,
    JobMatcherTool,
    PdfConsumer,
    AiRecruiterConsumer,
    ScoringPolicy,
    EvaluateCandidateUseCase,
    {
      provide: EXTRACTED_PDF_REPOSITORY,
      useClass: InMemoryExtractedPdfRepository,
    },
    {
      provide: FILE_STORAGE,
      useClass: S3FileStorageAdapter,
    },
    {
      provide: EVALUATION_REPOSITORY,
      useClass: DrizzleEvaluationRepository,
    },
    {
      provide: 'ANALYZE_JOB_CALL',
      useFactory: (llm: BaseChatModel) => new AnalyzeJobDescriptionCall(llm),
      inject: ['LLM_PROVIDER'],
    },
    {
      provide: 'GENERATE_FEEDBACK_CALL',
      useFactory: (llm: BaseChatModel) => new GenerateFeedbackCall(llm),
      inject: ['LLM_PROVIDER'],
    },
    {
      provide: 'EVALUATION_GRAPH',
      useFactory: (
        llmFactory: LlmProviderFactory,
        configService: ConfigService,
        jobMatcher: JobMatcherTool,
        analyzeJobCall: AnalyzeJobDescriptionCall,
        generateFeedbackCall: GenerateFeedbackCall,
        scoringPolicy: ScoringPolicy
      ) => {
        const llm = llmFactory.createProvider(configService.get('LLM_PROVIDER') || 'openai');
        const checkpointer = new MemorySaver(); // Fase 3: SqliteSaver/PostgresSaver
        return createEvaluationGraph(
          llm,
          jobMatcher,
          analyzeJobCall,
          generateFeedbackCall,
          scoringPolicy,
          checkpointer
        );
      },
      inject: [
        LlmProviderFactory,
        ConfigService,
        JobMatcherTool,
        'ANALYZE_JOB_CALL',
        'GENERATE_FEEDBACK_CALL',
        ScoringPolicy,
      ],
    },
  ],
  exports: [JobMatcherTool, PdfExtractorTool, ScoringPolicy, EvaluateCandidateUseCase, EVALUATION_REPOSITORY],
  controllers: [RecruiterController, UploadController],
})
export class RecruiterModule {}