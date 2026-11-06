# Plan de Implementación — Arquitectura Async (Queue-Based)

> **Basado en:** Código real, `TODO.md`, commits (`b7e90b5 add s3`, `d33bfc7 bullmq partially`, `01a7230 wire LangGraph`), y dirección async que el proyecto ya tiene.
> **Objetivo:** Completar el pipeline `S3 → PDF Queue → AI Recruiter Queue → LangGraph → Drizzle/pgvector`.

---

## Decisiones Arquitectónicas (OOP/Design Patterns) — **OBLIGATORIAS**

> Estas decisiones se aplican **antes y durante** todas las fases. No son opcionales.

| # | Decisión | Patrón/Principio | Qué Cambia |
|---|----------|------------------|------------|
| **A1** | **Graph detrás de Port `IEvaluationGraph`** | Dependency Inversion | Worker no importa `recruiterGraph` directo; inyecta `IEvaluationGraph` |
| **A2** | **Use Case `EvaluateCandidateUseCase`** | Single Responsibility | Worker (transport) → Use Case (application logic) → Graph Port |
| **A3** | **Structured LLM Calls como Strategy** | Strategy | `AnalyzeJobCall`, `GenerateFeedbackCall` inyectables, testeables, intercambiables |
| **A4** | **Transactional Outbox para Queue→Queue** | Transactional Outbox | `PdfConsumer.process()` retorna `NextJob` + data; BullMQ job chaining nativo o outbox table |
| **A5** | **Value Objects para Inputs** | Value Object / Encapsulation | `EvaluationRequest`, `S3Key`, `JobDescription` validan invariantes en constructor |
| **A6** | **ScoringPolicy inyectable** | Strategy/Policy | Pesos, thresholds, decisión configurables via ConfigService, no hardcodeados |
| **A7** | **Error Handling explícito en Nodos + Graph Edges** | Robustness | Nodos retornan `Result<Partial<State>, Error>`; graph tiene conditional edge `Error` |
| **A8** | **Constants para Job Names / Keys** | Hygiene | `AI_RECRUITER_JOBS.EVALUATE_CANDIDATE` en vez de string literals |
| **A9** | **Immutabilidad estricta en State Updates** | Immutability | Nodos retornan objeto nuevo completo o usan `produce` (Immer); no shallow spread anidado |

---

## Visión General del Flujo (con Arquitectura Correcta)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Cliente    │────►│  S3 Presigned│────►│  PDF Queue       │────►│  PDF Consumer      │────►│  AI Recruiter    │
│  (Browser)  │     │  POST Endpoint│     │  (BullMQ)        │     │  (Worker/Processor)│     │  Queue           │
└─────────────┘     └──────────────┘     └──────────────────┘     └────────┬──────────┘     └────────┬─────────┘
                                                                            │                       │
                                                                            ▼                       ▼
                                                                  ┌─────────────────┐     ┌─────────────────────┐
                                                                  │ Transactional   │     │ EvaluateCandidate   │
                                                                  │ Outbox / Job    │     │ UseCase             │
                                                                  │ Chaining        │     │ ─────────────────   │
                                                                  └────────┬────────┘     │ • IEvaluationGraph  │
                                                                           │            │ • ScoringPolicy     │
                                                                           │            └──────────┬──────────┘
                                                                           │                       │
                                                                           ▼                       ▼
                                                                ┌─────────────────────┐  ┌──────────────────┐
                                                                │ LangGraph           │  │ Drizzle + pgvector│
                                                                │ (cvText + JD)       │  │ (Persist Result)  │
                                                                │ • Analyzer (LLM)    │  └──────────────────┘
                                                                │ • Matcher (Tool)    │
                                                                │ • Scorer (Policy)   │
                                                                │ • Feedback (LLM)    │
                                                                └─────────────────────┘
```

**Arquitectura en capas:**
- **Transport:** Controllers, BullMQ Workers (thin, solo wiring)
- **Application:** Use Cases (`EvaluateCandidateUseCase`), Policies (`ScoringPolicy`)
- **Domain/Graph:** `IEvaluationGraph` port, Nodes (pure functions), Tools
- **Infrastructure:** LLM Providers, S3 Adapter, Drizzle Repositories, Embedding Service

**Cliente:** Sube PDF directo a S3 (presigned POST) → API recibe `{ s3Key, jobDescription }` → Encola job.
**Server:** Workers procesan async → Use Case orquesta Graph → Resultado persistido en DB.

**Cliente:** Sube PDF directo a S3 (presigned POST) → API recibe `{ s3Key, jobDescription }` → Encola job.
**Server:** Workers procesan async → Use Case orquesta Graph → Resultado persistido en DB.

---

## FASE 0: Setup Arquitectónico (Pre-requisito para todo)

> **Ejecutar ANTES de Fase 1.** Establece la arquitectura correcta para evitar rework.

### 0.1 Port `IEvaluationGraph` + Provider Binding
**Archivo nuevo:** `src/modules/recruiter/interfaces/evaluation-graph.interface.ts`

```typescript
import { RecruiterInput, RecruiterOutput } from '../state/recruiter.state';
import { RunnableConfig } from '@langchain/core/runnables';

