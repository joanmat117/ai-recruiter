# Implementation Plan — Async Queue-Based Architecture

> **Basado en:** Código real, `TODO.md`, commits (`b7e90b5 add s3`, `d33bfc7 bullmq partially`, `01a7230 wire LangGraph`)
> **Objetivo:** Completar el pipeline `S3 → PDF Queue → AI Recruiter Queue → LangGraph → Drizzle/pgvector`

---

## Índice de Fases

| Fase | Archivo | Descripción |
|------|---------|-------------|
| **Decisiones Arquitectónicas** | [00-architectural-decisions.md](00-architectural-decisions.md) | 9 decisiones obligatorias (A1-A9) que aplican a todas las fases |
| **Fase 0** | [01-phase-0-setup.md](01-phase-0-setup.md) | Setup arquitectónico: Ports, Use Cases, Policies, Strategies, Value Objects, Error Handling |
| **Fase 1** | [02-phase-1-pdf-pipeline.md](02-phase-1-pdf-pipeline.md) | Pipeline PDF: S3 Presigned POST → Controller Producer → PdfConsumer (S3 + Job Chaining) |
| **Fase 2** | [03-phase-2-ai-worker-graph.md](03-phase-2-ai-worker-graph.md) | AI Worker + Graph Real: Thin Worker → Use Case → Graph Factory → 4 Nodos con Strategies |
| **Fase 3** | [04-phase-3-persistence.md](04-phase-3-persistence.md) | Persistencia Real: Drizzle + pgvector + Repository + Status Endpoint |
| **Fase 4** | [05-phase-4-cleanup.md](05-phase-4-cleanup.md) | Limpieza: Eliminar sync path, DTOs alineados, Tests E2E |
| **Orden de Ejecución** | [06-execution-order.md](06-execution-order.md) | Dependencias reales, estimación de esfuerzo, próxima acción inmediata |

---

## Flujo General

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

---

## Próxima Acción Inmediata

**Iniciar Fase 0.1: Port `IEvaluationGraph` + Provider Binding**

```bash
# Archivos a crear:
1. src/modules/recruiter/interfaces/evaluation-graph.interface.ts
2. src/modules/recruiter/graph/recruiter.graph.ts (agregar factory function)
3. src/modules/recruiter/recruiter.module.ts (registrar provider 'EVALUATION_GRAPH')
```