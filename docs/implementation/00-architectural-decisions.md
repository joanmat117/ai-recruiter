# Decisiones Arquitectónicas Obligatorias (A1-A9)

> **Estas decisiones se aplican ANTES y DURANTE todas las fases. No son opcionales.**

---

## Resumen

| # | Decisión | Patrón/Principio | Qué Cambia |
|---|----------|------------------|------------|
| **A1** | **Graph detrás de Port `IEvaluationGraph`** | Dependency Inversion | Worker no importa `recruiterGraph` directo; inyecta `IEvaluationGraph` |
| **A2** | **Use Case `EvaluateCandidateUseCase`** | Single Responsibility | Worker (transport) → Use Case (application logic) → Graph Port |
| **A3** | **Structured LLM Calls como Strategy** | Strategy | `AnalyzeJobCall`, `GenerateFeedbackCall` inyectables, testeables, intercambiables |
| **A4** | **Transactional Outbox para Queue→Queue** | Transactional Outbox | `PdfConsumer.process()` retorna `NextJob` + data; BullMQ job chaining nativo |
| **A5** | **Value Objects para Inputs** | Value Object / Encapsulation | `EvaluationRequest`, `S3Key`, `JobDescription` validan invariantes en constructor |
| **A6** | **ScoringPolicy inyectable** | Strategy/Policy | Pesos, thresholds, decisión configurables via ConfigService, no hardcodeados |
| **A7** | **Error Handling explícito en Nodos + Graph Edges** | Robustness | Nodos retornan `Result<Partial<State>, Error>`; graph tiene conditional edge `Error` |
| **A8** | **Constants para Job Names / Keys** | Hygiene | `AI_RECRUITER_JOBS.EVALUATE_CANDIDATE` en vez de string literals |
| **A9** | **Immutabilidad estricta en State Updates** | Immutability | Nodos retornan objeto nuevo completo o usan `produce` (Immer); no shallow spread anidado |

---

## Detalle de Cada Decisión

### A1: Port `IEvaluationGraph` (Dependency Inversion)

**Problema:** Worker importa `recruiterGraph` directamente → acoplamiento a implementación concreta, no testeable, no configurable.

**Solución:**
```typescript
// src/modules/recruiter/interfaces/evaluation-graph.interface.ts
export interface IEvaluationGraph {
  invoke(input: RecruiterInput, config?: RunnableConfig): Promise<RecruiterOutput>;
}

// Graph factory la implementa
export function createEvaluationGraph(
  llm: BaseChatModel,
  jobMatcher: JobMatcherTool,
  checkpointer?: Checkpointer
): IEvaluationGraph { ... }

// Module binding
{ provide: 'EVALUATION_GRAPH', useFactory: createEvaluationGraph, inject: [...] }
```

**Beneficio:** Worker inyecta `IEvaluationGraph`; tests pueden mockear; swap de implementación por config.

---

### A2: Use Case `EvaluateCandidateUseCase` (Single Responsibility)

**Problema:** `AiRecruiterConsumer` hace wiring de LLM, invoca graph, maneja logging, persistencia → viola SRP.

**Solución:** Tres capas separadas:
- **Worker (Transport):** `AiRecruiterConsumer` — solo recibe job, llama use case, maneja BullMQ events
- **Use Case (Application):** `EvaluateCandidateUseCase` — orquesta graph.invoke, aplica ScoringPolicy
- **Graph Port (Domain):** `IEvaluationGraph` — ejecuta el grafo compilado

---

### A3: Structured LLM Calls como Strategy

**Problema:** `analyzerNode` y `feedbackNode` hardcodean schema, prompt, invocation logic → duplicación, no intercambiables.

**Solución:** Strategy classes inyectables:
```typescript
// src/modules/recruiter/llm/structured-llm-calls.ts
export class AnalyzeJobDescriptionCall {
  constructor(llm: BaseChatModel) { this.chain = prompt.pipe(llm.withStructuredOutput(JobAnalysisSchema)); }
  async invoke(input: { jobTitle, jobDescription }): Promise<JobAnalysis> { ... }
}

export class GenerateFeedbackCall { ... }

// Nodos usan strategy inyectada
export function createAnalyzerNode(analyzeJobCall: AnalyzeJobDescriptionCall) { ... }
```

**Beneficio:** Open/Closed — para cambiar prompt/schema, nueva clase Strategy, no tocas nodos.

---

### A4: Transactional Outbox / Job Chaining (Queue→Queue)

**Problema:** `PdfConsumer.onCompleted` encola siguiente job como side effect → si falla, pipeline roto sin atomicidad.

