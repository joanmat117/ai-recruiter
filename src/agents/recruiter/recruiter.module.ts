import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LlmModule } from '../../modules/llm/llm.module';
import { PdfExtractorTool } from './tools/pdf-extractor.tool';
import { SkillExtractorTool } from './tools/skill-extractor.tool';
import { JobMatcherTool } from './tools/job-matcher.tool';
import { RecruiterService } from './services/recruiter.service';
import { RecruiterController } from './controllers/recruiter.controller';

@Module({
  imports: [CommonModule, LlmModule],
  providers: [PdfExtractorTool, SkillExtractorTool, JobMatcherTool, RecruiterService],
  exports: [PdfExtractorTool, SkillExtractorTool, JobMatcherTool],
  controllers: [RecruiterController],
})
export class RecruiterModule { }
