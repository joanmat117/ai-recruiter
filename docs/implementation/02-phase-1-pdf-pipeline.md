# Fase 1: Completar Pipeline PDF → S3 → Queue → Worker (Base Async)

> **Requisito:** Fase 0 completada (arquitectura, ports, use cases, policies, strategies, value objects, constants, error handling)

---

## 1.1 S3 Presigned POST Endpoint

### Archivo Nuevo
**`src/modules/recruiter/controllers/upload.controller.ts`**

```typescript
import { Controller, Post, Body, BadRequestException, Inject } from '@nestjs/common';
import { FILE_STORAGE } from '../interfaces/file-storage.interface';
import { IFileStorage } from '../interfaces/file-storage.interface';
import { randomUUID } from 'crypto';

@Controller('recruiter')
export class UploadController {
  constructor(@Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage) {}

  @Post('upload/presigned')
  async getPresignedPost(
    @Body('filename') filename: string,
    @Body('contentType') contentType: string,
  ) {
    if (contentType !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }
    const key = `cvs/${randomUUID()}.pdf`;
    const presigned = await this.fileStorage.getPresignedPOST(key, { expirySeconds: 3600 });
    return { url: presigned.url, fields: presigned.fields, key, expiresIn: 3600 };
  }
}
```

### Registrar en Module
```typescript
// src/modules/recruiter/recruiter.module.ts - controllers array:
controllers: [RecruiterController, UploadController],
```

---

## 1.2 Producer: Encolar Job PDF desde Controller

### Modificar
**`src/modules/recruiter/controllers/recruiter.controller.ts`**

```typescript
import { Controller, Post, Body, Inject, BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EvaluationRequest } from '../value-objects/evaluation-request.vo';
import { PDF_JOBS, QUEUE_NAMES } from '../constants/job-names';
import { randomUUID } from 'crypto';
import { IFileStorage } from '../interfaces/file-storage.interface';
import { FILE_STORAGE } from '../interfaces/file-storage.interface';
import { getQueueToken } from '@nestjs/bullmq';

@Controller('recruiter')
export class RecruiterController {
  constructor(
    @Inject(getQueueToken(QUEUE_NAMES.PDF_EXTRACTION)) private readonly pdfQueue: Queue,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
  ) {}

  @Post('evaluate')
  async evaluateCandidate(@Body() dto: EvaluateCandidateDto) {
    // Value Object valida invariantes (A5)
    const request = dto.toRequest();
    
    // Verifica que el archivo existe en S3
    const exists = await this.fileStorage.fileExists(request.s3Key.value);
    if (!exists) {
      throw new BadRequestException(`File not found in S3: ${request.s3Key.value}`);
    }
    
    // Genera presigned GET para el worker (expira en 2h)
    const presignedGet = await this.fileStorage.getPresignedGET(request.s3Key.value, { expirySeconds: 7200 });
    
    const jobId = `eval-${randomUUID()}`;
    await this.pdfQueue.add(PDF_JOBS.EXTRACT_PDF, {
      s3Key: request.s3Key.value,
      presignedUrl: presignedGet.url,
      jobDescription: request.jobDescription.value,
      jobTitle: request.jobTitle.value,
    }, { jobId });
    
    return { jobId, status: 'queued', message: 'PDF encolado para procesamiento' };
  }
}
```

**Cambio crítico:** Body NO es multipart. Es JSON `{ s3Key, jobDescription, jobTitle? }`. Validación via Value Objects (A5).

---

## 1.3 PdfConsumer: Descargar de S3 + Transactional Outbox (Job Chaining)

### Modificar
**`src/modules/recruiter/queues/pdf/pdf.consumer.ts`**

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PDF_JOBS, AI_RECRUITER_JOBS, QUEUE_NAMES } from '../../constants/job-names';
import { PdfExtractorTool } from '../../tools/pdf-extractor.tool';
import { Inject, Logger } from '@nestjs/common';
import { EXTRACTED_PDF_REPOSITORY, IExtractedPdfRepository } from '../../interfaces/extracted-pdf.repository.interface';
import { IFileStorage, FILE_STORAGE } from '../../interfaces/file-storage.interface';

export type PdfJob = Job<{ 
  s3Key: string; 
  presignedUrl: string; 
  jobDescription: string; 
  jobTitle?: string 
}, { 
  text: string; 
  s3Key: string; 
  jobDescription: string; 
  jobTitle?: string;
  nextJob?: { name: string; data: any }  // Para job chaining nativo (A4)
}>;

@Processor(QUEUE_NAMES.PDF_EXTRACTION)
export class PdfConsumer extends WorkerHost {
  private readonly logger = new Logger(PdfConsumer.name);

