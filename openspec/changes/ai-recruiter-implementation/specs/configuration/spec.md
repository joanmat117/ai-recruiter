# Configuration Specification

## Purpose

Centralized configuration management using `@nestjs/config` for environment variables, LLM provider settings, ChromaDB connection, and application parameters.

## Requirements

### Requirement: Environment Variable Loading

The system SHALL load configuration from environment variables and `.env` file using `ConfigModule.forRoot()` with `isGlobal: true`. All modules MUST access config through `ConfigService`.

#### Scenario: .env file present

- GIVEN a `.env` file with `PORT=3001`, `LLM_PROVIDER=openai`
- WHEN the application starts
- THEN `ConfigService.get('PORT')` returns `3001`
- AND `ConfigService.get('LLM_PROVIDER')` returns `openai`

#### Scenario: Environment variable override

- GIVEN `.env` has `PORT=3001` and env var `PORT=4000` is set
- WHEN the application starts
- THEN `ConfigService.get('PORT')` returns `4000` (env var wins)

### Requirement: LLM Provider Configuration

The system SHALL validate and expose LLM configuration through a typed `LlmConfig` interface: `provider`, `apiKey`, `model`, `temperature`, `maxTokens`.

#### Scenario: OpenAI configuration

- GIVEN env vars `LLM_PROVIDER=openai`, `OPENAI_API_KEY=sk-...`, `LLM_MODEL=gpt-4`
- WHEN `LlmConfigService` loads
- THEN it returns `{ provider: "openai", apiKey: "sk-...", model: "gpt-4", temperature: 0.7, maxTokens: 2000 }`

#### Scenario: Default values applied

- GIVEN `LLM_TEMPERATURE` is not set
- WHEN `LlmConfigService` loads
- THEN temperature defaults to `0.7`

### Requirement: ChromaDB Connection Configuration

The system SHALL configure ChromaDB connection through environment variables: `CHROMADB_URL`, `CHROMADB_COLLECTION_PREFIX`.

#### Scenario: Custom ChromaDB URL

- GIVEN `CHROMADB_URL=http://chromadb:8000`
- WHEN the ChromaDB module initializes
- THEN it connects to `http://chromadb:8000`

#### Scenario: Default ChromaDB URL

- GIVEN `CHROMADB_URL` is not set
- WHEN the ChromaDB module initializes
- THEN it connects to `http://localhost:8000`

### Requirement: Application Configuration

The system SHALL expose app configuration: `PORT` (default 3000), `CORS_ORIGINS` (comma-separated), `NODE_ENV`.

#### Scenario: Custom port

- GIVEN `PORT=4000`
- WHEN the application starts
- THEN the HTTP server listens on port 4000

#### Scenario: CORS configuration

- GIVEN `CORS_ORIGINS=http://localhost:3000,http://localhost:5173`
- WHEN the application starts
- THEN CORS allows requests from both origins

### Requirement: .env.example Template

The system SHALL maintain a `.env.example` file documenting all required and optional environment variables with descriptions and default values.

#### Scenario: Template completeness

- GIVEN the `.env.example` file
- WHEN a developer copies it to `.env`
- THEN all variables needed for application startup are present
- AND sensitive variables have placeholder values (not real keys)
