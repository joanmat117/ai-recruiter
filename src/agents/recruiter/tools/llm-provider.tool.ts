import { Injectable } from '@nestjs/common';
import { LlmService } from '../../../modules/llm/llm.service';

@Injectable()
export class LlmProviderTool {
  constructor(private readonly llmService: LlmService) {}

  async generateText(prompt: string): Promise<string> {
    const response = await this.llmService.generateText(prompt);
    return response.content;
  }

  async generateStructured<T>(prompt: string, schema: any): Promise<T> {
    return this.llmService.generateStructured<T>(prompt, schema);
  }
}
