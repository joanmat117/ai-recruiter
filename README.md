# AI Recruiter — Async Queue-Based Candidate Evaluation System

> **Arquitectura:** NestJS 11 + LangGraph + BullMQ + Drizzle ORM + pgvector + S3 (RustFS local / Filebase / AWS / MinIO)
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
- **S3 Local con RustFS** — `docker-compose` levanta S3 compatible completo (API + Console)

---

## 📋 Requisitos Previos

| Herramienta | Versión |
|-------------|---------|
| Docker / Docker Compose | ≥ 2.20 / ≥ 2.0 |
| Node.js | ≥ 20.x (solo para desarrollo local sin Docker) |
| npm | ≥ 10.x (solo para desarrollo local sin Docker) |

> **Con Docker Compose:** No necesitas instalar PostgreSQL, Redis, RustFS ni Node.js localmente. Todo corre en contenedores.

---

## 🚀 Instalación y Puesta en Marcha (Con Docker Compose - RECOMENDADO)

### 1. Clonar repositorio

```bash
git clone <repo-url>
cd ai-recruiter
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

**Edita `.env` con tus credenciales:**

```env
# LLM Provider (OBLIGATORIO - elige uno)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-tu-api-key-aqui
# OPENAI_MODEL=gpt-4o

# O usa OpenRouter:
# LLM_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk-or-tu-api-key

# O usa Gemini:
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=tu-api-key
```

> **Nota:** Las variables de S3, Database y Redis ya vienen configuradas para funcionar con `docker-compose` (RustFS local, PostgreSQL y Redis en contenedores).

### 3. Levantar TODO (PostgreSQL + Redis + RustFS + App)

```bash
docker-compose up -d --build
```

### 4. Verificar servicios

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver solo RustFS
docker-compose logs -f rustfs

# Ver solo App
docker-compose logs -f app
```

### 5. Acceder a RustFS Console (S3 Local)

```
URL: http://localhost:9001
Usuario: rustfsadmin
Contraseña: rustfsadmin
```

**Crear bucket `ai-recruiter`:**
1. Entra a la console → Buckets → Create Bucket
2. Nombre: `ai-recruiter`
3. Región: `us-east-1` (cualquiera sirve en local)

### 6. Migraciones de Base de Datos

```bash
# Ejecutar dentro del contenedor de la app
docker-compose exec app npx drizzle-kit push
```

### 7. Probar la API

```bash
# Health check
curl http://localhost:3000/health

# Obtener presigned POST
curl -X POST http://localhost:3000/recruiter/upload/presigned \
  -H "Content-Type: application/json" \
  -d '{"filename":"cv.pdf","contentType":"application/pdf"}'
```

---

## 🛠️ Desarrollo Local: Infraestructura en Docker, App en Local

> **Útil para:** Debug con breakpoints, hot-reload (`npm run start:dev`), logs en tu terminal nativo.

### 1. Levantar SOLO la infraestructura (PostgreSQL + Redis + RustFS)

```bash
# Opción A: Comandos individuales
# PostgreSQL + pgvector
docker run -d --name ai-recruiter-pg \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_recruiter \
  -v pg_data:/var/lib/postgresql/data \
  pgvector/pgvector:pg16

# Redis
docker run -d --name ai-recruiter-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine

# RustFS (S3 Local) — requiere RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true en local (4 volúmenes en mismo disco)
docker run -d --name ai-recruiter-rustfs \
  -p 9000:9000 -p 9001:9001 \
  -e RUSTFS_ACCESS_KEY=rustfsadmin \
  -e RUSTFS_SECRET_KEY=rustfsadmin \
  -e RUSTFS_CONSOLE_ENABLE=true \
  -e RUSTFS_VOLUMES=/data/rustfs{0...3} \
  -e RUSTFS_ADDRESS=0.0.0.0:9000 \
  -e RUSTFS_CONSOLE_ADDRESS=0.0.0.0:9001 \
  -e RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true \
  -v rustfs_data_0:/data/rustfs0 \
  -v rustfs_data_1:/data/rustfs1 \
  -v rustfs_data_2:/data/rustfs2 \
  -v rustfs_data_3:/data/rustfs3 \
  rustfs/rustfs:latest

# Fix permisos volúmenes (RustFS corre como UID 10001, Docker volumes se crean como root)
# Solo necesario con "Opción A: Comandos individuales"
docker run --rm \
  -v rustfs_data_0:/data/rustfs0 \
  -v rustfs_data_1:/data/rustfs1 \
  -v rustfs_data_2:/data/rustfs2 \
  -v rustfs_data_3:/data/rustfs3 \
  alpine sh -c "chown -R 10001:10001 /data/rustfs0 /data/rustfs1 /data/rustfs2 /data/rustfs3"
```

