import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProviderException } from './exceptions/llm.exception';
import { LlmProviders } from 'src/common/enums/llm-provider.enum';
import { ChatOpenAI } from "@langchain/openai"
import { ChatOpenRouter } from "@langchain/openrouter"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

@Injectable()
export class LlmProviderFactory {
  constructor(private readonly configService: ConfigService) { }

  createProvider(providerName: string) {
    switch (providerName) {
      case LlmProviders.OPENAI:
        return this.createOpenAiProvider();
      case LlmProviders.OPENROUTER:
        return this.createOpenRouterProvider();
      case LlmProviders.GEMINI:
        return this.createGeminiProvider();
      default:
        throw new LlmProviderException(providerName, 'Unknown provider');
    }
  }

  private createOpenAiProvider(): BaseChatModel {
    return new ChatOpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o'
    })
  }

  private createOpenRouterProvider(): BaseChatModel {
    return new ChatOpenRouter({
      apiKey: this.configService.get<string>('OPENROUTER_API_KEY'),
      model: this.configService.get<string>('OPENROUTER_MODEL') || 'gpt-4o-mini'
    })
  }

  private createGeminiProvider(): BaseChatModel {
    return new ChatGoogleGenerativeAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      model: this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-turbo'
    })

  }
}