export interface IEvaluationGraph {
  invoke(input: RecruiterInput, config?: RunnableConfig): Promise<RecruiterOutput>;
  // Opcional para streaming futuro:
  // stream(input: RecruiterInput, config?: RunnableConfig): AsyncGenerator<Partial<RecruiterOutput>>;
}
```

**Modificar:** `src/modules/recruiter/graph/recruiter.graph.ts` — exportar factory function:

```typescript
// Al final del archivo, AGREGAR:
export function createEvaluationGraph(
  llm: BaseChatModel,
  jobMatcher: JobMatcherTool,
  checkpointer?: Checkpointer
): IEvaluationGraph {
  const workflow = new StateGraph(RecruiterStateAnnotation, {
    input: RecruiterInputAnnotation,
    output: RecruiterOutputAnnotation,
  })
    .addNode('analyzer', createAnalyzerNode(llm))
    .addNode('matcher', createMatcherNode(jobMatcher))
    .addNode('scorer', createScorerNode(jobMatcher))
    .addNode('feedback', createFeedbackNode(llm))
    .addEdge('__start__', 'analyzer')
    .addEdge('analyzer', 'matcher')
    .addEdge('matcher', 'scorer')
    .addEdge('scorer', 'feedback')
    .addEdge('feedback', '__end__');

  return workflow.compile({ checkpointer });
}
```

**Registrar en Module:** `src/modules/recruiter/recruiter.module.ts`

```typescript
import { IEvaluationGraph } from './interfaces/evaluation-graph.interface';
import { createEvaluationGraph } from './graph/recruiter.graph';
import { JobMatcherTool } from './tools/job-matcher.tool';
import { LlmProviderFactory } from '../../modules/llm/llm-provider.factory';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MemorySaver } from '@langchain/langgraph';

// En providers array:
{
  provide: 'EVALUATION_GRAPH',
  useFactory: (
    llmFactory: LlmProviderFactory,
    configService: ConfigService,
    jobMatcher: JobMatcherTool,
  ) => {
    const llm = llmFactory.createProvider(configService.get('LLM_PROVIDER') || 'openai');
    const checkpointer = new MemorySaver(); // Fase 3: cambiar a SqliteSaver/PostgresSaver
    return createEvaluationGraph(llm, jobMatcher, checkpointer);
  },
  inject: [LlmProviderFactory, ConfigService, JobMatcherTool],
},
```

---

### 0.2 Use Case `EvaluateCandidateUseCase`
**Archivo nuevo:** `src/modules/recruiter/use-cases/evaluate-candidate.use-case.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IEvaluationGraph } from '../interfaces/evaluation-graph.interface';
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
    private readonly scoringPolicy: ScoringPolicy,
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
```

---

### 0.3 ScoringPolicy (Strategy Inyectable)
**Archivo nuevo:** `src/modules/recruiter/policies/scoring.policy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ScoringWeights {
  skills: number;
  experience: number;
  education: number;
}

export interface ScoringThresholds {
  advance: number;
  review: number;
  reject: number;
}

export type RecommendationDecision = 'ADVANCE' | 'REVIEW' | 'REJECT';

@Injectable()
export class ScoringPolicy {
  private readonly weights: ScoringWeights;
  private readonly thresholds: ScoringThresholds;

  constructor(configService: ConfigService) {
    this.weights = {
      skills: configService.get<number>('SCORING_WEIGHT_SKILLS') ?? 0.5,
      experience: configService.get<number>('SCORING_WEIGHT_EXPERIENCE') ?? 0.3,
      education: configService.get<number>('SCORING_WEIGHT_EDUCATION') ?? 0.2,
    };
    this.thresholds = {
      advance: configService.get<number>('SCORING_THRESHOLD_ADVANCE') ?? 85,
      review: configService.get<number>('SCORING_THRESHOLD_REVIEW') ?? 50,
      reject: configService.get<number>('SCORING_THRESHOLD_REJECT') ?? 0,
    };
  }

  getWeights(): ScoringWeights { return this.weights; }
  getThresholds(): ScoringThresholds { return this.thresholds; }

  decide(overallScore: number): RecommendationDecision {
    if (overallScore >= this.thresholds.advance) return 'ADVANCE';
    if (overallScore >= this.thresholds.review) return 'REVIEW';
    return 'REJECT';
  }

