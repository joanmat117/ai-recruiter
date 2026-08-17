import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LlmModule } from '../../modules/llm/llm.module';
import { PdfExtractorTool } from './tools/pdf-extractor.tool';
import { JobMatcherTool } from './tools/job-matcher.tool';
import { RecruiterService } from './services/recruiter.service';
import { RecruiterController } from './controllers/recruiter.controller';
import { BullModule } from '@nestjs/bullmq';
import { RecruiterQueues } from './queues/recruiter-queues.enum';

@Module({
  imports: [
    CommonModule,
    LlmModule,
    BullModule.registerQueue({
      name: RecruiterQueues.PDF_EXTRACTION,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: {
          count: 5
        },
      }
    })
  ],
  providers: [RecruiterService],
  exports: [JobMatcherTool, PdfExtractorTool],
  controllers: [RecruiterController],
})
export class RecruiterModule { }
