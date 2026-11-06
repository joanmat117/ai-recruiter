# Fase 4: Limpieza y Consolidación

> **Requisito:** Fases 0, 1, 2 y 3 completadas. Pipeline async funcional con persistencia en BD.

---

## 4.1 Eliminar Código Muerto (Sync Path)

### Archivos a Eliminar o Vaciar

| Archivo | Acción | Razón |
|---------|--------|-------|
| `src/modules/recruiter/nodes/parser.node.ts` | Eliminar | Ya no existe el nodo parser (cvText viene extraído del queue) |
| `src/modules/recruiter/graph/recruiter.graph.ts` | Modificar | Remover import de parserNode, usar factory `createEvaluationGraph` |
| `src/modules/recruiter/state/recruiter.state.ts` | Modificar | Remover `cvBuffer` de annotations, alinear `meta.step` |
| `src/modules/recruiter/controllers/recruiter.controller.ts` | Modificar | Remover `multer`/`FileInterceptor`/`FilesInterceptor`, body multipart |
| `src/modules/recruiter/services/recruiter.service.ts` | Modificar | Remover `evaluateBatch`, `jobStatuses` Map, `reEvaluate`, `compareCandidates` placeholders |
| `src/modules/recruiter/controllers/recruiter.controller.ts` | Modificar | Remover endpoints placeholder: `/interview-questions`, `/feedback`, `/compare` |

### Código a Borrar

**`recruiter.service.ts`** — Eliminar:
- Método `evaluateBatch()` (buggy, usa cvBuffer como string)
- Propiedad `jobStatuses` Map (inexistente, era de versión anterior)
- Método `reEvaluate()`
- Método `compareCandidates()`
- Método `getJobStatus()` (se mueve al controller con repository)
- Método `generateJobId()` (se mueve al controller)

**`recruiter.controller.ts`** — Eliminar:
- `FilesInterceptor` / `multer` imports
- Endpoint `POST /evaluate-batch`
- Endpoint `POST /interview-questions` (placeholder)
- Endpoint `POST /feedback` (placeholder)
- Endpoint `POST /compare` (placeholder)

**DTOs a actualizar:**
- `evaluate-candidate.dto.ts` — Ya no necesita `cvBuffer` ni multipart fields

---

## 4.2 DTOs Alineados al Flujo Async

### `src/common/dto/evaluate-candidate.dto.ts`
```typescript
import { IsString, IsOptional, Validate } from 'class-validator';
import { EvaluationRequest } from '../../modules/recruiter/value-objects/evaluation-request.vo';
import { S3KeyValidator } from '../../modules/recruiter/validators/s3-key.validator';
import { JobDescriptionValidator } from '../../modules/recruiter/validators/job-description.validator';

export class EvaluateCandidateDto {
  @IsString()
  @Validate(S3KeyValidator)
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

### Validators Custom
**`src/modules/recruiter/validators/s3-key.validator.ts`**
```typescript
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { S3Key } from '../value-objects/evaluation-request.vo';

export function S3KeyValidator(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'S3KeyValidator',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any): boolean {
          try {
            S3Key.from(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `S3Key inválido: ${args.value}. Formato esperado: cvs/<uuid>.pdf`;
        },
      },
    });
  };
}
```

**`src/modules/recruiter/validators/job-description.validator.ts`**
```typescript
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { JobDescription } from '../value-objects/evaluation-request.vo';

export function JobDescriptionValidator(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'JobDescriptionValidator',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any): boolean {
          try {
            JobDescription.from(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return 'JobDescription debe tener al menos 50 caracteres';
        },
      },
    });
  };
}
```

---

## 4.3 Tests E2E del Flujo Completo

### Archivo Nuevo
**`test/e2e/recruiter-flow.e2e.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { RecruiterModule } from '../../../src/modules/recruiter/recruiter.module';
import { Queue } from 'bullmq';

