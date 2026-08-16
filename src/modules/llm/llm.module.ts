import { Module } from '@nestjs/common';
import { LlmProviderFactory } from './llm-provider.factory';

@Module({
  providers: [LlmProviderFactory],
  exports: [LlmProviderFactory],
})
export class LlmModule { }
