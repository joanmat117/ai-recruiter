# AI Recruiter — Async Queue-Based Candidate Evaluation System

> **Arquitectura:** NestJS 11 + LangGraph + BullMQ + Drizzle ORM + pgvector + S3 (Filebase)
> **Patrón:** Pipeline asíncrono `S3 → PDF Queue → AI Recruiter Queue → LangGraph → PostgreSQL`

---

## 🎯 ¿Qué es este proyecto?

**AI Recruiter** es un sistema de evaluación automática de candidatos que procesa CVs en PDF, los compara contra descripciones de puesto y genera recomendaciones de contratación (ADVANCE / REVIEW / REJECT) con feedback personalizado y preguntas de entrevista.

### Flujo Principal

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Cliente    │────►│  S3 Presigned│────►│  PDF Queue       │────►│  PDF Consumer       │────►│  AI Recruiter    │
│  (Browser)  │     │  POST Endpoint│     │  (BullMQ)        │     │  (Worker)           │     │  Queue + Worker  │
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

---

## 🏗️ Arquitectura en Capas

| Capa | Responsabilidad | Componentes |
|------|-----------------|-------------|
| **Transport** | HTTP Controllers, BullMQ Workers (thin) | `RecruiterController`, `UploadController`, `PdfConsumer`, `AiRecruiterConsumer` |
| **Application** | Use Cases, Policies | `EvaluateCandidateUseCase`, `ScoringPolicy` |
| **Domain/Graph** | Ports, Nodes (pure functions), Tools | `IEvaluationGraph`, `analyzer/matcher/scorer/feedback nodes`, `JobMatcherTool` |
| **Infrastructure** | LLM Providers, S3 Adapter, Drizzle Repositories | `LlmProviderFactory`, `S3FileStorageAdapter`, `DrizzleEvaluationRepository` |

---

## ✨ Características Principales

- **Subida directa a S3** — Cliente obtiene presigned POST, sube PDF sin pasar por el backend
- **Pipeline asíncrono** — BullMQ con Job Chaining nativo (atomicidad queue→queue)
- **LangGraph real** — 4 nodos: Analyzer (LLM), Matcher (determinístico), Scorer (Policy), Feedback (LLM)
- **Scoring configurable** — Pesos (50/30/20) y thresholds via ConfigService
- **Persistencia PostgreSQL + pgvector** — Listo para búsqueda semántica futura
- **Value Objects** — Validación de invariantes en boundary (S3Key, JobDescription, JobTitle)
- **Error handling robusto** — `handleNodeError` + `createErrorState` en cada nodo
- **Inmutabilidad estricta** — Nodos retornan objetos nuevos completos (A9)

---

## 📋 Requisitos Previos

| Herramienta | Versión |
|-------------|---------|
| Node.js | ≥ 20.x |
| npm | ≥ 10.x |
| PostgreSQL | ≥ 14 con extensión **pgvector** |
| Redis | ≥ 7 (para BullMQ) |
| Cuenta S3-compatible | Filebase, AWS S3, MinIO, etc. |

### Variables de Entorno Requeridas

Crea un archivo `.env` en la raíz:

```env
# App
PORT=3000
NODE_ENV=development

# Database (PostgreSQL con pgvector)
DATABASE_URL=postgresql://user:password@localhost:5432/ai_recruiter?schema=public

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# S3 (Filebase / AWS / MinIO)
S3_ENDPOINT=https://s3.filebase.com
S3_ACCESS_KEY=tu_access_key
S3_SECRET_KEY=tu_secret_key

# LLM Provider (elige uno)
LLM_PROVIDER=openai          # openai | openrouter | gemini
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Opcional: OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3-opus

# Opcional: Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro

# Scoring Policy (opcional - tienen defaults)
SCORING_WEIGHT_SKILLS=0.5
SCORING_WEIGHT_EXPERIENCE=0.3
SCORING_WEIGHT_EDUCATION=0.2
SCORING_THRESHOLD_ADVANCE=85
SCORING_THRESHOLD_REVIEW=50
SCORING_THRESHOLD_REJECT=0
```

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd ai-recruiter
npm install --legacy-peer-deps
```

> **Nota:** Se usa `--legacy-peer-deps` por conflictos de versiones en dependencias de LangChain (zod v4 vs v3).

### 2. Levantar infraestructura (Docker Compose)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_recruiter
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
```

