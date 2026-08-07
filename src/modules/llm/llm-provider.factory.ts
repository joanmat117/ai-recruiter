import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProviderException } from './exceptions/llm.exception';
import { LlmProviders } from 'src/common/enums/llm-provider.enum';
import { ChatOpenAI } from "@langchain/openai"
import { ChatOpenRouter } from "@langchain/openrouter"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

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

  private createOpenAiProvider() {
    // Will use @langchain/openai ChatOpenAI
  }

  private createOpenRouterProvider() {
    // Will use OpenRouter-compatible API
    return ChatOpenRouter
  }

  private createGeminiProvider() {

  }
}
