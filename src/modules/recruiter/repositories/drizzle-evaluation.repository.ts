import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc } from 'drizzle-orm';
import * as evaluationsSchema from '../../../db/schema/evaluations';
import { IEvaluationRepository, EvaluationInput, EvaluationOutput } from '../interfaces/evaluation.repository.interface';
import { RecruiterOutput } from '../state/recruiter.state';

@Injectable()
export class DrizzleEvaluationRepository implements IEvaluationRepository {
  private readonly logger = new Logger(DrizzleEvaluationRepository.name);
  private db: PostgresJsDatabase<typeof evaluationsSchema>;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const sql = postgres(this.configService.getOrThrow('DATABASE_URL'));
    this.db = drizzle(sql, { schema: evaluationsSchema });
  }

  async save(input: EvaluationInput): Promise<EvaluationOutput> {
    try {
      const [record] = await this.db
        .insert(evaluationsSchema.evaluations)
        .values({
          jobId: input.jobId,
          s3Key: input.s3Key,
          cvText: input.cvText,
          jobDescription: input.jobDescription,
          jobTitle: input.jobTitle,
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
      .from(evaluationsSchema.evaluations)
      .where(eq(evaluationsSchema.evaluations.jobId, jobId));

    return record ? this.mapRecord(record) : null;
  }

  async findByS3Key(s3Key: string): Promise<EvaluationOutput | null> {
    const [record] = await this.db
      .select()
      .from(evaluationsSchema.evaluations)
      .where(eq(evaluationsSchema.evaluations.s3Key, s3Key));

    return record ? this.mapRecord(record) : null;
  }

  async findRecent(limit: number = 50): Promise<EvaluationOutput[]> {
    const records = await this.db
      .select()
      .from(evaluationsSchema.evaluations)
      .orderBy(desc(evaluationsSchema.evaluations.createdAt))
      .limit(limit);

    return records.map(r => this.mapRecord(r));
  }

  private mapRecord(record: evaluationsSchema.Evaluation): EvaluationOutput {
    return {
      id: record.id,
      jobId: record.jobId,
      s3Key: record.s3Key,
      cvText: record.cvText,
      jobDescription: record.jobDescription,
      jobTitle: record.jobTitle ?? undefined,
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