```bash
docker-compose up -d
```

### 3. Ejecutar migraciones (Drizzle)

```bash
# Generar migraciones (primera vez)
npx drizzle-kit generate

# Aplicar migraciones
npx drizzle-kit migrate

# O empujar schema directamente (desarrollo)
npx drizzle-kit push
```

> **Importante:** La extensión `pgvector` se habilita automáticamente en la imagen `pgvector/pgvector:pg16`.

### 4. Compilar y ejecutar

```bash
# Desarrollo (watch mode)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

El servidor estará disponible en `http://localhost:3000`

---

## 🧪 Cómo Probar el Flujo Completo

### Opción A: Con `curl` (paso a paso)

#### 1. Obtener Presigned POST para subir PDF

```bash
curl -X POST http://localhost:3000/recruiter/upload/presigned \
  -H "Content-Type: application/json" \
  -d '{"filename":"cv.pdf","contentType":"application/pdf"}'
```

**Respuesta:**
```json
{
  "url": "https://s3.filebase.com/...",
  "fields": { "key": "cvs/uuid.pdf", "policy": "...", "x-amz-signature": "...", ... },
  "key": "cvs/abc-123.pdf",
  "expiresIn": 3600
}
```

#### 2. Subir PDF directo a S3 (desde cliente)

```bash
# Guardar la respuesta anterior en variables
KEY="cvs/abc-123.pdf"
URL="https://s3.filebase.com/..."
# ... otros campos de fields

curl -X POST "$URL" \
  -F "key=$KEY" \
  -F "policy=$POLICY" \
  -F "x-amz-signature=$SIGNATURE" \
  -F "x-amz-credential=$CREDENTIAL" \
  -F "x-amz-algorithm=AWS4-HMAC-SHA256" \
  -F "x-amz-date=$DATE" \
  -F "file=@./test-cv.pdf"
```

#### 3. Encolar evaluación

```bash
curl -X POST http://localhost:3000/recruiter/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "s3Key": "cvs/abc-123.pdf",
    "jobDescription": "Buscamos Senior Fullstack Developer con 5+ años en React, Node.js, TypeScript, AWS, Docker. Valorable: Kubernetes, GraphQL.",
    "jobTitle": "Senior Fullstack Developer"
  }'
```

**Respuesta:**
```json
{
  "jobId": "eval-xyz-789",
  "status": "queued",
  "message": "PDF encolado para procesamiento"
}
```

#### 4. Consultar estado (polling)

```bash
# Esperar unos segundos y consultar
curl http://localhost:3000/recruiter/status/eval-xyz-789
```

**Respuesta mientras procesa:**
```json
{
  "jobId": "eval-xyz-789",
  "status": "active",
  "message": "Evaluación en cola de IA",
  "source": "ai-recruiter-queue"
}
```

