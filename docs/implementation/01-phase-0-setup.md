# Fase 0: Setup Arquitectónico (Pre-requisito para Todo)

> **Ejecutar ANTES de Fase 1.** Establece la arquitectura correcta para evitar rework en Fases 1-4.

---

## 0.1 Port `IEvaluationGraph` + Factory + Module Binding

### Archivos
- **Nuevo:** `src/modules/recruiter/interfaces/evaluation-graph.interface.ts`
- **Modificar:** `src/modules/recruiter/graph/recruiter.graph.ts` (agregar factory function)
- **Modificar:** `src/modules/recruiter/recruiter.module.ts` (registrar provider)

### Interface
```typescript
// src/modules/recruiter/interfaces/evaluation-graph.interface.ts
import { RecruiterInput, RecruiterOutput } from '../state/recruiter.state';
import { RunnableConfig } from '@langchain/core/runnables';

export interface IEvaluationGraph {
  invoke(input: RecruiterInput, config?: RunnableConfig): Promise<RecruiterOutput>;
  // Opcional para streaming futuro:
  // stream(input: RecruiterInput, config?: RunnableConfig): AsyncGenerator<Partial<RecruiterOutput>>;
}
```

### Graph Factory
```typescript
// src/modules/recruiter/graph/recruiter.graph.ts - AL FINAL DEL ARCHIVO AGREGAR:
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

export function createEvaluationGraph(
  llm: BaseChatModel,
  jobMatcher: JobMatcherTool,
  checkpointer?: Checkpointer
): IEvaluationGraph {
  const workflow = new StateGraph(RecruiterStateAnnotation, {
    input: RecruiterInputAnnotation,
    output: RecruiterOutputAnnotation,
  })
    .addNode('analyzer', createAnalyzerNode(/* analyzeJobCall inyectado */))
    .addNode('matcher', createMatcherNode(jobMatcher))
    .addNode('scorer', createScorerNode(jobMatcher, /* scoringPolicy inyectado */))
    .addNode('feedback', createFeedbackNode(/* generateFeedbackCall inyectado */))
    .addEdge('__start__', 'analyzer')
    .addEdge('analyzer', 'matcher')
    .addEdge('matcher', 'scorer')
    .addEdge('scorer', 'feedback')
    .addEdge('feedback', '__end__');

  return workflow.compile({ checkpointer });
}
```

### Module Binding
```typescript
// src/modules/recruiter/recruiter.module.ts - EN providers array:
import { IEvaluationGraph } from './interfaces/evaluation-graph.interface';
import { createEvaluationGraph } from './graph/recruiter.graph';
import { JobMatcherTool } from './tools/job-matcher.tool';
import { LlmProviderFactory } from '../../modules/llm/llm-provider.factory';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MemorySaver } from '@langchain/langgraph';

{
  provide: 'EVALUATION_GRAPH',
  useFactory: (
    llmFactory: LlmProviderFactory,
    configService: ConfigService,
    jobMatcher: JobMatcherTool,
    analyzeJobCall: AnalyzeJobDescriptionCall,      // A3
    generateFeedbackCall: GenerateFeedbackCall,      // A3
    scoringPolicy: ScoringPolicy,                    // A6
  ) => {
    const llm = llmFactory.createProvider(configService.get('LLM_PROVIDER') || 'openai');
    const checkpointer = new MemorySaver(); // Fase 3: SqliteSaver/PostgresSaver
    return createEvaluationGraph(llm, jobMatcher, checkpointer);
  },
  inject: [
    LlmProviderFactory, 
    ConfigService, 
    JobMatcherTool,
    'ANALYZE_JOB_CALL',        // A3
    'GENERATE_FEEDBACK_CALL',  // A3
    ScoringPolicy,             // A6
  ],
},
```

---

## 0.2 Use Case `EvaluateCandidateUseCase`

### Archivo Nuevo
**`src/modules/recruiter/use-cases/evaluate-candidate.use-case.ts`**

```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
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

## 0.3 ScoringPolicy (Strategy Inyectable)

### Archivo Nuevo
**`src/modules/recruiter/policies/scoring.policy.ts`**

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

**Registrar en Module:** `recruiter.module.ts` providers: `ScoringPolicy`

---

## 0.4 Structured LLM Call Strategies (Analyzer + Feedback)

### Archivo Nuevo
**`src/modules/recruiter/llm/structured-llm-calls.ts`**

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

### Module Binding
```typescript
// src/modules/recruiter/recruiter.module.ts - EN providers:
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
```

---

## 0.5 LLM Provider como Token Inyectable

### Modificar
**`src/modules/llm/llm.module.ts`**

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

## 0.6 Value Objects para Inputs

### Archivo Nuevo
**`src/modules/recruiter/value-objects/evaluation-request.vo.ts`**

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

### DTO Actualizado
**`src/common/dto/evaluate-candidate.dto.ts`**

```typescript
import { IsString, IsOptional, Validate } from 'class-validator';
import { EvaluationRequest } from '../../modules/recruiter/value-objects/evaluation-request.vo';

export class EvaluateCandidateDto {
  @IsString()
  @Validate(S3KeyValidator)      // custom validator que usa S3Key.from
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

## 0.7 Constants para Job Names

### Archivo Nuevo
**`src/modules/recruiter/constants/job-names.ts`**

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

## 0.8 Error Handling Base para Nodos

### Archivo Nuevo
**`src/modules/recruiter/graph/node-error-handler.ts`**

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

### Uso en Nodos
```typescript
return async (state): Promise<Partial<RecruiterState>> => {
  const result = await handleNodeError(StateSteps.Analyzing, () => analyzeJobCall.invoke(...));
  if (!result.success) return createErrorState(StateSteps.Analyzing, result.error);
  return { job: result.data, meta: { step: StateSteps.Analyzing } };
};
```

---

## 0.9 State Updates para Error Handling

### Modificar
**`src/modules/recruiter/state/recruiter.state.ts`**

```typescript
// ELIMINAR cvBuffer del InputAnnotation
export const RecruiterInputAnnotation = Annotation.Root({
  cvText: Annotation<string>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,
});

// meta.step alineado con StateSteps enum + reducer para errors
meta: Annotation<{
  step: 'parsing' | 'analyzing' | 'matching' | 'scoring' | 'feedback' | 'complete' | 'error';
  errors: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] }); // append
  warnings: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] });
  processingTime: Annotation<number>;
  timestamp: Annotation<Date>;
}>,
```

---

## Checklist Fase 0

- [ ] 0.1 `IEvaluationGraph` interface + factory + module binding
- [ ] 0.2 `EvaluateCandidateUseCase` creado y registrado
- [ ] 0.3 `ScoringPolicy` creado y registrado
- [ ] 0.4 `AnalyzeJobDescriptionCall` + `GenerateFeedbackCall` + module binding
- [ ] 0.5 `LLM_PROVIDER` token en `LlmModule`
- [ ] 0.6 Value Objects (`S3Key`, `JobDescription`, `JobTitle`, `EvaluationRequest`)
- [ ] 0.7 Constants (`PDF_JOBS`, `AI_RECRUITER_JOBS`, `QUEUE_NAMES`)
- [ ] 0.8 `handleNodeError` + `createErrorState` helpers
- [ ] 0.9 State updates: `cvBuffer` removido, `meta.errors` reducer, `meta.step` alineado

**Solo después de completar TODO lo anterior → Fase 1**