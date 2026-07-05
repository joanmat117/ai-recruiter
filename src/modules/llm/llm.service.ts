import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProviderFactory } from './llm-provider.factory';
import { LlmProvider, LlmOptions, LlmResponse } from './interfaces/llm.interface';
import { LlmProviderException } from './exceptions/llm.exception';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly providers: Map<string, LlmProvider> = new Map();
  private readonly fallbackOrder = ['openai', 'openrouter', 'gemini'];
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly factory: LlmProviderFactory,
  ) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const configuredProvider = this.configService.get<string>('llm.provider', 'openai');
    try {
      const provider = this.factory.createProvider(configuredProvider);
      this.providers.set(configuredProvider, provider);
      this.logger.log(`Initialized primary LLM provider: ${configuredProvider}`);
    } catch (error) {
      this.logger.warn(`Failed to initialize primary provider ${configuredProvider}: ${error.message}`);
    }
  }

  async generateText(prompt: string, options?: LlmOptions): Promise<LlmResponse> {
    const primaryProvider = this.configService.get<string>('llm.provider', 'openai');
    return this.executeWithFallback(primaryProvider, 'generateText', prompt, options);
  }

  async generateStructured<T>(prompt: string, schema: any, options?: LlmOptions): Promise<T> {
    const primaryProvider = this.configService.get<string>('llm.provider', 'openai');
    return this.executeWithFallback(primaryProvider, 'generateStructured', prompt, schema, options) as Promise<T>;
  }

  private async executeWithFallback<T>(
    providerName: string,
    method: string,
    ...args: any[]
  ): Promise<T> {
    const providersToTry = this.getFallbackChain(providerName);

    for (const provider of providersToTry) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const llmProvider = this.getProvider(provider);
          const result = await (llmProvider as any)[method](...args);
          return result;
        } catch (error) {
          this.logger.warn(
            `Provider ${provider} attempt ${attempt}/${this.maxRetries} failed: ${error.message}`,
          );
          if (attempt < this.maxRetries) {
            await this.delay(this.baseDelay * Math.pow(2, attempt - 1));
          }
        }
      }
    }

    throw new LlmProviderException(
      providerName,
      `All providers failed after ${this.maxRetries} retries each`,
    );
  }

  private getFallbackChain(primary: string): string[] {
    const chain = [primary];
    for (const provider of this.fallbackOrder) {
      if (!chain.includes(provider)) {
        chain.push(provider);
      }
    }
    return chain;
  }

  private getProvider(name: string): LlmProvider {
    if (!this.providers.has(name)) {
      const provider = this.factory.createProvider(name);
      this.providers.set(name, provider);
    }
    return this.providers.get(name)!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
