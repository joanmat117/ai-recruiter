import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EvaluationRequest } from '../value-objects/evaluation-request.vo';
import { PDF_JOBS, QUEUE_NAMES } from '../constants/job-names';
import { randomUUID } from 'crypto';
import type { IFileStorage } from '../interfaces/file-storage.interface';
import { FILE_STORAGE } from '../interfaces/file-storage.interface';
import { getQueueToken } from '@nestjs/bullmq';
import { EvaluateCandidateDto } from '../../../common/dto/evaluate-candidate.dto';
import type { IEvaluationRepository } from '../interfaces/evaluation.repository.interface';
import { EVALUATION_REPOSITORY } from '../interfaces/evaluation.repository.interface';

@Controller('recruiter')
export class RecruiterController {
  constructor(
    @Inject(getQueueToken(QUEUE_NAMES.PDF_EXTRACTION)) private readonly pdfQueue: Queue,
    @Inject(getQueueToken(QUEUE_NAMES.AI_RECRUITER)) private readonly aiRecruiterQueue: Queue,
    @Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage,
    @Inject(EVALUATION_REPOSITORY) private readonly evaluationRepository: IEvaluationRepository,
  ) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.CREATED)
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