# Fase 3: Persistencia Real + Status Endpoint (Production Ready)

> **Requisito:** Fases 0, 1 y 2 completadas. Graph ejecuta end-to-end con cvText extraído.
> **Objetivo:** Persistir resultados en BD real (Drizzle + pgvector), exponer estado vía API REST, y conectar el pipeline queue→worker→DB.

---

## 3.1 Drizzle Schema + pgvector

### Archivos Nuevos

#### `src/db/schema/evaluations.ts`
```typescript
import { pgTable, uuid, varchar, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const evaluations = pgTable('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: varchar('job_id', { length: 255 }).notNull().unique(),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  cvText: text('cv_text').notNull(),
  jobDescription: text('job_description').notNull(),
  jobTitle: varchar('job_title', { length: 255 }),
  // pgvector para búsqueda semántica futura de CVs por similitud
  cvEmbedding: integer('cv_embedding', { length: 1536 }).array(), // pgvector extension: vector(1536)
  scores: jsonb('scores').notNull(),
  recommendation: jsonb('recommendation').notNull(),
  matchDetails: jsonb('match_details').notNull(),
  output: jsonb('output').notNull(),
  meta: jsonb('meta').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  // TODO Fase 5: relación con extracted_pdfs
}));
```

#### `src/db/schema/extracted-pdfs.ts`
```typescript
import { pgTable, uuid, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const extractedPdfs = pgTable('extracted_pdfs', {
  id: uuid('id').primaryKey().defaultRandom(),
  s3Key: varchar('s3_key', { length: 500 }).notNull().unique(),
  extractedText: text('extracted_text').notNull(),
  jobDescription: text('job_description').notNull(),
  jobTitle: varchar('job_title', { length: 255 }),
  embedding: integer('embedding', { length: 1536 }).array(), // pgvector
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

#### `drizzle.config.ts`
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

---

### SQL Migración (PostgreSQL con pgvector)

```sql
-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla evaluations
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_evaluations_job_id ON evaluations(job_id);
CREATE INDEX idx_evaluations_s3_key ON evaluations(s3_key);
CREATE INDEX idx_evaluations_created_at ON evaluations(created_at DESC);
CREATE INDEX idx_evaluations_cv_embedding ON evaluations USING ivfflat (cv_embedding vector_cosine_ops);

-- Tabla extracted_pdfs
CREATE TABLE extracted_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  s3_key VARCHAR(500) UNIQUE NOT NULL,
  extracted_text TEXT NOT NULL,
  job_description TEXT NOT NULL,
  job_title VARCHAR(255),
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_extracted_pdfs_s3_key ON extracted_pdfs(s3_key);
CREATE INDEX idx_extracted_pdfs_created_at ON extracted_pdfs(created_at DESC);
```

**Nota:** pgvector requiere PostgreSQL 12+ con la extensión instalada. Para desarrollo local, usar Docker: `pgvector/pgvector:pg16`.

---

## 3.2 Repository Pattern (Drizzle)

### Interface del Puerto
**`src/modules/recruiter/interfaces/evaluation.repository.interface.ts`**

```typescript
import { EvaluationInput, EvaluationOutput } from '../state/recruiter.state';

export interface IEvaluationRepository {
  save(input: EvaluationInput): Promise<EvaluationOutput>;
  findByJobId(jobId: string): Promise<EvaluationOutput | null>;
  findByS3Key(s3Key: string): Promise<EvaluationOutput | null>;
  findRecent(limit?: number): Promise<EvaluationOutput[]>;
  searchByEmbedding(embedding: number[], limit?: number): Promise<EvaluationOutput[]>; // Fase 5
}

export const EVALUATION_REPOSITORY = Symbol('IEvaluationRepository');
```

### Implementación Drizzle
**`src/modules/recruiter/repositories/drizzle-evaluation.repository.ts`**

```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc, and } from 'drizzle-orm';
import { evaluations, extractedPdfs, type Evaluations } from '../../../db/schema/evaluations';
import { IEvaluationRepository, EVALUATION_REPOSITORY } from '../interfaces/evaluation.repository.interface';
import { RecruiterOutput } from '../state/recruiter.state';
import { EvaluationRequest } from '../value-objects/evaluation-request.vo';