**Respuesta completado:**
```json
{
  "jobId": "eval-xyz-789",
  "status": "completed",
  "result": {
    "jobId": "eval-xyz-789",
    "s3Key": "cvs/abc-123.pdf",
    "cvText": "Texto extraído del CV...",
    "jobDescription": "Buscamos Senior Fullstack...",
    "jobTitle": "Senior Fullstack Developer",
    "scores": { "overall": 82, "skills": 85, "experience": 75, "education": 90 },
    "recommendation": { 
      "decision": "ADVANCE", 
      "confidence": 80, 
      "reasoning": "Score 82/100 (skills: 85, exp: 75, edu: 90) | Policy: ADVANCE at 82" 
    },
    "match": { 
      "score": 85,
      "details": { 
        "skills": { "matched": ["React", "Node.js", "TypeScript", "AWS"], "missing": ["Kubernetes", "GraphQL"], "score": 85 },
        "experience": { "score": 75, "reasoning": "Candidato: 4 años, Requerido: 5 años" },
        "education": { "score": 90, "reasoning": "Requerido: bachelor, Candidato nivel: 3" }
      },
      "strengths": ["React", "Node.js", "TypeScript", "AWS"],
      "weaknesses": ["Kubernetes", "GraphQL"]
    },
    "output": {
      "interviewQuestions": [
        "¿Cómo diseñarías una arquitectura escalable con React y Node.js?",
        "Describe tu experiencia con AWS y contenedores Docker.",
        "¿Cómo abordarías la migración a Kubernetes?"
      ],
      "feedbackForCandidate": "Tu perfil muestra sólida experiencia en React, Node.js y AWS...",
      "salarySuggestion": "$120,000 - $150,000 USD anuales",
      "nextSteps": ["Entrevista técnica", "Revisión de arquitectura"]
    },
    "meta": { "step": "Complete", "errors": [], "warnings": [], "processingTime": 0, "timestamp": "..." },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### Opción B: Script de prueba automatizado

Crea `test-flow.sh`:

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:3000"
PDF_PATH="./test-cv.pdf"  # Debe existir un PDF de prueba

echo "1. Obteniendo presigned POST..."
PRESIGNED=$(curl -s -X POST "$BASE_URL/recruiter/upload/presigned" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test-cv.pdf","contentType":"application/pdf"}')

KEY=$(echo $PRESIGNED | jq -r '.key')
URL=$(echo $PRESIGNED | jq -r '.url')
POLICY=$(echo $PRESIGNED | jq -r '.fields.policy')
SIGNATURE=$(echo $PRESIGNED | jq -r '.fields."x-amz-signature"')
CREDENTIAL=$(echo $PRESIGNED | jq -r '.fields."x-amz-credential"')
ALGORITHM=$(echo $PRESIGNED | jq -r '.fields."x-amz-algorithm"')
DATE=$(echo $PRESIGNED | jq -r '.fields."x-amz-date"')

echo "Key: $KEY"

echo "2. Subiendo PDF a S3..."
curl -s -X POST "$URL" \
  -F "key=$KEY" \
  -F "policy=$POLICY" \
  -F "x-amz-signature=$SIGNATURE" \
  -F "x-amz-credential=$CREDENTIAL" \
  -F "x-amz-algorithm=$ALGORITHM" \
  -F "x-amz-date=$DATE" \
  -F "file=@$PDF_PATH" > /dev/null

echo "3. Encolando evaluación..."
EVAL=$(curl -s -X POST "$BASE_URL/recruiter/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "s3Key": "'$KEY'",
    "jobDescription": "Senior Fullstack Developer con 5+ años en React, Node.js, TypeScript, AWS. Valorable: Kubernetes, GraphQL.",
    "jobTitle": "Senior Fullstack Developer"
  }')

JOB_ID=$(echo $EVAL | jq -r '.jobId')
echo "Job ID: $JOB_ID"

echo "4. Esperando resultado (polling)..."
for i in {1..30}; do
  sleep 3
  STATUS=$(curl -s "$BASE_URL/recruiter/status/$JOB_ID")
  STATE=$(echo $STATUS | jq -r '.status')
  echo "  Intento $i: $STATE"
  if [ "$STATE" = "completed" ]; then
    echo "✅ Completado!"
    echo $STATUS | jq '.result.recommendation'
    echo $STATUS | jq '.result.scores'
    echo $STATUS | jq '.result.output.interviewQuestions'
    exit 0
  elif [ "$STATE" = "failed" ]; then
    echo "❌ Falló"
    echo $STATUS | jq .
    exit 1
  fi
done

echo "⏰ Timeout"
exit 1
```

```bash
chmod +x test-flow.sh
./test-flow.sh
```

---

## 📁 Estructura del Proyecto

