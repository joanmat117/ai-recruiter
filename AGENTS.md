# AI Recruiter — Proyecto (Arquitectura Async Queue-Based)

> **Objetivo:** Construir un sistema de evaluación de candidatos con LangGraph + NestJS, siguiendo una arquitectura async basada en colas (BullMQ).
> **Stack:** NestJS 11 + TypeScript + LangGraph + LangChain (OpenAI/Gemini/OpenRouter) + Drizzle + pgvector + BullMQ + S3.
> **Metodología:** Cada fase se construye sobre la anterior. No saltearse.

📊 **Plan de implementación:** [docs/implementation/](./docs/implementation/) — 5 archivos con fases detalladas y decisiones arquitectónicas.

---

## Tabla de contenidos

1. [Estado actual del proyecto](#estado-actual-del-proyecto)
2. [Arquitectura general](#arquitectura-general)
3. [Decisiones arquitectónicas clave](#decisiones-arquitectónicas-clave)
4. [Fases de implementación](#fases-de-implementación)
5. [Componentes existentes vs. pendientes](#componentes-existentes-vs-pendientes)
6. [Glosario de conceptos LangGraph](#glosario-de-conceptos-langgraph)
7. [Recursos oficiales](#recursos-oficiales)
8. [Consejos finales](#consejos-finales)

---

## Estado actual del proyecto

### Lo que YA existe (código real, commits verificados)

| Componente | Archivo | Estado |
|-----------|---------|--------|
| State (`Annotation.Root`) | `src/modules/recruiter/state/recruiter.state.ts` | ✅ Definido con `Annotation.Root` + Input/Output schemas |
| Grafo (estructura) | `src/modules/recruiter/graph/recruiter.graph.ts` | ✅ Estructura compilable, nodos placeholders |
| LLM Provider Factory | `src/modules/llm/llm-provider.factory.ts` | ✅ Funcional (OpenAI, OpenRouter, Gemini) |
| LlmModule | `src/modules/llm/llm.module.ts` | ✅ Registra factory y providers |
| PdfExtractorTool | `src/modules/recruiter/tools/pdf-extractor.tool.ts` | ✅ Funcional (pdf-parse + limpieza) |
| JobMatcherTool | `src/modules/recruiter/tools/job-matcher.tool.ts` | ✅ Funcional (matching + scoring 50/30/20) |
| PDF Queue (BullMQ) | `src/modules/recruiter/queues/pdf/pdf.consumer.ts` | ✅ Consumer funcional (pero espera URL externa, no S3) |
| S3 Adapter | `src/modules/recruiter/adapters/s3-file-storage.adapter.ts` | ✅ Funcional (Filebase) |
| Extracted PDF Repo (in-memory) | `src/modules/recruiter/repositories/in-memory-extracted-pdf.repository.ts` | ✅ Implementado |
| IP Whitelist Guard | `src/modules/recruiter/common/guards/` | ✅ Implementado |
| Recruiter Module | `src/modules/recruiter/recruiter.module.ts` | ✅ Wiring base |
| Configuración | `src/config/` | ✅ LangGraph, LLM, configuración general |
| DTOs | `src/common/dto/` | ✅ Existentes (pero necesitan alinearse a async) |

### Lo que FALTA (crítico para que funcione)

| Componente | Archivo | Estado | Fase |
|-----------|---------|--------|------|
| S3 Presigned POST Endpoint | `src/modules/recruiter/controllers/upload.controller.ts` | ❌ No existe | 1.1 |
| Producer en Controller (encolar PDF job) | `recruiter.controller.ts` | ❌ Recibe multipart, no s3Key | 1.2 |
| PdfConsumer descarga de S3 | `pdf.consumer.ts` | ❅ Espera URL externa | 1.3 |
| Job Chaining (PDF → AI Recruiter Queue) | `pdf.consumer.ts` | ❌ No existe | 1.4 |
| AI Recruiter Queue | `recruiter.module.ts` | ❌ No declarada | 1.4 |
| IEvaluationGraph Port | `interfaces/evaluation-graph.interface.ts` | ❌ No existe | 0.1 |
| Evaluation Graph Factory | `graph/recruiter.graph.ts` | ❌ Solo compile(), no factory | 0.1 |
| EvaluateCandidateUseCase | `use-cases/evaluate-candidate.use-case.ts` | ❌ No existe | 0.2 |
| ScoringPolicy | `policies/scoring.policy.ts` | ❌ No existe | 0.3 |
| Structured LLM Call Strategies | `llm/structured-llm-calls.ts` | ❌ No existe | 0.4 |
| Value Objects (S3Key, JobDescription, etc.) | `value-objects/evaluation-request.vo.ts` | ❌ No existe | 0.6 |
| Constants (job names, queue names) | `constants/job-names.ts` | ❌ No existe | 0.7 |
| Error Handler para nodos | `graph/node-error-handler.ts` | ❌ No existe | 0.8 |
| AiRecruiterConsumer | `queues/ai-recruiter/ai-recruiter.consumer.ts` | ❌ No existe | 2.1 |
| Nodos reales del grafo | `nodes/analyzer.node.ts`, etc. | ❌ Placeholders | 2.3-2.4 |
| Drizzle Schema + pgvector | `db/schema/` | ❌ No existe | 3.1 |
| Evaluation Repository (Drizzle) | `repositories/drizzle-evaluation.repository.ts` | ❌ No existe | 3.2 |
| Persistencia en Consumer | `ai-recruiter.consumer.ts` | ❌ No existe | 3.3 |
| Status Endpoint real (DB) | `recruiter.controller.ts` | ❌ Usa Map en memoria | 3.4 |

**Problema central:** El grafo existe pero nunca se invoca. Los nodos son placeholders con `console.log`. Las queues existen pero no se conectan entre sí. No hay persistencia en BD.

---

## Arquitectura general

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Cliente    │────►│  S3 Presigned│────►│  PDF Queue       │────►│  PDF Consumer      │────►│  AI Recruiter    │
│  (Browser)  │     │  POST Endpoint│     │  (BullMQ)        │     │  (Worker)          │     │  Queue + Worker  │
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

**Flujo:**
1. Cliente sube PDF directo a S3 (presigned POST) → obtiene `s3Key`
2. Cliente llama `POST /recruiter/evaluate` con `{ s3Key, jobDescription, jobTitle? }`
3. Controller valida con Value Objects, genera presigned GET, encola job en `pdf-extraction-queue`
4. `PdfConsumer` descarga de S3, extrae texto con `PdfExtractorTool`, retorna `nextJob` (job chaining)
5. `AiRecruiterConsumer` recibe el job, invoca `EvaluateCandidateUseCase` → `IEvaluationGraph` → LangGraph
6. Resultado persistido en Drizzle + pgvector
7. Cliente consulta `GET /recruiter/status/:jobId` para obtener resultado

**Arquitectura en capas:**
- **Transport:** Controllers, BullMQ Workers (thin, solo wiring)
- **Application:** Use Cases, Policies
- **Domain/Graph:** Ports, Nodes (pure functions), Tools, Strategies
- **Infrastructure:** LLM Providers, S3 Adapter, Drizzle Repositories

---

## Decisiones arquitectónicas clave (A1-A9)

> Estas decisiones son **obligatorias** y aplican a todas las fases. Ver detalle en [docs/implementation/00-architectural-decisions.md](./docs/implementation/00-architectural-decisions.md).

| # | Decisión | Patrón | Qué cambia |
|---|----------|--------|------------|
| **A1** | Graph detrás de Port `IEvaluationGraph` | Dependency Inversion | Worker inyecta port, no importa grafo directo |
| **A2** | Use Case `EvaluateCandidateUseCase` | Single Responsibility | Worker → Use Case → Graph Port |
| **A3** | Structured LLM Calls como Strategy | Strategy | `AnalyzeJobCall`, `GenerateFeedbackCall` inyectables |
| **A4** | Transactional Outbox / Job Chaining | Transactional Outbox | `nextJob` en `process()` para atomicidad queue→queue |
| **A5** | Value Objects para Inputs | Value Object | `S3Key`, `JobDescription`, `EvaluationRequest` validan invariantes |
| **A6** | ScoringPolicy inyectable | Strategy/Policy | Pesos y thresholds configurables via ConfigService |
| **A7** | Error Handling explícito en nodos | Robustness | `handleNodeError` + `createErrorState` |
| **A8** | Constants para Job Names / Keys | Hygiene | `AI_RECRUITER_JOBS.EVALUATE_CANDIDATE` no strings mágicos |
| **A9** | Immutabilidad estricta en State Updates | Immutability | Objetos nuevos completos, no shallow spread anidado |

---

## Fases de implementación

El plan está dividido en 5 archivos en `docs/implementation/`:

| Fase | Archivo | Descripción | Sesiones |
|------|---------|-------------|----------|
| **Decisiones** | `00-architectural-decisions.md` | A1-A9 obligatorias | — |
| **Fase 0** | `01-phase-0-setup.md` | Setup arquitectónico (ports, use cases, policies, strategies, VOs) | 2-3 |
| **Fase 1** | `02-phase-1-pdf-pipeline.md` | Pipeline PDF async (S3 → Queue → Worker) | 2-3 |
| **Fase 2** | `03-phase-2-ai-worker-graph.md` | AI Worker + Graph Real (nodos, strategies, policies) | 3-4 |
| **Fase 3** | `04-phase-3-persistence.md` | Drizzle + pgvector + Repository + Status Endpoint | 2-3 |
| **Fase 4** | `05-phase-4-cleanup.md` | Limpieza sync path + Tests E2E | 1-2 |
| **Orden** | `06-execution-order.md` | Dependencias, estimación, próxima acción | — |

**Total estimado:** 10-15 sesiones.

### Próxima acción inmediata

**Fase 0.1:** Crear `IEvaluationGraph` port + factory function + module binding.

```bash
# Archivos a crear/modificar:
1. src/modules/recruiter/interfaces/evaluation-graph.interface.ts (NUEVO)
2. src/modules/recruiter/graph/recruiter.graph.ts (agregar createEvaluationGraph factory)
3. src/modules/recruiter/recruiter.module.ts (registrar provider 'EVALUATION_GRAPH')
4. npm run build (verificar compilación)
```

---

## Componentes del grafo LangGraph (una vez implementados)

| Nodo | Responsabilidad | Tipo | Dependencias |
|------|----------------|------|--------------|
| **analyzer** | Extraer requisitos de JD con LLM + Zod | Strategy | `AnalyzeJobDescriptionCall` |
| **matcher** | Comparar skills candidato vs. requeridas | Determinístico | `JobMatcherTool` |
| **scorer** | Calcular score 50/30/20 + decisión | Policy | `ScoringPolicy` |
| **feedback** | Generar preguntas + feedback con LLM | Strategy | `GenerateFeedbackCall` |

**Flujo del grafo:** `START → analyzer → matcher → scorer → feedback → END`

**State:** `cvText`, `jobDescription`, `jobTitle`, `candidate`, `job`, `match`, `recommendation`, `output`, `meta` (con reducer `append` para `errors`/`warnings`).

---

## Glosario de conceptos LangGraph

| Concepto | Qué es |
|----------|--------|
| **State** | Datos compartidos que fluyen entre nodos (`Annotation.Root`) |
| **Annotation** | Definición del schema del state |
| **Reducer** | Cómo se mergean updates en una key del state (append vs overwrite) |
| **Node** | Función pura que recibe state y retorna `Partial<State>` |
| **Edge** | Conexión determinística entre nodos |
| **START / END** | Nodos virtuales de entrada/salida |
| **Compile** | Validar y preparar el grafo (con `checkpointer`) |
| **Invoke** | Ejecutar el grafo síncronamente |
| **Checkpointer** | Persiste state entre nodos (`MemorySaver` en dev, `SqliteSaver` en prod) |
| **Thread ID** | Identificador de una ejecución (jobId de BullMQ) |

---

## Recursos oficiales de LangGraph

| Recurso | URL |
|---------|-----|
| Overview | https://docs.langchain.com/oss/python/langgraph/overview |
| Quickstart | https://docs.langchain.com/oss/python/langgraph/quickstart |
| Graph API overview | https://docs.langchain.com/oss/python/langgraph/graph-api |
| Use the Graph API | https://docs.langchain.com/oss/python/langgraph/use-graph-api |
| Persistence | https://docs.langchain.com/oss/python/langgraph/persistence |
| Checkpointers | https://docs.langchain.com/oss/python/langgraph/checkpointers |
| Streaming | https://docs.langchain.com/oss/python/langgraph/streaming |
| Interrupts | https://docs.langchain.com/oss/python/langgraph/interrupts |
| LangGraph JS/TS SDK | https://docs.langchain.com/langsmith/langgraph-js-ts-sdk |

---

## Consejos finales

1. **Sigue el orden de fases.** Fase 0 es pre-requisito para todo lo demás.
2. **Probá con script standalone antes de NestJS.** `test-graph.ts` para validar el grafo sin ruido de HTTP.
3. **Immutabilidad en nodos.** Retorna objetos nuevos completos, no shallow spread anidado (A9).
4. **Value Objects para validación.** No valides invariantes en controller; hazlo en el constructor del VO (A5).
5. **No hay agent loop.** El flujo es secuencial fijo (workflow, no agent). No usar `bind_tools` ni `ToolNode` a menos que sea estrictamente necesario.
6. **Job Chaining nativo de BullMQ.** `process()` retorna `nextJob` para atomicidad queue→queue (A4).
7. **El state es sagrado.** Si algo no funciona, revisa reducers y updates antes de culpar al LLM.
8. **Nunca uses `cvBuffer` en el input del grafo.** El graph recibe `cvText` ya extraído por `PdfConsumer`.