export type EvaluationInput = {
  jobId: string;
  s3Key: string;
  cvText: string;
  jobDescription: string;
  jobTitle?: string;
  cvEmbedding?: number[]; // pgvector
  scores: RecruiterOutput['scores'];
  recommendation: RecruiterOutput['recommendation'];
  matchDetails: RecruiterOutput['match'];
  output: RecruiterOutput['output'];
  meta: RecruiterOutput['meta'];
};

export type EvaluationOutput = EvaluationInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class DrizzleEvaluationRepository implements IEvaluationRepository {
  private readonly logger = new Logger(DrizzleEvaluationRepository.name);
  private db: PostgresJsDatabase<typeof import('../../../db/schema/evaluations')>;

  constructor() {
    const sql = postgres(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
  }

  async save(input: EvaluationInput): Promise<EvaluationOutput> {
    try {
      const [record] = await this.db
        .insert(evaluations)
        .values({
          jobId: input.jobId,
          s3Key: input.s3Key,
          cvText: input.cvText,
          jobDescription: input.jobDescription,
          jobTitle: input.jobTitle,
          cvEmbedding: input.cvEmbedding,
          scores: input.scores,
          recommendation: input.recommendation,
          matchDetails: input.matchDetails,
          output: input.output,
          meta: input.meta,
        })
        .returning();
      
      this.logger.log(`Evaluación guardada: ${record.jobId}`);
      return this.mapRecord(record);
    } catch (err) {
      this.logger.error(`Error guardando evaluación ${input.jobId}: ${err.message}`);
      throw err;
    }
  }

  async findByJobId(jobId: string): Promise<EvaluationOutput | null> {
    const [record] = await this.db
      .select()
      .from(evaluations)
      .where(eq(evaluations.jobId, jobId));
    
    return record ? this.mapRecord(record) : null;
  }

  async findByS3Key(s3Key: string): Promise<EvaluationOutput | null> {
    const [record] = await this.db
      .select()
      .from(evaluations)
      .where(eq(evaluations.s3Key, s3Key));
    
    return record ? this.mapRecord(record) : null;
  }

  async findRecent(limit: number = 50): Promise<EvaluationOutput[]> {
    const records = await this.db
      .select()
      .from(evaluations)
      .orderBy(desc(evaluations.createdAt))
      .limit(limit);
    
    return records.map(r => this.mapRecord(r));
  }

  async searchByEmbedding(embedding: number[], limit: number = 10): Promise<EvaluationOutput[]> {
    // Fase 5: búsqueda semántica con pgvector
    // Implementar con cosine distance cuando se necesite
    throw new Error('Not implemented yet - Fase 5');
  }

  private mapRecord(record: Evaluations): EvaluationOutput {
    return {
      id: record.id,
      jobId: record.jobId,
      s3Key: record.s3Key,
      cvText: record.cvText,
      jobDescription: record.jobDescription,
      jobTitle: record.jobTitle,
      cvEmbedding: record.cvEmbedding,
      scores: record.scores as RecruiterOutput['scores'],
      recommendation: record.recommendation as RecruiterOutput['recommendation'],
      matchDetails: record.matchDetails as RecruiterOutput['match'],
      output: record.output as RecruiterOutput['output'],
      meta: record.meta as RecruiterOutput['meta'],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
```

### Module Binding
**`src/modules/recruiter/recruiter.module.ts`**

```typescript
providers: [
  // ... existing (0.1-0.9, Fase 1, Fase 2)
  {
    provide: EVALUATION_REPOSITORY,
    useClass: DrizzleEvaluationRepository,
  },
],
exports: [EVALUATION_REPOSITORY],
```

---

## 3.3 Persistir Resultado en AiRecruiterConsumer

### Modificar
**`src/modules/recruiter/queues/ai-recruiter/ai-recruiter.consumer.ts`**

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, AI_RECRUITER_JOBS } from '../../constants/job-names';
import { Inject, Logger } from '@nestjs/common';
import { EvaluateCandidateUseCase } from '../../use-cases/evaluate-candidate.use-case';
import { EVALUATION_REPOSITORY } from '../../interfaces/evaluation.repository.interface';
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
    @Inject(EVALUATION_REPOSITORY) private readonly evaluationRepository: DrizzleEvaluationRepository,
  ) {
    super();
  }

  async process(job: AiRecruiterJob): Promise<RecruiterOutput> {
    this.logger.log(`Evaluando candidato para job ${job.id}`);
    
    const { cvText, jobDescription, jobTitle } = job.data;
    
    const result = await this.evaluateCandidateUseCase.execute({
      cvText,
      jobDescription,
      jobTitle,
    });

    // Persistir resultado en BD (transaccional con el graph)
    await this.evaluationRepository.save({
      jobId: job.id,
      s3Key: job.data.sourceS3Key,
      cvText,
      jobDescription,
      jobTitle,
      cvEmbedding: undefined, // Fase 5: embedding service
      scores: result.scores,
      recommendation: result.recommendation,
      matchDetails: result.match,
      output: result.output,
      meta: result.meta,
    });

    this.logger.log(`Resultado persistido para job ${job.id}`);
    return result;
  }

  @OnWorkerEvent("failed")
  async onFailed(job: AiRecruiterJob | undefined, err: Error) {
    this.logger.error(`Evaluación fallida: ${err.message}`);
    // BullMQ maneja retries via job options; DLQ configurado en module
  }
}
```

**Arquitectura:** El Use Case devuelve el resultado, y el worker lo persiste. No hay side effects en `onCompleted` — todo es transaccional en `process()`.

---

## 3.4 Status Endpoint Real (lee de DB)

### Modificar
**`src/modules/recruiter/controllers/recruiter.controller.ts`**

```typescript
import { Controller, Get, Param, Inject, BadRequestException } from '@nestjs/common';
import { EVALUATION_REPOSITORY } from '../interfaces/evaluation.repository.interface';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../constants/job-names';

@Controller('recruiter')
export class RecruiterController {
  constructor(
    @Inject(EVALUATION_REPOSITORY) private readonly evaluationRepository: DrizzleEvaluationRepository,
    @Inject(getQueueToken(QUEUE_NAMES.PDF_EXTRACTION)) private readonly pdfQueue: Queue,
    @Inject(getQueueToken(QUEUE_NAMES.AI_RECRUITER)) private readonly aiRecruiterQueue: Queue,
  ) {}

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    // 1. Buscar en BD primero (resultado final)
    const evaluation = await this.evaluationRepository.findByJobId(jobId);
    if (evaluation) {
      return {
        jobId,
        status: 'completed',
        result: evaluation,
      };
    }

    // 2. No está en BD: verificar colas (procesando o fallido)
    const pdfJob = await this.pdfQueue.getJob(jobId);
    const aiJob = await this.aiRecruiterQueue.getJob(jobId);

    if (pdfJob) {
      const state = await pdfJob.getState();
      return {
        jobId,
        status: state, // 'waiting', 'active', 'completed', 'failed', 'delayed'
        message: 'PDF en cola de extracción',
        source: 'pdf-extraction-queue',
      };
    }

    if (aiJob) {
      const state = await aiJob.getState();
      return {
        jobId,
        status: state,
        message: 'Evaluación en cola de IA',
        source: 'ai-recruiter-queue',
      };
    }

    throw new BadRequestException(`Job no encontrado: ${jobId}`);
  }
}
```

---

## 3.5 Repository para Extracted PDFs (Opcional - Fase 4+)

**`src/modules/recruiter/interfaces/extracted-pdf.repository.interface.ts`** ya existe con implementación in-memory. Para Fase 3+, considerar migrar a Drizzle también:

```typescript
export interface IExtractedPdfRepository {
  save(input: { extractedText: string; s3Key: string; jobDescription: string; jobTitle?: string }): Promise<void>;
  findByS3Key(s3Key: string): Promise<ExtractedPdf | null>;
}
```

---

## 3.6 Embedding Service (Placeholder - Fase 5)

**`src/modules/recruiter/services/embedding.service.ts`** (stub para pgvector)

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  async embed(text: string): Promise<number[]> {
    // Fase 5: integrar con OpenAI embeddings o modelo local
    this.logger.log('Embedding service placeholder - Fase 5');
    return new Array(1536).fill(0);
  }
}
```

---

## Checklist Fase 3

- [ ] 3.1 `src/db/schema/evaluations.ts` con tabla `evaluations` + pgvector
- [ ] 3.1 `src/db/schema/extracted-pdfs.ts` con tabla `extracted_pdfs`
- [ ] 3.1 `drizzle.config.ts` configurado
- [ ] 3.1 Migración SQL ejecutada en PostgreSQL con pgvector
- [ ] 3.2 `IEvaluationRepository` interface definida
- [ ] 3.2 `DrizzleEvaluationRepository` implementado con `save`, `findByJobId`, `findByS3Key`, `findRecent`
- [ ] 3.2 Repository registrado en module como `EVALUATION_REPOSITORY`
- [ ] 3.3 `AiRecruiterConsumer.process()` persiste resultado en repository después de `execute()`
- [ ] 3.3 ELIMINADO: `onCompleted` side effect para persistir (todo es transaccional en `process()`)
- [ ] 3.4 `GET /recruiter/status/:jobId` lee de BD primero, fallback a colas
- [ ] 3.4 Status retorna `{ jobId, status, result }` o `{ jobId, status, message, source }`

---

## Test Manual Fase 3

```bash
# 1. Encolar evaluación (Fase 1)
curl -X POST http://localhost:3000/recruiter/evaluate \
  -H "Content-Type: application/json" \
  -d '{"s3Key":"cvs/uuid.pdf","jobDescription":"Senior Fullstack Developer...","jobTitle":"Senior Developer"}'
# Response: { jobId: "eval-xyz", status: "queued" }

# 2. Esperar a que procese (revisar logs del worker)

# 3. Consultar estado
curl http://localhost:3000/recruiter/status/eval-xyz
# Response:
# {
#   "jobId": "eval-xyz",
#   "status": "completed",
#   "result": {
#     "jobId": "eval-xyz",
#     "s3Key": "cvs/uuid.pdf",
#     "scores": { "overall": 82, "skills": 85, "experience": 75, "education": 90 },
#     "recommendation": { "decision": "ADVANCE", "confidence": 80, "reasoning": "..." },
#     "match": { ... },
#     "output": { "interviewQuestions": [...], "feedbackForCandidate": "...", ... },
#     "meta": { "step": "complete", ... },
#     "createdAt": "...",
#     "updatedAt": "..."
#   }
# }
```

---

## Estructura de Archivos Fase 3

```
src/
├── db/
│   ├── schema/
│   │   ├── evaluations.ts          ← NUEVO
│   │   └── extracted-pdfs.ts       ← NUEVO
│   └── drizzle.config.ts           ← NUEVO
├── modules/
│   └── recruiter/
│       ├── interfaces/
│       │   ├── evaluation.repository.interface.ts   ← NUEVO
│       │   └── evaluation-graph.interface.ts        ← Fase 0
│       ├── repositories/
│       │   └── drizzle-evaluation.repository.ts     ← NUEVO
│       ├── queues/
│       │   └── ai-recruiter/
│       │       └── ai-recruiter.consumer.ts         ← MODIFICAR (persist)
│       └── controllers/
│           └── recruiter.controller.ts              ← MODIFICAR (status)
```

**Solo después de completar TODO lo anterior → Fase 4**