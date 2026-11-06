# Fase 2: AI Recruiter Worker + Graph Real (Core Business Logic)

> **Requisito:** Fase 0 y 1 completadas. Queue `AI_RECRUITER` recibe jobs con `cvText` ya extraído.

---

## 2.1 AiRecruiterConsumer (Thin Worker → Use Case)

### Archivo Nuevo
**`src/modules/recruiter/queues/ai-recruiter/ai-recruiter.consumer.ts`**

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
    // NO side effects críticos aquí
  }

  @OnWorkerEvent("failed")
  async onFailed(job: AiRecruiterJob | undefined, err: Error) {
    this.logger.error(`Evaluación fallida: ${err.message}`);
    // BullMQ maneja retries via job options; DLQ configurado en module
  }
}
```

**Arquitectura (A1, A2):** Worker (transport) → Use Case (application) → Graph Port (domain)

---

## 2.2 Registrar Consumer + Use Case en Module

### Modificar
**`src/modules/recruiter/recruiter.module.ts`**

```typescript
import { AiRecruiterConsumer } from './queues/ai-recruiter/ai-recruiter.consumer';
import { EvaluateCandidateUseCase } from './use-cases/evaluate-candidate.use-case';
import { ScoringPolicy } from './policies/scoring.policy';

// En providers array:
providers: [
  // ... existing
  ScoringPolicy,              // 0.3
  EvaluateCandidateUseCase,   // 0.2
  AiRecruiterConsumer,
],
```

---

## 2.3 Nodos Reales del Graph (con Arquitectura Correcta)

### 2.3.1 State Updates
**`src/modules/recruiter/state/recruiter.state.ts`**

```typescript
// ELIMINAR cvBuffer del InputAnnotation
export const RecruiterInputAnnotation = Annotation.Root({
  cvText: Annotation<string>,
  jobDescription: Annotation<string>,
  jobTitle: Annotation<string>,
});

// ELIMINAR parserNode del grafo (ya no hace falta)
// ELIMINAR cvBuffer de RecruiterStateAnnotation