**Solución:** BullMQ Job Chaining nativo (retornar `nextJob` desde `process()`):
```typescript
async process(job: PdfJob) {
  const result = await pdfExtractorTool.extractText(buffer);
  return {
    text: result.text,
    s3Key: job.data.s3Key,
    // ... otros datos
    nextJob: {                    // BullMQ lo encola atómicamente
      name: AI_RECRUITER_JOBS.EVALUATE_CANDIDATE,
      data: { cvText: result.text, jobDescription: job.data.jobDescription, ... }
    }
  };
}
```

**Alternativa:** Transactional Outbox table si se necesita más control.

---

### A5: Value Objects para Inputs

**Problema:** DTOs anémicos, validación dispersa en controller/service/pipes.

**Solución:** Value Objects que encapsulan invariantes:
```typescript
export class S3Key {
  private constructor(public readonly value: string) {}
  static from(raw: string): S3Key {
    if (!raw?.startsWith('cvs/') || !raw.endsWith('.pdf')) throw new Error(...);
    return new S3Key(raw);
  }
}

export class EvaluationRequest {
  private constructor(public readonly s3Key: S3Key, public readonly jobDescription: JobDescription, public readonly jobTitle: JobTitle) {}
  static from(dto): EvaluationRequest { ... }
}
```

**Uso:** `dto.toRequest()` en controller → value objects validan al construir.

---

### A6: ScoringPolicy Inyectable (Strategy/Policy)

**Problema:** Pesos (50/30/20), thresholds (85/70/50), decisión hardcodeados en `scorerNode`.

**Solución:** Policy configurable via ConfigService:
```typescript
@Injectable()
export class ScoringPolicy {
  constructor(config: ConfigService) {
    this.weights = { skills: config.get('SCORING_WEIGHT_SKILLS') ?? 0.5, ... };
    this.thresholds = { advance: config.get('SCORING_THRESHOLD_ADVANCE') ?? 85, ... };
  }
  decide(overall): 'ADVANCE' | 'REVIEW' | 'REJECT' { ... }
  calculateOverall(partial): number { ... }
}

// Nodo la usa
export function createScorerNode(jobMatcher: JobMatcherTool, scoringPolicy: ScoringPolicy) { ... }
```

---

### A7: Error Handling Explícito en Nodos

**Problema:** Nodos pueden throw; LangGraph no maneja errors automáticamente; estado inconsistente.

**Solución:** Wrapper `handleNodeError` + `createErrorState`:
```typescript
// src/modules/recruiter/graph/node-error-handler.ts
export type NodeResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; step: StateSteps };

export function handleNodeError<T>(step: StateSteps, fn: () => Promise<T>): Promise<NodeResult<T>> { ... }
export function createErrorState(step: StateSteps, error: string): Partial<RecruiterState> { ... }

// Uso en cada nodo
const result = await handleNodeError(StateSteps.Analyzing, () => analyzeJobCall.invoke(...));
if (!result.success) return createErrorState(StateSteps.Analyzing, result.error);
```

**Graph:** Nodos que fallan retornan `meta.step = StateSteps.Error` → graph termina en `__end__`.

---

### A8: Constants para Job Names / Keys

**Problema:** String literals dispersos: `'evaluate-candidate'`, `'extract-pdf'`, `'cvs/'`.

**Solución:** Constants centralizados:
```typescript
// src/modules/recruiter/constants/job-names.ts
export const PDF_JOBS = { EXTRACT_PDF: 'extract-pdf' } as const;
export const AI_RECRUITER_JOBS = { EVALUATE_CANDIDATE: 'evaluate-candidate' } as const;
export const QUEUE_NAMES = { PDF_EXTRACTION: 'pdf-extraction-queue', AI_RECRUITER: 'ai-recruiter-queue' } as const;
```

---

### A9: Immutabilidad Estricta en State Updates

**Problema:** Spread shallow anidado (`...state.match.details`) muta estado previo → reducers no detectan cambios.

**Solución:** Objeto nuevo completo en cada retorno:
```typescript
// ✅ BIEN: objeto nuevo completo
return {
  match: {
    score: ...,
    details: { skills: {...}, experience: {...}, education: {...} },
    strengths: [...],
    ...
  },
  meta: { step: StateSteps.Matching, errors: [], warnings: [], processingTime: 0, timestamp: new Date() }
};

// ❌ MAL: shallow spread anidado
return {
  match: { ...state.match, details: { ...state.match.details, experience: {...} } }
};
```

**Alternativa:** Usar `produce` de Immer para mutación sintáctica inmutable.