```bash
# Opción B: Docker Compose solo para infra (recomendado)
# Crea docker-compose.infra.yml:
cat > docker-compose.infra.yml <<'EOF'
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: ai-recruiter-pg
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_recruiter
    volumes: [pg_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: ai-recruiter-redis
    ports: ["6379:6379"]
    volumes: [redis_data:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  rustfs:
    image: rustfs/rustfs:latest
    container_name: ai-recruiter-rustfs
    ports: ["9000:9000", "9001:9001"]
    environment:
      RUSTFS_ACCESS_KEY: rustfsadmin
      RUSTFS_SECRET_KEY: rustfsadmin
      RUSTFS_CONSOLE_ENABLE: "true"
      RUSTFS_VOLUMES: "/data/rustfs{0...3}"
      RUSTFS_ADDRESS: "0.0.0.0:9000"
      RUSTFS_CONSOLE_ADDRESS: "0.0.0.0:9001"
      RUSTFS_UNSAFE_BYPASS_DISK_CHECK: "true"
    volumes:
      - rustfs_data_0:/data/rustfs0
      - rustfs_data_1:/data/rustfs1
      - rustfs_data_2:/data/rustfs2
      - rustfs_data_3:/data/rustfs3
    healthcheck:
      test: ["CMD", "sh", "-ec", "curl -fsS http://127.0.0.1:9000/health && curl -fsS http://127.0.0.1:9001/rustfs/console/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  pg_data:
  redis_data:
  rustfs_data_0:
  rustfs_data_1:
  rustfs_data_2:
  rustfs_data_3:
EOF

# Levantar
docker compose -f docker-compose.infra.yml up -d
```

### 2. Verificar que la infra está lista

```bash
# Esperar ~20-30 seg (RustFS tarda más con UNSAFE_BYPASS_DISK_CHECK)
sleep 30

# PostgreSQL
docker exec ai-recruiter-pg pg_isready -U postgres

# Redis
docker exec ai-recruiter-redis redis-cli ping

# RustFS
curl -f http://localhost:9000/health && curl -f http://localhost:9001/rustfs/console/health
```

> **⚠️ Si RustFS falla con `Permission denied (os error 13)`:** Los volúmenes Docker se crean como `root` pero RustFS corre como UID 10001. Ejecuta el fix de permisos y reinicia:
> ```bash
> docker rm -f ai-recruiter-rustfs
> docker run --rm \
>   -v rustfs_data_0:/data/rustfs0 \
>   -v rustfs_data_1:/data/rustfs1 \
>   -v rustfs_data_2:/data/rustfs2 \
>   -v rustfs_data_3:/data/rustfs3 \
>   alpine sh -c "chown -R 10001:10001 /data/rustfs0 /data/rustfs1 /data/rustfs2 /data/rustfs3"
> # Luego vuelve a lanzar el docker run de RustFS (paso 1)
> ```
> Con **Opción B (docker-compose.infra.yml)** esto es automático vía `volume-permission-helper`.

### 3. Crear bucket S3 (una sola vez)

```bash
node -e "
const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: { accessKeyId: 'rustfsadmin', secretAccessKey: 'rustfsadmin' },
  forcePathStyle: true
});
s3.send(new CreateBucketCommand({ Bucket: 'ai-recruiter' }))
  .then(() => console.log('✅ Bucket ai-recruiter creado'))
  .catch(e => console.error('❌', e.message));
"
```

### 4. Variables de entorno para desarrollo local

```bash
# Crea .env.local (no commit)
cat > .env.local <<'EOF'
# App
PORT=3000
NODE_ENV=development

# Database (apunta a localhost porque la app corre en host, no en Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_recruiter

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# S3 (RustFS local)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=rustfsadmin
S3_SECRET_KEY=rustfsadmin

# LLM (REQUERIDO - elige uno)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-tu-api-key-aqui
# OPENROUTER_API_KEY=sk-or-tu-api-key
# GEMINI_API_KEY=tu-api-key

# Opcional
CHROMA_DB_URL=http://localhost:8000
EOF
```

