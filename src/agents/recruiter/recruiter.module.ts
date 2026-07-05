import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { LlmModule } from '../../modules/llm/llm.module';
import { PdfExtractorTool } from './tools/pdf-extractor.tool';
import { SkillExtractorTool } from './tools/skill-extractor.tool';
import { JobMatcherTool } from './tools/job-matcher.tool';
import { LlmProviderTool } from './tools/llm-provider.tool';

@Module({
  imports: [CommonModule, LlmModule],
  providers: [PdfExtractorTool, SkillExtractorTool, JobMatcherTool, LlmProviderTool],
  exports: [PdfExtractorTool, SkillExtractorTool, JobMatcherTool, LlmProviderTool],
})
export class RecruiterModule {}