  constructor(
    private readonly pdfExtractorTool: PdfExtractorTool,
    @Inject(EXTRACTED_PDF_REPOSITORY) private readonly extractedPdfRepository: IExtractedPdfRepository,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
    // NO inyectar aiRecruiterQueue directamente - usa job chaining
  ) {
    super();
  }

  async process(job: PdfJob) {
    this.logger.log(`Procesando PDF: ${job.data.s3Key}`);
    
    // Descargar via S3 adapter (sin expiry, más control)
    const buffer = await this.fileStorage.downloadFile(job.data.s3Key);
    
    const result = await this.pdfExtractorTool.extractText(buffer);
    
    // Retorna resultado + nextJob para BullMQ Job Chaining nativo (A4)
    // Si process() retorna nextJob, BullMQ lo encola atómicamente en la misma transacción
    return {
      text: result.text,
      s3Key: job.data.s3Key,
      jobDescription: job.data.jobDescription,
      jobTitle: job.data.jobTitle,
      nextJob: {
        name: AI_RECRUITER_JOBS.EVALUATE_CANDIDATE,
        data: {
          cvText: result.text,
          jobDescription: job.data.jobDescription,
          jobTitle: job.data.jobTitle,
          sourceS3Key: job.data.s3Key,
        },
      },
    };
  }

  // ELIMINAR onCompleted side effect - el chaining es transaccional
  // Si process() falla, job va a failed state con retry policy configurado en module
}
```

**Cambios clave (A4):**
- Inyecta `FILE_STORAGE` (S3 adapter) en lugar de `fetch`
- Retorna `nextJob` para **BullMQ Job Chaining nativo** (atomicidad queue→queue)
- Elimina `onCompleted` side effect — el chaining es transaccional

---

## 1.4 Declarar AI Recruiter Queue en Module

### Modificar
**`src/modules/recruiter/recruiter.module.ts`**

```typescript
import { QUEUE_NAMES } from './constants/job-names';
import { BullModule } from '@nestjs/bullmq';

// En imports array:
BullModule.registerQueue({
  name: QUEUE_NAMES.PDF_EXTRACTION,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: { count: 5 },
  },
}),
BullModule.registerQueue({
  name: QUEUE_NAMES.AI_RECRUITER,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: { count: 3 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  },
}),

// Providers para inyección de queues (ya no necesitan string tokens manuales)
// getQueueToken(QUEUE_NAMES.XXX) se usa en controllers/consumers
```

---

## Checklist Fase 1

- [ ] 1.1 `UploadController` con `POST /recruiter/upload/presigned`
- [ ] 1.1 Registrar `UploadController` en module
- [ ] 1.2 `RecruiterController.evaluateCandidate` usa `EvaluateCandidateDto.toRequest()` (Value Objects)
- [ ] 1.2 Valida `fileExists` en S3 antes de encolar
- [ ] 1.2 Genera `presignedGet` para worker
- [ ] 1.2 Encola job con `jobId` único (`eval-${uuid}`)
- [ ] 1.3 `PdfConsumer` inyecta `FILE_STORAGE` (S3 adapter)
- [ ] 1.3 `process()` usa `fileStorage.downloadFile(s3Key)` 
- [ ] 1.3 `process()` retorna `nextJob` para job chaining nativo (A4)
- [ ] 1.3 ELIMINADO `onCompleted` side effect
- [ ] 1.4 Segunda queue `AI_RECRUITER` registrada en module con retry/backoff
- [ ] 1.4 Constants `QUEUE_NAMES`, `PDF_JOBS`, `AI_RECRUITER_JOBS` usados en todo lado (A8)

---

## Test Manual Fase 1

```bash
# 1. Obtener presigned POST
curl -X POST http://localhost:3000/recruiter/upload/presigned \
  -H "Content-Type: application/json" \
  -d '{"filename":"cv.pdf","contentType":"application/pdf"}'
# Response: { url, fields, key, expiresIn }

# 2. Subir PDF directo a S3 (desde cliente)
curl -X POST "$url" \
  -F "key=$key" \
  -F "policy=$policy" \
  -F "x-amz-signature=$signature" \
  -F "x-amz-credential=$credential" \
  -F "x-amz-algorithm=AWS4-HMAC-SHA256" \
  -F "x-amz-date=$date" \
  -F "file=@./test-cv.pdf"

# 3. Encolar evaluación
curl -X POST http://localhost:3000/recruiter/evaluate \
  -H "Content-Type: application/json" \
  -d '{"s3Key":"cvs/uuid.pdf","jobDescription":"Buscamos Senior Developer con 5+ años en React, Node, AWS...","jobTitle":"Senior Developer"}'
# Response: { jobId, status: "queued", message: "PDF encolado para procesamiento" }

# 4. Verificar en BullMQ dashboard / logs que:
#    - pdf-extraction-queue tiene job
#    - Worker procesa, extrae texto
#    - ai-recruiter-queue recibe job chained automáticamente
```