  calculateOverall(partial: { skills: number; experience: number; education: number }): number {
    return Math.round(
      partial.skills * this.weights.skills +
      partial.experience * this.weights.experience +
      partial.education * this.weights.education
    );
  }
}
```

**Registrar en Module:** `recruiter.module.ts` providers array:
```typescript
ScoringPolicy,
```

---

### 0.4 Structured LLM Call Strategies (Para Analyzer y Feedback)
**Archivo nuevo:** `src/modules/recruiter/llm/structured-llm-calls.ts`

```typescript
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
      ['system', `Eres un analista de RRHH experto. Extrae requisitos estructurados de la descripción del puesto.
Identifica skills técnicas requeridas, años de experiencia mínima, nivel educativo, y skills preferidas (nice-to-have).
Responde SOLO con el JSON válido según el schema.`],
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
      ['system', `Eres un reclutador senior. Genera feedback personalizado y preguntas de entrevista.
Basándote en el perfil del candidato, análisis del puesto, match y scores.
Sé constructivo, específico y accionable. Responde SOLO JSON válido.`],
      ['human', `Candidate Profile: {candidateProfile}
Job Analysis: {jobAnalysis}
Match Result: {matchResult}
Scores: {scores}
Recommendation: {recommendation}`],
    ]);
    this.chain = prompt.pipe(structuredLlm);
  }
  async invoke(input: FeedbackInput): Promise<FeedbackOutput> {
    return this.chain.invoke(input);
  }
}
```

**Registrar en Module:** providers array:
```typescript
{
  provide: 'ANALYZE_JOB_CALL',
  useFactory: (llm: BaseChatModel) => new AnalyzeJobDescriptionCall(llm),
  inject: ['LLM_PROVIDER'], // ver 0.5
},
{
  provide: 'GENERATE_FEEDBACK_CALL',
  useFactory: (llm: BaseChatModel) => new GenerateFeedbackCall(llm),
  inject: ['LLM_PROVIDER'],
},
```

---

### 0.5 LLM Provider como Token Inyectable (para Strategies)
**Modificar:** `src/modules/llm/llm.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { LlmProviderFactory } from './llm-provider.factory';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

@Module({
  providers: [
    LlmProviderFactory,
    {
      provide: 'LLM_PROVIDER',
      useFactory: (factory: LlmProviderFactory, config: ConfigService) => 
        factory.createProvider(config.get('LLM_PROVIDER') || 'openai'),
      inject: [LlmProviderFactory, ConfigService],
    },
  ],
  exports: [LlmProviderFactory, 'LLM_PROVIDER'],
})
export class LlmModule {}
```

---

### 0.6 Value Objects para Inputs
**Archivo nuevo:** `src/modules/recruiter/value-objects/evaluation-request.vo.ts`

```typescript
export class S3Key {
  private constructor(public readonly value: string) {}
  static from(raw: string): S3Key {
    if (!raw || !raw.startsWith('cvs/') || !raw.endsWith('.pdf')) {
      throw new Error(`Invalid S3Key format: ${raw}. Expected: cvs/<uuid>.pdf`);
    }
    return new S3Key(raw);
  }
}

export class JobDescription {
  private constructor(public readonly value: string) {}
  static from(raw: string): JobDescription {
    const trimmed = raw.trim();
    if (trimmed.length < 50) {
      throw new Error('JobDescription must be at least 50 characters');
    }
    return new JobDescription(trimmed);
  }
}

export class JobTitle {
  private constructor(public readonly value: string) {}
  static from(raw: string): JobTitle {
    return new JobTitle(raw.trim() || 'Untitled Position');
  }
}

export class EvaluationRequest {
  private constructor(
    public readonly s3Key: S3Key,
    public readonly jobDescription: JobDescription,
    public readonly jobTitle: JobTitle,
  ) {}

  static from(dto: { s3Key: string; jobDescription: string; jobTitle?: string }): EvaluationRequest {
    return new EvaluationRequest(
      S3Key.from(dto.s3Key),
      JobDescription.from(dto.jobDescription),
      dto.jobTitle ? JobTitle.from(dto.jobTitle) : JobTitle.from('Untitled Position'),
    );
  }
}
```

**DTO actualizado:** `src/common/dto/evaluate-candidate.dto.ts`
```typescript
import { IsString, IsOptional, Validate } from 'class-validator';
import { EvaluationRequest } from '../../modules/recruiter/value-objects/evaluation-request.vo';

export class EvaluateCandidateDto {
  @IsString()
  @Validate(S3KeyValidator) // custom validator que usa S3Key.from
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
```

---

### 0.7 Constants para Job Names
**Archivo nuevo:** `src/modules/recruiter/constants/job-names.ts`

```typescript
export const PDF_JOBS = {
  EXTRACT_PDF: 'extract-pdf',
} as const;

export const AI_RECRUITER_JOBS = {
  EVALUATE_CANDIDATE: 'evaluate-candidate',
} as const;

export const QUEUE_NAMES = {
  PDF_EXTRACTION: 'pdf-extraction-queue',
  AI_RECRUITER: 'ai-recruiter-queue',
} as const;
```

**Actualizar enum:** `recruiter-queues.enum.ts` usa estos constants.

---

### 0.8 Error Handling Base para Nodos
**Archivo nuevo:** `src/modules/recruiter/graph/node-error-handler.ts`

```typescript
import { RecruiterState, StateSteps } from '../state/recruiter.state';

export type NodeResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; step: StateSteps };

export function handleNodeError<T>(
  step: StateSteps,
  fn: () => Promise<T>
): Promise<NodeResult<T>> {
  return fn()
    .then(data => ({ success: true, data }))
    .catch(err => ({ 
      success: false, 
      error: `${step} failed: ${err.message}`, 
      step 
    }));
}

