export interface LlmProvider {
  generateText(prompt: string, options?: LlmOptions): Promise<LlmResponse>;
  generateStructured<T>(prompt: string, schema: any, options?: LlmOptions): Promise<T>;
}

export interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LlmResponse {
  content: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  provider?: string;
}