// meta.step alineado con StateSteps enum + reducer para errors (A7, A9)
meta: Annotation<{
  step: 'parsing' | 'analyzing' | 'matching' | 'scoring' | 'feedback' | 'complete' | 'error';
  errors: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] }); // append
  warnings: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] });
  processingTime: Annotation<number>;
  timestamp: Annotation<Date>;
}>,
```

### 2.3.2 Graph Factory
**`src/modules/recruiter/graph/recruiter.graph.ts`**

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
  analyzeJobCall: AnalyzeJobDescriptionCall,      // A3
  generateFeedbackCall: GenerateFeedbackCall,     // A3
  scoringPolicy: ScoringPolicy,                   // A6
  checkpointer?: Checkpointer
): IEvaluationGraph {
  const workflow = new StateGraph(RecruiterStateAnnotation, {
    input: RecruiterInputAnnotation,
    output: RecruiterOutputAnnotation,
  })
    .addNode('analyzer', createAnalyzerNode(analyzeJobCall))
    .addNode('matcher', createMatcherNode(jobMatcher))
    .addNode('scorer', createScorerNode(jobMatcher, scoringPolicy))
    .addNode('feedback', createFeedbackNode(generateFeedbackCall))
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

---

## 2.4 Nodos con Strategies, Policies, Error Handling, Inmutabilidad

### 2.4.1 analyzerNode — Strategy `AnalyzeJobDescriptionCall` (A3, A7, A9)
**`src/modules/recruiter/nodes/analyzer.node.ts`**

```typescript
import { RecruiterState, StateSteps } from '../state/recruiter.state';
import { JobAnalysis, AnalyzeJobDescriptionCall } from '../llm/structured-llm-calls';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createAnalyzerNode(analyzeJobCall: AnalyzeJobDescriptionCall) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const result = await handleNodeError(StateSteps.Analyzing, () => 
      analyzeJobCall.invoke({
        jobTitle: state.jobTitle,
        jobDescription: state.jobDescription,
      })
    );
    
    if (!result.success) {
      return createErrorState(StateSteps.Analyzing, result.error);
    }
    
    const jobAnalysis: JobAnalysis = result.data;
    
    // Inmutabilidad: objeto nuevo completo (A9)
    return {
      job: jobAnalysis,
      meta: { 
        step: StateSteps.Analyzing,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}
```

---

### 2.4.2 matcherNode — JobMatcherTool Determinístico (A7, A9)
**`src/modules/recruiter/nodes/matcher.node.ts`**

```typescript
import { RecruiterState, StateSteps } from '../state/recruiter.state';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createMatcherNode(jobMatcher: JobMatcherTool) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const candidateSkills = state.candidate?.skills || [];
    const requiredSkills = state.job?.required?.skills || [];
    
    const result = await handleNodeError(StateSteps.Matching, () => 
      jobMatcher.matchSkills(candidateSkills, requiredSkills)
    );
    
    if (!result.success) {
      return createErrorState(StateSteps.Matching, result.error);
    }
    
    const matchResult = result.data;
    
    // Objeto nuevo completo (A9)
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
      meta: { 
        step: StateSteps.Matching,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}
```

---

### 2.4.3 scorerNode — Usa ScoringPolicy Inyectable (A6, A7, A9)
**`src/modules/recruiter/nodes/scorer.node.ts`**

```typescript
import { RecruiterState, StateSteps } from '../state/recruiter.state';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { ScoringPolicy } from '../policies/scoring.policy';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createScorerNode(jobMatcher: JobMatcherTool, scoringPolicy: ScoringPolicy) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const result = await handleNodeError(StateSteps.Scoring, async () => {
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

      // Usar Policy inyectable para overall (A6)
      const overall = scoringPolicy.calculateOverall({
        skills: skillsScore,
        experience: experienceScore,
        education: educationScore,
      });

      const decision = scoringPolicy.decide(overall);

      return {
        overall,
        skillsScore,
        experienceScore,
        educationScore,
        expReasoning,
        eduReasoning,
        decision,
      };
    });
    
    if (!result.success) {
      return createErrorState(StateSteps.Scoring, result.error);
    }
    
    const { overall, skillsScore, experienceScore, educationScore, expReasoning, eduReasoning, decision } = result.data;
    
    // Objeto nuevo completo (A9)
    return {
      scores: { overall, skills: skillsScore, experience: experienceScore, education: educationScore },
      recommendation: { 
        decision, 
        confidence: 80, // TODO: calcular basado en completitud
        reasoning: `Score ${overall}/100 (skills: ${skillsScore}, exp: ${experienceScore}, edu: ${educationScore})` 
      },
      match: {
        // Spread shallow OK porque reemplazamos details completo
        ...state.match,
        details: {
          skills: state.match?.details?.skills || { matched: [], missing: [], score: 0 },
          experience: { score: experienceScore, reasoning: expReasoning },
          education: { score: educationScore, reasoning: eduReasoning },
        },
      },
      meta: { 
        step: StateSteps.Scoring,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}
```

---

### 2.4.4 feedbackNode — Strategy `GenerateFeedbackCall` (A3, A7, A9)
**`src/modules/recruiter/nodes/feedback.node.ts`**

```typescript
import { RecruiterState, StateSteps } from '../state/recruiter.state';
import { FeedbackOutput, GenerateFeedbackCall, FeedbackInput } from '../llm/structured-llm-calls';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createFeedbackNode(generateFeedbackCall: GenerateFeedbackCall) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const input: FeedbackInput = {
      candidateProfile: JSON.stringify(state.candidate),
      jobAnalysis: JSON.stringify(state.job),
      matchResult: JSON.stringify(state.match),
      scores: JSON.stringify(state.scores),
      recommendation: JSON.stringify(state.recommendation),
    };
    
    const result = await handleNodeError(StateSteps.Feedback, () => 
      generateFeedbackCall.invoke(input)
    );
    
    if (!result.success) {
      return createErrorState(StateSteps.Feedback, result.error);
    }
    
    const feedback: FeedbackOutput = result.data;
    
    return {
      output: {
        interviewQuestions: feedback.interviewQuestions,
        feedbackForCandidate: feedback.feedbackForCandidate,
        nextSteps: feedback.nextSteps,
        salarySuggestion: feedback.salarySuggestion,
      },
      meta: { 
        step: StateSteps.Complete,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}
```

---

## Checklist Fase 2

- [ ] 2.1 `AiRecruiterConsumer` thin worker que inyecta `EvaluateCandidateUseCase`
- [ ] 2.1 ELIMINADO: LLM creation, graph import directo, persist en worker
- [ ] 2.2 `EvaluateCandidateUseCase`, `ScoringPolicy`, `AiRecruiterConsumer` registrados en module
- [ ] 2.3.1 State: `cvBuffer` removido, `meta.errors` reducer append, `meta.step` alineado con enum
- [ ] 2.3.2 `createEvaluationGraph` factory con deps inyectadas (llm, jobMatcher, strategies, policy, checkpointer)
- [ ] 2.4.1 `analyzerNode` usa `AnalyzeJobDescriptionCall` strategy + `handleNodeError` + inmutabilidad
- [ ] 2.4.2 `matcherNode` usa `JobMatcherTool` + `handleNodeError` + inmutabilidad
- [ ] 2.4.3 `scorerNode` usa `ScoringPolicy` inyectable + `handleNodeError` + inmutabilidad
- [ ] 2.4.4 `feedbackNode` usa `GenerateFeedbackCall` strategy + `handleNodeError` + inmutabilidad
- [ ] Module binding actualizado para pasar strategies, policy, checkpointer a graph factory

---

## Test Standalone (Opcional - para validar graph)

```typescript
// test-graph.ts en raíz
import { createEvaluationGraph } from './src/modules/recruiter/graph/recruiter.graph';
import { MemorySaver } from '@langchain/langgraph';

const graph = createEvaluationGraph(llm, jobMatcher, analyzeJobCall, generateFeedbackCall, scoringPolicy, new MemorySaver());

const result = await graph.invoke({
  cvText: "Candidate with React, Node.js, AWS experience...",
  jobDescription: "Senior Fullstack Developer with 5+ years React, Node, AWS...",
  jobTitle: "Senior Developer",
});

console.log(result.recommendation.decision); // ADVANCE | REVIEW | REJECT
console.log(result.scores.overall);
console.log(result.match.details.skills.matched);
console.log(result.output.interviewQuestions);
```