// Helper para crear update de estado con error
export function createErrorState(step: StateSteps, error: string): Partial<RecruiterState> {
  return {
    meta: {
      step: StateSteps.Error,
      errors: [error],
      warnings: [],
      processingTime: 0,
      timestamp: new Date(),
    },
  };
}
```

**Uso en nodos:**
```typescript
return async (state): Promise<Partial<RecruiterState>> => {
  const result = await handleNodeError(StateSteps.Analyzing, () => analyzeJobCall.invoke(...));
  if (!result.success) return createErrorState(StateSteps.Analyzing, result.error);
  return { job: result.data, meta: { step: StateSteps.Analyzing } };
};
```

---

### 0.9 Graph Conditional Edge para Error Handling
**En `createEvaluationGraph` (0.1), agregar después de compilar:**

```typescript
// Agregar conditional edge desde cualquier nodo que pueda fallar
// Opción A: Wrapper en cada node factory (ver 0.8)
// Opción B: Graph-level error boundary (LangGraph v0.2+)
// Por ahora: cada nodo maneja su error y retorna step=Error
// El graph termina en __end__ desde Error step
.addEdge('analyzer', 'matcher')
.addEdge('matcher', 'scorer')
// ... etc
// Nodos que fallan retornan { meta: { step: StateSteps.Error } }
```

---

## FASE 1: Completar Pipeline PDF → S3 → Queue → Worker (Base Async)

### 1.1 S3 Presigned POST Endpoint
**Archivo nuevo:** `src/modules/recruiter/controllers/upload.controller.ts`

```typescript
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { FILE_STORAGE } from '../interfaces/file-storage.interface';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Controller('recruiter')
export class UploadController {
  constructor(@Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage) {}

  @Post('upload/presigned')
  async getPresignedPost(
    @Body('filename') filename: string,
    @Body('contentType') contentType: string,
  ) {
    if (contentType !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }
    const key = `cvs/${randomUUID()}.pdf`;
    const presigned = await this.fileStorage.getPresignedPOST(key, { expirySeconds: 3600 });
    return { url: presigned.url, fields: presigned.fields, key, expiresIn: 3600 };
  }
}
```

**Registrar en Module:** `recruiter.module.ts` controllers array: `UploadController`

**Por qué:** Cliente sube directo a S3 → servidor no recibe buffer pesado → request HTTP rápida.

---

### 1.2 Producer: Encolar Job PDF desde Controller
**Modificar:** `src/modules/recruiter/controllers/recruiter.controller.ts`

```typescript
import { Controller, Post, Body, Inject, BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EvaluationRequest } from '../value-objects/evaluation-request.vo';
import { PDF_JOBS, QUEUE_NAMES } from '../constants/job-names';
import { randomUUID } from 'crypto';
import { IFileStorage } from '../interfaces/file-storage.interface';
import { FILE_STORAGE } from '../interfaces/file-storage.interface';
import { getQueueToken } from '@nestjs/bullmq';

@Controller('recruiter')
export class RecruiterController {
  constructor(
    @Inject(getQueueToken(QUEUE_NAMES.PDF_EXTRACTION)) private readonly pdfQueue: Queue,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
  ) {}

  @Post('evaluate')
  async evaluateCandidate(@Body() dto: EvaluateCandidateDto) {
    // Value Object valida invariantes
    const request = dto.toRequest();
    
    // Verifica que el archivo existe en S3
    const exists = await this.fileStorage.fileExists(request.s3Key.value);
    if (!exists) {
      throw new BadRequestException(`File not found in S3: ${request.s3Key.value}`);
    }
    
    // Genera presigned GET para el worker (expira en 2h)
    const presignedGet = await this.fileStorage.getPresignedGET(request.s3Key.value, { expirySeconds: 7200 });
    
    const jobId = `eval-${randomUUID()}`;
    await this.pdfQueue.add(PDF_JOBS.EXTRACT_PDF, {
      s3Key: request.s3Key.value,
      presignedUrl: presignedGet.url,
      jobDescription: request.jobDescription.value,
      jobTitle: request.jobTitle.value,
    }, { jobId });
    
    return { jobId, status: 'queued', message: 'PDF encolado para procesamiento' };
  }
}
```

**Cambio crítico:** El body ya NO es multipart. Es JSON con `{ s3Key, jobDescription, jobTitle? }`. Validación via Value Objects.

---

### 1.3 PdfConsumer: Descargar de S3 + Transactional Outbox
**Modificar:** `src/modules/recruiter/queues/pdf/pdf.consumer.ts`

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PDF_JOBS, AI_RECRUITER_JOBS, QUEUE_NAMES } from '../../constants/job-names';
import { PdfExtractorTool } from '../../tools/pdf-extractor.tool';
import { Inject, Logger } from '@nestjs/common';
import { EXTRACTED_PDF_REPOSITORY, IExtractedPdfRepository } from '../../interfaces/extracted-pdf.repository.interface';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { IFileStorage, FILE_STORAGE } from '../../interfaces/file-storage.interface';

export type PdfJob = Job<{ 
  s3Key: string; 
  presignedUrl: string; 
  jobDescription: string; 
  jobTitle?: string 
}, { 
  text: string; 
  s3Key: string; 
  jobDescription: string; 
  jobTitle?: string;
  nextJob?: { name: string; data: any }  // Para job chaining
}>;

@Processor(QUEUE_NAMES.PDF_EXTRACTION)
export class PdfConsumer extends WorkerHost {
  private readonly logger = new Logger(PdfConsumer.name);

  constructor(
    private readonly pdfExtractorTool: PdfExtractorTool,
    @Inject(EXTRACTED_PDF_REPOSITORY) private readonly extractedPdfRepository: IExtractedPdfRepository,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
    @Inject(getQueueToken(QUEUE_NAMES.AI_RECRUITER)) private readonly aiRecruiterQueue: Queue,
  ) {
    super();
  }

  async process(job: PdfJob) {
    this.logger.log(`Procesando PDF: ${job.data.s3Key}`);
    
    // Opción A: Descargar via S3 adapter (recomendado, sin expiry)
    const buffer = await this.fileStorage.downloadFile(job.data.s3Key);
    
    const result = await this.pdfExtractorTool.extractText(buffer);
    
    // Retorna resultado + next job para chaining (BullMQ job chaining nativo)
    return {
      text: result.text,
      s3Key: job.data.s3Key,
      jobDescription: job.data.jobDescription,
      jobTitle: job.data.jobTitle,
      nextJob: {
        name: AI_RECRUITER_JOBS.EVALUATE_CANDIDATE,
        data: {
          cvText: result.text,
          jobDescription: job.data.jobDescription,
          jobTitle: job.data.jobTitle,
          sourceS3Key: job.data.s3Key,
        },
      },
    };
  }

  // BullMQ llama automáticamente a nextJob si process() retorna { nextJob }
  // Si falla, job va a failed state con retry policy
}
```

