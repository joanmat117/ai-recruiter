# Orden de Ejecución y Estimación

> **Resumen:** Todas las fases en orden de dependencia real. Cada fase debe completarse antes de iniciar la siguiente.

---

## Gráfico de Dependencias

```
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 0: Setup Arquitectónico                                        │
│ 0.1 Port IEvaluationGraph + Factory + Module Binding                │
│ 0.2 Use Case EvaluateCandidateUseCase                               │
│ 0.3 ScoringPolicy                                                   │
│ 0.4 Structured LLM Call Strategies                                  │
│ 0.5 LLM Provider Token                                              │
│ 0.6 Value Objects                                                   │
│ 0.7 Constants                                                       │
│ 0.8 Error Handling Base                                             │
│ 0.9 State Updates                                                   │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 1: Pipeline PDF Async                                          │
│ 1.1 S3 Presigned POST Endpoint                                      │
│ 1.2 Producer en Controller                                          │
│ 1.3 PdfConsumer (S3 + Job Chaining)                                 │
│ 1.4 AI Recruiter Queue en Module                                    │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 2: AI Worker + Graph Real                                      │
│ 2.1 AiRecruiterConsumer (Thin Worker)                               │
│ 2.2 Module Registration                                             │
│ 2.3 State Updates                                                   │
│ 2.3.2 Graph Factory                                                 │
│ 2.4 Nodos Reales (analyzer, matcher, scorer, feedback)              │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 3: Persistencia + Status                                       │
│ 3.1 Drizzle Schema + pgvector                                       │
│ 3.2 Repository Pattern                                              │
│ 3.3 Persistir en Consumer                                           │
│ 3.4 Status Endpoint Real                                            │
│ 3.5 Extracted PDFs Repository (opcional)                            │
│ 3.6 Embedding Service (placeholder)                                 │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 4: Limpieza + Tests E2E                                        │
│ 4.1 Eliminar Código Muerto                                          │
│ 4.2 DTOs Alineados                                                  │
│ 4.3 Tests E2E                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Estimación de Esfuerzo por Fase

| Fase | Sesiones | Riesgo | Dependencias |
|------|----------|--------|--------------|
| **Fase 0** | 2-3 | Bajo | Ninguna (pre-requisito) |
| **Fase 1** | 2-3 | Bajo | Fase 0 completa |
| **Fase 2** | 3-4 | Medio | Fase 1 completa |
| **Fase 3** | 2-3 | Medio | Fase 2 completa |
| **Fase 4** | 1-2 | Bajo | Fase 3 completa |
| **TOTAL** | **10-15 sesiones** | | |

---

## Próxima Acción Inmediata

**Iniciar Fase 0.1: Port `IEvaluationGraph` + Factory + Module Binding**

```bash
# 1. Crear directorio de docs/implementation (ya existe)
mkdir -p /workspaces/ai-recruiter/docs/implementation

# 2. Crear archivos Fase 0.1:
#    - src/modules/recruiter/interfaces/evaluation-graph.interface.ts
#    - Modificar: src/modules/recruiter/graph/recruiter.graph.ts (agregar factory)
#    - Modificar: src/modules/recruiter/recruiter.module.ts (registrar provider)

# 3. Verificar compilación:
npm run build
```

---

## Criterios de "Definition of Done" Global

- [ ] Grafo compila y ejecuta end-to-end con cvText real + JD real
- [ ] Scores y recomendación son coherentes y explicables (ScoringPolicy)
- [ ] LLM usado en analyzer + feedback con structured output válido (Zod)
- [ ] Checkpointing funciona: MemorySaver configurado en Fase 0
- [ ] Pipeline async: S3 → PDF Queue → AI Recruiter Queue → Graph → DB
- [ ] Status endpoint lee de BD real (Drizzle)
- [ ] Service < 150 líneas, sin lógica de negocio (Use Case la tiene)
- [ ] Tests E2E pasan (happy path + 3 edge cases)
- [ ] Código muerto del sync path eliminado
- [ ] Documentación de API actualizada

---

## Arquitectura en Capas (Resumen Final)

```
┌─────────────────────────────────────────────────────────────┐
│  TRANSPORT LAYER                                            │
│  ├── Controllers (UploadController, RecruiterController)    │
│  ├── Workers (PdfConsumer, AiRecruiterConsumer)             │
│  └── Queues (BullMQ: pdf-extraction, ai-recruiter)          │
├─────────────────────────────────────────────────────────────┤
│  APPLICATION LAYER                                          │
│  ├── Use Case (EvaluateCandidateUseCase)                    │
│  └── Policy (ScoringPolicy)                                 │
├─────────────────────────────────────────────────────────────┤
│  DOMAIN / GRAPH LAYER                                       │
│  ├── Port (IEvaluationGraph)                                │
│  ├── Nodes (analyzer, matcher, scorer, feedback)            │
│  ├── Strategies (AnalyzeJobCall, GenerateFeedbackCall)      │
│  └── Tools (PdfExtractorTool, JobMatcherTool)               │
├─────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER                                       │
│  ├── LLM Providers (OpenAI, Gemini, OpenRouter)             │
│  ├── S3 Adapter (FileStorage)                               │
│  ├── Drizzle + pgvector                                     │
│  └── Repositories (DrizzleEvaluationRepository)             │
└─────────────────────────────────────────────────────────────┘
```