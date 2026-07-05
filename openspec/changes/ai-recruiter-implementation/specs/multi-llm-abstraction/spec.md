# Multi-LLM Abstraction Specification

## Purpose

Factory-based abstraction layer supporting multiple LLM providers (OpenAI, OpenRouter, Gemini) with automatic fallback, rate limiting, and retry logic.

## Requirements

### Requirement: Provider Factory Pattern

The system SHALL implement a factory pattern that creates the correct LLM provider instance based on the `LLM_PROVIDER` environment variable. Supported values: `openai`, `openrouter`, `gemini`.

#### Scenario: OpenAI provider selected

- GIVEN `LLM_PROVIDER=openai` and `OPENAI_API_KEY` is set
- WHEN the LLM service is instantiated
- THEN it creates an OpenAI provider instance

#### Scenario: OpenRouter provider selected

- GIVEN `LLM_PROVIDER=openrouter` and `OPENROUTER_API_KEY` is set
- WHEN the LLM service is instantiated
- THEN it creates an OpenRouter provider instance

#### Scenario: Gemini provider selected

- GIVEN `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` is set
- WHEN the LLM service is instantiated
- THEN it creates a Gemini provider instance

#### Scenario: Unknown provider

- GIVEN `LLM_PROVIDER=unknown`
- WHEN the LLM service is instantiated
- THEN it throws an error listing supported providers

### Requirement: Automatic Fallback

The system SHALL attempt the primary provider first, then fall back to alternative providers in order (OpenAI → OpenRouter → Gemini) when the primary fails.

#### Scenario: Primary provider fails, fallback succeeds

- GIVEN `LLM_PROVIDER=openai` and OpenAI API returns 500
- WHEN the system calls `generateText()`
- THEN it retries with OpenRouter
- AND returns the successful response

#### Scenario: All providers fail

- GIVEN all three LLM providers return errors
- WHEN the system calls `generateText()`
- THEN it throws an error with message "All LLM providers failed"

### Requirement: Rate Limiting

The system SHALL enforce per-provider rate limiting to prevent API quota exhaustion.

#### Scenario: Rate limit not exceeded

- GIVEN the provider has remaining quota
- WHEN `generateText()` is called
- THEN the request proceeds normally

#### Scenario: Rate limit exceeded

- GIVEN the provider's rate limit is reached
- WHEN `generateText()` is called immediately
- THEN the system waits and retries after the rate limit window resets

### Requirement: Retry with Exponential Backoff

The system SHALL retry failed requests using exponential backoff with jitter. Maximum retries: 3. Base delay: 1 second.

#### Scenario: Retry succeeds on second attempt

- GIVEN the provider returns a transient error (429 or 503)
- WHEN the system retries
- THEN it waits approximately 1s, then retries
- AND returns the successful response

#### Scenario: Retry exhausted

- GIVEN the provider returns transient errors 3 times
- WHEN retries are exhausted
- THEN the system throws a `LlmProviderException` with attempt count

### Requirement: Environment-Based Configuration

The system SHALL load provider configuration from environment variables using `@nestjs/config`. Required variables: `LLM_PROVIDER`, provider-specific API keys.

#### Scenario: Missing required variable

- GIVEN `LLM_PROVIDER` is not set
- WHEN the config module validates
- THEN it throws a clear error identifying the missing variable

#### Scenario: All variables present

- GIVEN all required environment variables are set
- WHEN the config module loads
- THEN it exposes validated configuration through `LlmConfigService`