**Cambios clave:**
- Inyecta `FILE_STORAGE` (S3 adapter) en lugar de `fetch`
- Retorna `nextJob` para **BullMQ Job Chaining nativo** (atomicidad queue→queue)
- Elimina `onCompleted` side effect — el chaining es transaccional

---

### 1.4 Declarar AI Recruiter Queue en Module
**Modificar:** `src/modules/recruiter/recruiter.module.ts`

```typescript
import { QUEUE_NAMES } from './constants/job-names';
import { BullModule } from '@nestjs/bullmq';

// En imports array:
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

// Providers para inyección de queues (ya no necesitan string tokens manuales)
```

---

## FASE 2: AI Recruiter Worker + Graph Real (Core Business Logic)

### 2.1 AiRecruiterConsumer (Thin Worker → Use Case)
**Archivo nuevo:** `src/modules/recruiter/queues/ai-recruiter/ai-recruiter.consumer.ts`

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, AI_RECRUITER_JOBS } from '../../constants/job-names';
import { Inject, Logger } from '@nestjs/common';
import { EvaluateCandidateUseCase } from '../../use-cases/evaluate-candidate.use-case';
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
  ) {
    super();
  }

  async process(job: AiRecruiterJob): Promise<RecruiterOutput> {
    this.logger.log(`Evaluando candidato para job ${job.id}`);
    
    const { cvText, jobDescription, jobTitle } = job.data;
    
    return this.evaluateCandidateUseCase.execute({
      cvText,
      jobDescription,
      jobTitle,
    });
  }

  @OnWorkerEvent("completed")
  async onCompleted(job: AiRecruiterJob) {
    this.logger.log(`Evaluación completada para job ${job.id}`);
    // Persistencia se hace en Use Case o via EventEmitter (Fase 3)
  }

  @OnWorkerEvent("failed")
  async onFailed(job: AiRecruiterJob | undefined, err: Error) {
    this.logger.error(`Evaluación fallida: ${err.message}`);
    // BullMQ maneja retries via job options; DLQ configurado en module
  }
}
```

**Arquitectura:** Worker (transport) → Use Case (application) → Graph Port (domain)

---

### 2.2 Registrar Consumer + Use Case en Module
**Modificar:** `src/modules/recruiter/recruiter.module.ts`

```typescript
import { AiRecruiterConsumer } from './queues/ai-recruiter/ai-recruiter.consumer';
import { EvaluateCandidateUseCase } from './use-cases/evaluate-candidate.use-case';
import { ScoringPolicy } from './policies/scoring.policy';

// En providers array:
providers: [
  // ... existing
  ScoringPolicy,
  EvaluateCandidateUseCase,
  AiRecruiterConsumer,
],
```

---

### 2.3 Nodos Reales del Graph (con Arquitectura Correcta)

#### State Updates: `src/modules/recruiter/state/recruiter.state.ts`

```typescript
// ELIMINAR cvBuffer del InputAnnotation
export const RecruiterInputAnnotation = Annotation.Root({
  cvText: Annotation<string>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,
});

// ELIMINAR parserNode del grafo (ya no hace falta)
// ELIMINAR cvBuffer de RecruiterStateAnnotation
// meta.step values: alinear con StateSteps enum ('parsing'|'analyzing'|'matching'|'scoring'|'feedback'|'complete'|'error')

