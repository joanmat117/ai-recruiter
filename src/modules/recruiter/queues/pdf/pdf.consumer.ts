import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PDF_JOBS, AI_RECRUITER_JOBS, QUEUE_NAMES } from '../../constants/job-names';
import { PdfExtractorTool } from '../../tools/pdf-extractor.tool';
import { Inject, Logger } from '@nestjs/common';
import type { IExtractedPdfRepository } from '../../interfaces/extracted-pdf.repository.interface';
import { EXTRACTED_PDF_REPOSITORY } from '../../interfaces/extracted-pdf.repository.interface';
import type { IFileStorage } from '../../interfaces/file-storage.interface';
import { FILE_STORAGE } from '../../interfaces/file-storage.interface';

export type PdfJob = Job<{
  s3Key: string;
  presignedUrl: string;
  jobDescription: string;
  jobTitle?: string;
}, {
  text: string;
  s3Key: string;
  jobDescription: string;
  jobTitle?: string;
  nextJob?: { name: string; data: any }; // Para job chaining nativo (A4)
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

  // ELIMINADO onCompleted side effect - el chaining es transaccional
  // Si process() falla, job va a failed state con retry policy configurado en module
}