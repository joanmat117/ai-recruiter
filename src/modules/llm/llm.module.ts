import { Module } from '@nestjs/common';
import { LlmProviderFactory } from './llm-provider.factory';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

@Module({
  providers: [
    LlmProviderFactory,
    {
      provide: 'LLM_PROVIDER',
      useFactory: (factory: LlmProviderFactory, config: ConfigService) =>
        factory.createProvider(config.get('LLM_PROVIDER') || 'openai'),
      inject: [LlmProviderFactory, ConfigService],
    },
  ],
  exports: [LlmProviderFactory, 'LLM_PROVIDER'],
})
export class LlmModule {}