// Agregar reducer para meta.errors (append)
meta: Annotation<{
  step: 'parsing' | 'analyzing' | 'matching' | 'scoring' | 'feedback' | 'complete' | 'error';
  errors: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] }); // append
  warnings: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] });
  processingTime: Annotation<number>;
  timestamp: Annotation<Date>;
}>,
```

#### Graph Factory: `src/modules/recruiter/graph/recruiter.graph.ts`

```typescript
import { StateGraph } from '@langchain/langgraph';
import { Checkpointer } from '@langchain/langgraph/checkpoint';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { RecruiterStateAnnotation, RecruiterInputAnnotation, RecruiterOutputAnnotation } from '../state/recruiter.state';
import { createAnalyzerNode } from '../nodes/analyzer.node';
import { createMatcherNode } from '../nodes/matcher.node';
import { createScorerNode } from '../nodes/scorer.node';
import { createFeedbackNode } from '../nodes/feedback.node';
import { IEvaluationGraph } from '../interfaces/evaluation-graph.interface';

// Factory function para crear graph con dependencias inyectadas
export function createEvaluationGraph(
  llm: BaseChatModel,
  jobMatcher: JobMatcherTool,
  checkpointer?: Checkpointer
): IEvaluationGraph {
  const workflow = new StateGraph(RecruiterStateAnnotation, {
    input: RecruiterInputAnnotation,
    output: RecruiterOutputAnnotation,
  })
    .addNode('analyzer', createAnalyzerNode(llm))
    .addNode('matcher', createMatcherNode(jobMatcher))
    .addNode('scorer', createScorerNode(jobMatcher))
    .addNode('feedback', createFeedbackNode(llm))
    .addEdge('__start__', 'analyzer')
    .addEdge('analyzer', 'matcher')
    .addEdge('matcher', 'scorer')
    .addEdge('scorer', 'feedback')
    .addEdge('feedback', '__end__');

  return workflow.compile({ checkpointer });
}

// Exportar tipos para nodos
export type { RecruiterState } from '../state/recruiter.state';
```

#### 2.3.1 analyzerNode — LLM + Zod (Extrae JobAnalysis de JD)
**Archivo:** `src/modules/recruiter/nodes/analyzer.node.ts`

```typescript
import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const JobAnalysisSchema = z.object({
  required: z.object({
    skills: z.array(z.string()),
    yearsOfExperience: z.number().min(0),
    education: z.string(),
  }),
  preferred: z.object({
    skills: z.array(z.string()),
  }),
});