describe('Recruiter Flow E2E', () => {
  let app: INestApplication;
  let pdfQueue: Queue;
  let aiQueue: Queue;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RecruiterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    pdfQueue = new Queue('pdf-extraction-queue');
    aiQueue = new Queue('ai-recruiter-queue');
  });

  afterAll(async () => {
    await pdfQueue.close();
    await aiQueue.close();
    await app.close();
  });

  it('debe procesar flujo completo: presigned → enqueue → worker → graph → db → status', async () => {
    // 1. Obtener presigned POST
    const presignedRes = await app.inject().post('/recruiter/upload/presigned').json({
      filename: 'test-cv.pdf',
      contentType: 'application/pdf',
    });
    expect(presignedRes.statusCode).toBe(200);
    const { url, fields, key } = presignedRes.body;

    // 2. Subir PDF directo a S3 (mock o real)
    // await s3Upload(url, fields, './test-data/sample-cv.pdf');

    // 3. Encolar evaluación
    const evaluateRes = await app.inject().post('/recruiter/evaluate').json({
      s3Key: key,
      jobDescription: 'Buscamos Senior Fullstack Developer con 5+ años en React, Node.js, TypeScript, AWS, Docker. Valorable: Kubernetes, GraphQL.',
      jobTitle: 'Senior Fullstack Developer',
    });
    expect(evaluateRes.statusCode).toBe(200);
    const { jobId, status } = evaluateRes.body;
    expect(status).toBe('queued');

    // 4. Esperar a que procese (con timeout)
    let statusRes;
    let attempts = 0;
    do {
      await new Promise(r => setTimeout(r, 2000));
      statusRes = await app.inject().get(`/recruiter/status/${jobId}`).json();
      attempts++;
    } while (statusRes.statusCode === 200 && statusRes.body.status !== 'completed' && attempts < 30);

    // 5. Verificar resultado
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.body.status).toBe('completed');
    expect(statusRes.body.result.recommendation.decision).toMatch(/^(ADVANCE|REVIEW|REJECT)$/);
    expect(statusRes.body.result.scores.overall).toBeGreaterThanOrEqual(0);
    expect(statusRes.body.result.scores.overall).toBeLessThanOrEqual(100);
    expect(Array.isArray(statusRes.body.result.output.interviewQuestions)).toBe(true);
  });
});
```

---

## 4.4 Checklist Fase 4

- [ ] 4.1 Eliminar `parserNode` y archivos relacionados
- [ ] 4.1 Eliminar `cvBuffer` de `RecruiterInputAnnotation` y `RecruiterStateAnnotation`
- [ ] 4.1 Eliminar `multer` / `FileInterceptor` / `FilesInterceptor` de controller
- [ ] 4.1 Eliminar `evaluateBatch`, `jobStatuses`, `reEvaluate`, `compareCandidates`, `getJobStatus`, `generateJobId` de service
- [ ] 4.1 Eliminar endpoints placeholder: `/interview-questions`, `/feedback`, `/compare`
- [ ] 4.2 `EvaluateCandidateDto` alineado con Value Objects + validators custom
- [ ] 4.3 Tests E2E pasan: presigned → enqueue → worker → graph → db → status
- [ ] 4.4 `npm run build` sin errores
- [ ] 4.4 `npm run test:e2e` sin errores

---

## Estructura Final del Proyecto (Después de Fase 4)

```
src/
├── db/
│   ├── schema/
│   │   ├── evaluations.ts
│   │   └── extracted-pdfs.ts
│   └── drizzle.config.ts
├── modules/
│   └── recruiter/
│       ├── controllers/
│       │   ├── recruiter.controller.ts      (evaluate, status)
│       │   └── upload.controller.ts         (presigned POST)
│       ├── use-cases/
│       │   └── evaluate-candidate.use-case.ts
│       ├── policies/
│       │   └── scoring.policy.ts
│       ├── interfaces/
│       │   ├── evaluation-graph.interface.ts
│       │   └── evaluation.repository.interface.ts
│       ├── repositories/
│       │   └── drizzle-evaluation.repository.ts
│       ├── queues/
│       │   ├── pdf/
│       │   │   └── pdf.consumer.ts
│       │   └── ai-recruiter/
│       │       └── ai-recruiter.consumer.ts
│       ├── nodes/
│       │   ├── analyzer.node.ts
│       │   ├── matcher.node.ts
│       │   ├── scorer.node.ts
│       │   └── feedback.node.ts
│       ├── llm/
│       │   └── structured-llm-calls.ts
│       ├── graph/
│       │   ├── recruiter.graph.ts           (createEvaluationGraph factory)
│       │   └── node-error-handler.ts
│       ├── state/
│       │   └── recruiter.state.ts
│       ├── tools/
│       │   ├── pdf-extractor.tool.ts
│       │   └── job-matcher.tool.ts
│       ├── value-objects/
│       │   └── evaluation-request.vo.ts
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
        └── llm.module.ts
```

---

## Estimación Total del Proyecto

| Fase | Sesiones | Riesgo | Estado |
|------|----------|--------|--------|
| **Fase 0** | 2-3 | Bajo | Setup arquitectónico |
| **Fase 1** | 2-3 | Bajo | Pipeline PDF async |
| **Fase 2** | 3-4 | Medio | Graph real + workers |
| **Fase 3** | 2-3 | Medio | Drizzle + pgvector + Status |
| **Fase 4** | 1-2 | Bajo | Limpieza + Tests E2E |
| **TOTAL** | **10-15 sesiones** | | |

**Próxima acción:** Comenzar con Fase 0 (setup arquitectónico).