```
src/
├── db/
│   ├── schema/
│   │   ├── evaluations.ts          # Tabla evaluations + pgvector
│   │   └── extracted-pdfs.ts       # Tabla extracted_pdfs
│   └── drizzle.config.ts           # Config drizzle-kit
├── modules/
│   └── recruiter/
│       ├── controllers/
│       │   ├── recruiter.controller.ts   # POST /evaluate, GET /status
│       │   └── upload.controller.ts      # POST /upload/presigned
│       ├── use-cases/
│       │   └── evaluate-candidate.use-case.ts
│       ├── policies/
│       │   └── scoring.policy.ts         # Pesos/thresholds configurables
│       ├── interfaces/
│       │   ├── evaluation-graph.interface.ts
│       │   └── evaluation.repository.interface.ts
│       ├── repositories/
│       │   └── drizzle-evaluation.repository.ts
│       ├── queues/
│       │   ├── pdf/
│       │   │   └── pdf.consumer.ts         # Extrae texto, job chaining
│       │   └── ai-recruiter/
│       │       └── ai-recruiter.consumer.ts # UseCase → Graph → Persist
│       ├── nodes/
│       │   ├── analyzer.node.ts      # LLM: AnalyzeJobDescriptionCall
│       │   ├── matcher.node.ts       # Tool: JobMatcherTool
│       │   ├── scorer.node.ts        # Policy: ScoringPolicy
│       │   └── feedback.node.ts      # LLM: GenerateFeedbackCall
│       ├── llm/
│       │   └── structured-llm-calls.ts   # Strategies inyectables
│       ├── graph/
│       │   ├── recruiter.graph.ts    # Factory createEvaluationGraph
│       │   └── node-error-handler.ts # handleNodeError + createErrorState
│       ├── state/
│       │   └── recruiter.state.ts    # Annotation.Root + reducers
│       ├── tools/
│       │   ├── pdf-extractor.tool.ts
│       │   └── job-matcher.tool.ts
│       ├── value-objects/
│       │   └── evaluation-request.vo.ts  # S3Key, JobDescription, JobTitle
│       ├── validators/
│       │   ├── s3-key.validator.ts
│       │   └── job-description.validator.ts
│       └── constants/
│           └── job-names.ts
├── common/
│   └── dto/
│       └── evaluate-candidate.dto.ts
└── modules/
    └── llm/
        └── llm.module.ts             # LLM_PROVIDER token
```

---

## ⚙️ Configuración Avanzada

### Cambiar Proveedor LLM

```bash
# En .env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3-opus
```

### Ajustar Scoring Policy

```bash
# En .env (valores por defecto mostrados)
SCORING_WEIGHT_SKILLS=0.5
SCORING_WEIGHT_EXPERIENCE=0.3
SCORING_WEIGHT_EDUCATION=0.2
SCORING_THRESHOLD_ADVANCE=85
SCORING_THRESHOLD_REVIEW=50
SCORING_THRESHOLD_REJECT=0
```

### Checkpointer Persistente (Producción)

En `recruiter.module.ts`, reemplaza `MemorySaver` por `PostgresSaver`:

```typescript
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

// En factory de EVALUATION_GRAPH:
const checkpointer = new PostgresSaver({
  connectionString: configService.get('DATABASE_URL'),
});
await checkpointer.setup(); // Ejecutar una vez al inicio
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| `Connection refused` Redis | Verifica `docker-compose up -d` y `REDIS_HOST/PORT` |
| `relation "evaluations" does not exist` | Ejecuta `npx drizzle-kit migrate` o `push` |
| `pgvector extension not found` | Usa imagen `pgvector/pgvector:pg16` |
| `LLM rate limit` | Revisa cuotas de tu proveedor; ajusta `attempts/backoff` en queue AI_RECRUITER |
| `File not found in S3` | Verifica que el `s3Key` coincida con el subido; comprueba `S3_ENDPOINT` |
| Build errors zod | Usa `npm install --legacy-peer-deps` |

---

## 📄 Licencia

UNLICENSED — Uso interno.

---

## 🤝 Contribuir

1. Fork del repo
2. Crea feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit convencional (`git commit -m "feat: agregar X"`)
4. Push y PR

---

**Desarrollado con** ❤️ **usando NestJS, LangGraph, BullMQ, Drizzle ORM y pgvector.**