export function createAnalyzerNode(llm: BaseChatModel) {
  const structuredLlm = llm.withStructuredOutput(JobAnalysisSchema);
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', `Eres un analista de RRHH experto. Extrae requisitos estructurados de la descripción del puesto.
Identifica skills técnicas requeridas, años de experiencia mínima, nivel educativo, y skills preferidas (nice-to-have).
Responde SOLO con el JSON válido según el schema.`],
    ['human', 'Job Title: {jobTitle}\n\nJob Description:\n{jobDescription}'],
  ]);

  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const chain = prompt.pipe(structuredLlm);
    const jobAnalysis = await chain.invoke({
      jobTitle: state.jobTitle,
      jobDescription: state.jobDescription,
    });
    
    return {
      job: jobAnalysis,
      meta: { step: StateSteps.Analyzing, ... },
    };
  };
}
```

#### 2.3.2 matcherNode — JobMatcherTool (Determinístico)
**Archivo:** `src/modules/recruiter/nodes/matcher.node.ts`

```typescript
export function createMatcherNode(jobMatcher: JobMatcherTool) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const candidateSkills = state.candidate?.skills || [];
    const requiredSkills = state.job?.required?.skills || [];
    
    const matchResult = await jobMatcher.matchSkills(candidateSkills, requiredSkills);
    
    return {
      match: {
        score: matchResult.matchPercentage,
        details: {
          skills: { 
            matched: matchResult.matched, 
            missing: matchResult.missing, 
            score: matchResult.matchPercentage 
          },
          experience: { score: 0, reasoning: '' },
          education: { score: 0, reasoning: '' },
        },
        strengths: matchResult.matched.slice(0, 5),
        weaknesses: matchResult.missing.slice(0, 5),
        redFlags: [],
        greenFlags: matchResult.matched.length > 5 ? ['Strong skill alignment'] : [],
      },
      meta: { step: StateSteps.Matching, ... },
    };
  };
}
```

#### 2.3.3 scorerNode — Matemática Pura 50/30/20
**Archivo:** `src/modules/recruiter/nodes/scorer.node.ts`

```typescript
export function createScorerNode(jobMatcher: JobMatcherTool) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const skillsScore = state.match?.details?.skills?.score || 0;
    
    const candidateYears = state.candidate?.yearsOfExperience || 0;
    const requiredYears = state.job?.required?.yearsOfExperience || 0;
    const experienceScore = requiredYears > 0 
      ? Math.min(100, Math.round((candidateYears / requiredYears) * 100))
      : 50;
    const expReasoning = requiredYears > 0 
      ? `Candidato: ${candidateYears} años, Requerido: ${requiredYears} años`
      : 'No se especificó experiencia requerida';

    const reqEdu = (state.job?.required?.education || '').toLowerCase();
    const candEdu = state.candidate?.education?.map(e => e.degree.toLowerCase()).join(' ') || '';
    const eduHierarchy = { phd: 4, master: 3, bachelor: 2, degree: 1 };
    const reqLevel = eduHierarchy[reqEdu as keyof typeof eduHierarchy] || 1;
    const candLevel = Math.max(...(state.candidate?.education?.map(e => 
      eduHierarchy[e.degree.toLowerCase() as keyof typeof eduHierarchy] || 0) || [0]));
    const educationScore = candLevel >= reqLevel ? 100 : Math.round((candLevel / reqLevel) * 100);
    const eduReasoning = `Requerido: ${reqEdu || 'cualquiera'}, Candidato nivel: ${candLevel}`;

    const overall = jobMatcher.calculateOverallScore({
      skills: skillsScore,
      experience: experienceScore,
      education: educationScore,
    });

    let decision: 'ADVANCE' | 'REVIEW' | 'REJECT';
    if (overall >= 85) decision = 'ADVANCE';
    else if (overall >= 70) decision = 'ADVANCE';
    else if (overall >= 50) decision = 'REVIEW';
    else decision = 'REJECT';

    return {
      scores: { overall, skills: skillsScore, experience: experienceScore, education: educationScore },
      recommendation: { 
        decision, 
        confidence: 80,
        reasoning: `Score ${overall}/100 (skills: ${skillsScore}, exp: ${experienceScore}, edu: ${educationScore})` 
      },
      match: {
        ...state.match,
        details: {
          ...state.match?.details,
          experience: { score: experienceScore, reasoning: expReasoning },
          education: { score: educationScore, reasoning: eduReasoning },
        },
      },
      meta: { step: StateSteps.Scoring, ... },
    };
  };
}
```

#### 2.3.4 feedbackNode — LLM + Zod (Genera preguntas + feedback)
**Archivo:** `src/modules/recruiter/nodes/feedback.node.ts`

```typescript
const FeedbackSchema = z.object({
  interviewQuestions: z.array(z.string()).max(8),
  feedbackForCandidate: z.string(),
  nextSteps: z.array(z.string()),
  salarySuggestion: z.string(),
});

export function createFeedbackNode(llm: BaseChatModel) {
  const structuredLlm = llm.withStructuredOutput(FeedbackSchema);
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', `Eres un reclutador senior. Genera feedback personalizado y preguntas de entrevista.
Basándote en el perfil del candidato, análisis del puesto, match y scores.
Sé constructivo, específico y accionable. Responde SOLO JSON válido.`],
    ['human', `Candidate Profile: {candidateProfile}
Job Analysis: {jobAnalysis}
Match Result: {matchResult}
Scores: {scores}
Recommendation: {recommendation}`],
  ]);

  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const chain = prompt.pipe(structuredLlm);
    const feedback = await chain.invoke({
      candidateProfile: JSON.stringify(state.candidate),
      jobAnalysis: JSON.stringify(state.job),
      matchResult: JSON.stringify(state.match),
      scores: JSON.stringify(state.scores),
      recommendation: JSON.stringify(state.recommendation),
    });

    return {
      output: {
        interviewQuestions: feedback.interviewQuestions,
        feedbackForCandidate: feedback.feedbackForCandidate,
        nextSteps: feedback.nextSteps,
        salarySuggestion: feedback.salarySuggestion,
      },
      meta: { step: StateSteps.Complete, ... },
    };
  };
}
```

---

## FASE 3: Persistencia Real + Status Endpoint (Production Ready)

### 3.1 Drizzle Schema + pgvector
**Archivos nuevos:**
- `src/db/schema/evaluations.ts` — tabla `evaluations` con `embedding vector(1536)` para cvText
- `src/db/schema/extracted-pdfs.ts` — tabla `extracted_pdfs` (reemplaza in-memory repo)
- `drizzle.config.ts` — configuración

```sql
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(255) UNIQUE NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  cv_text TEXT NOT NULL,
  job_description TEXT NOT NULL,
  job_title VARCHAR(255),
  cv_embedding VECTOR(1536),
  scores JSONB NOT NULL,
  recommendation JSONB NOT NULL,
  match_details JSONB NOT NULL,
  output JSONB NOT NULL,
  meta JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_evaluations_job_id ON evaluations(job_id);
CREATE INDEX idx_evaluations_cv_embedding ON evaluations USING ivfflat (cv_embedding vector_cosine_ops);
```

### 3.2 Repository Pattern (Drizzle)
**Archivos nuevos:**
- `src/modules/recruiter/repositories/drizzle-evaluation.repository.ts`
- `src/modules/recruiter/interfaces/evaluation.repository.interface.ts`

### 3.3 Persistir en AiRecruiterConsumer.onCompleted
**Modificar:** `ai-recruiter.consumer.ts`

```typescript
@OnWorkerEvent("completed")
async onCompleted(job: AiRecruiterJob) {
  const result = job.returnvalue;
  await this.evaluationRepository.save({
    jobId: job.id,
    s3Key: job.data.sourceS3Key,
    cvText: job.data.cvText,
    jobDescription: job.data.jobDescription,
    jobTitle: job.data.jobTitle,
    cvEmbedding: await this.embeddingService.embed(job.data.cvText),
    scores: result.scores,
    recommendation: result.recommendation,
    matchDetails: result.match,
    output: result.output,
    meta: result.meta,
  });
}
```

### 3.4 Status Endpoint Real (lee de DB)
**Modificar:** `src/modules/recruiter/controllers/recruiter.controller.ts`

```typescript
@Get('status/:jobId')
async getStatus(@Param('jobId') jobId: string) {
  const evaluation = await this.evaluationRepository.findByJobId(jobId);
  if (!evaluation) {
    const pdfJob = await this.pdfQueue.getJob(jobId);
    const aiJob = await this.aiRecruiterQueue.getJob(jobId);
    const state = pdfJob ? await pdfJob.getState() : (aiJob ? await aiJob.getState() : null);
    return { jobId, status: state || 'not_found', message: 'Job no encontrado en BD, revisando colas...' };
  }
  return evaluation;
}
```

---

## FASE 4: Limpieza y Consolidación

### 4.1 Eliminar Código Muerto (Sync Path)
- ❌ `parserNode` y archivos relacionados
- ❌ `cvBuffer` de `RecruiterInputAnnotation` y `RecruiterStateAnnotation`
- ❌ `multer` / `FileInterceptor` / `FilesInterceptor` en controller
- ❌ `evaluateBatch` buggy en service
- ❌ `jobStatuses` Map en service
- ❌ `reEvaluate`, `compareCandidates` (placeholders)
- ❌ Endpoints placeholder: `/interview-questions`, `/feedback`, `/compare`

### 4.2 DTOs Alineados al Flujo Async
```typescript
// evaluate-candidate.dto.ts
export class EvaluateCandidateDto {
  @IsString()
  s3Key: string;

  @IsString()
  jobDescription: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}
```

### 4.3 Tests E2E del Flujo Completo
- Test: Presigned POST → Upload S3 → Enqueue → Worker PDF → Worker AI → DB → Status

---

## Orden de Ejecución (Dependencias Reales)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. S3 Presigned POST Endpoint                                    │
│    └─ Controller + FileStorage adapter                           │
├─────────────────────────────────────────────────────────────────┤
│ 2. Producer en Controller (POST /evaluate con s3Key)            │
│    └─ Requiere: #1 funcionando                                   │
├─────────────────────────────────────────────────────────────────┤
│ 3. PdfConsumer: descargar de S3 + extraer                       │
│    └─ Requiere: #2 encola jobs, inyectar FILE_STORAGE           │
├─────────────────────────────────────────────────────────────────┤
│ 4. Event Hook: onCompleted → encola AI_RECRUITER queue          │
│    └─ Requiere: #3 funciona, declarar AI_RECRUITER queue        │
├─────────────────────────────────────────────────────────────────┤
│ 5. AI_RECRUITER Queue + Consumer (invoca Graph)                 │
│    └─ Requiere: #4 encola jobs, Graph compila                   │
├─────────────────────────────────────────────────────────────────┤
│ 6. Nodos REALES del Graph (analyzer, matcher, scorer, feedback) │
│    └─ Requiere: #5 consumer llama graph.invoke                  │
├─────────────────────────────────────────────────────────────────┤
│ 7. Drizzle + pgvector + Repository                              │
│    └─ Independiente, pero necesario para #8                     │
├─────────────────────────────────────────────────────────────────┤
│ 8. Persistencia en onCompleted + Status endpoint real           │
│    └─ Requiere: #6 + #7                                         │
├─────────────────────────────────────────────────────────────────┤
│ 9. Limpieza: borrar sync path, DTOs, tests E2E                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estimación de Esfuerzo

| Fase | Tareas | Sesiones | Riesgo |
|------|--------|----------|--------|
| **1. Pipeline PDF Async** | 1.1-1.5 | 2-3 | Bajo (código base existe) |
| **2. AI Worker + Graph Real** | 2.1-2.3.4 | 3-4 | Medio (LLM + Zod tuning) |
| **3. Persistencia + Status** | 3.1-3.4 | 2-3 | Medio (Drizzle setup, pgvector) |
| **4. Limpieza + Tests** | 4.1-4.3 | 1-2 | Bajo |
| **TOTAL** | | **8-12 sesiones** | |

---

## Próxima Acción Inmediata

**Iniciar 1.1: S3 Presigned POST Endpoint**

```bash
# Archivos a crear/modificar:
1. src/modules/recruiter/controllers/upload.controller.ts (NUEVO)
2. src/modules/recruiter/recruiter.module.ts (registrar controller)
3. Test manual: curl POST /upload/presigned → obtener {url, fields, key} → subir PDF con curl -X POST -F "file=@cv.pdf" $url
```