### 5. Migraciones y arranque

```bash
# Instalar deps si no lo hiciste
npm ci --legacy-peer-deps

# Build + migraciones
npm run build
npx drizzle-kit push

# Arrancar con hot-reload
npm run start:dev
```

### 6. Verificar API

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

---

## 🧪 Cómo Probar el Flujo Completo

### Opción A: Script automatizado (recomendado)

```bash
# Necesitas un PDF de prueba
./test-flow.sh ./mi-cv.pdf
```

**Qué hace el script:**
1. Obtiene presigned POST de la API
2. Sube PDF directo a RustFS (S3 local)
3. Encola evaluación con job description de prueba
4. Polling de estado cada 3s (máx 90s)
5. Muestra resultado: recomendación, scores, preguntas, feedback

### Opción B: Paso a paso con `curl`

#### 1. Obtener Presigned POST

```bash
curl -X POST http://localhost:3000/recruiter/upload/presigned \
  -H "Content-Type: application/json" \
  -d '{"filename":"cv.pdf","contentType":"application/pdf"}'
```

**Respuesta:**
```json
{
  "url": "http://localhost:9000/...",
  "fields": { "key": "cvs/uuid.pdf", "policy": "...", "x-amz-signature": "...", ... },
  "key": "cvs/abc-123.pdf",
  "expiresIn": 3600
}
```

#### 2. Subir PDF directo a RustFS (S3 local)

```bash
KEY="cvs/abc-123.pdf"
URL="http://localhost:9000/..."
# ... extraer fields de la respuesta anterior

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
curl http://localhost:3000/recruiter/status/eval-xyz-789
```

**Respuesta completado:**
```json
{
  "jobId": "eval-xyz-789",
  "status": "completed",
  "result": {
    "recommendation": { "decision": "ADVANCE", "confidence": 80, "reasoning": "..." },
    "scores": { "overall": 82, "skills": 85, "experience": 75, "education": 90 },
    "output": {
      "interviewQuestions": [...],
      "feedbackForCandidate": "...",
      "salarySuggestion": "$120,000 - $150,000",
      "nextSteps": ["Entrevista técnica", "Revisión de arquitectura"]
    }
  }
}
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

```env
# En .env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3-opus
```

### Usar S3 Externo (Filebase / AWS / MinIO / Cloudflare R2)

En lugar de RustFS local, edita `.env`:

```env
S3_ENDPOINT=https://s3.filebase.com
S3_ACCESS_KEY=tu_access_key
S3_SECRET_KEY=tu_secret_key
```

### Ajustar Scoring Policy

```env
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

const checkpointer = new PostgresSaver({
  connectionString: configService.get('DATABASE_URL'),
});
await checkpointer.setup();
```

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| `Connection refused` Redis/Postgres | `docker-compose up -d` y espera healthchecks |
| `relation "evaluations" does not exist` | `docker-compose exec app npx drizzle-kit push` |
| `pgvector extension not found` | Imagen `pgvector/pgvector:pg16` ya la incluye |
| `LLM rate limit` | Revisa cuotas; ajusta `attempts/backoff` en queue AI_RECRUITER |
| `File not found in S3` | Verifica bucket `ai-recruiter` existe en RustFS console |
| `RustFS healthcheck failing` | Espera `start_period: 40s`; revisa `docker-compose logs rustfs` |
| `Permission denied` RustFS volumes | `volume-permission-helper` corre antes; si falla: `docker-compose restart volume-permission-helper rustfs` |
| Build errors zod | `npm install --legacy-peer-deps` en local; Dockerfile ya lo maneja |

---

## 🔧 Comandos Útiles Docker Compose

```bash
# Levantar todo en background
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f app
docker-compose logs -f rustfs
docker-compose logs -f postgres

# Reiniciar un servicio
docker-compose restart app

# Bajar todo (mantiene volúmenes)
docker-compose down

# Bajar todo Y eliminar volúmenes (¡CUIDADO: borra datos!)
docker-compose down -v

# Ejecutar comando en contenedor app
docker-compose exec app npx drizzle-kit push
docker-compose exec app npx drizzle-kit studio

# Entrar a shell del contenedor
docker-compose exec app sh

# Ver estado de salud
docker-compose ps
```

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

**Desarrollado con** ❤️ **usando NestJS, LangGraph, BullMQ, Drizzle ORM, pgvector y RustFS.**