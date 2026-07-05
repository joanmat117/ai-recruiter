import { HttpException, HttpStatus } from '@nestjs/common';

export class LlmProviderException extends HttpException {
  constructor(provider: string, message: string) {
    super(`LLM Provider ${provider} error: ${message}`, HttpStatus.BAD_GATEWAY);
  }
}

export class LlmParsingException extends HttpException {
  constructor(message: string) {
    super(`LLM Parsing error: ${message}`, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
