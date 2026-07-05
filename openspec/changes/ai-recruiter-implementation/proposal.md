# Proposal: ai-recruiter-implementation

## Intent

Build a complete multi-agent AI recruiting system that automates candidate screening. The system receives CVs (PDF) and job descriptions, extracts candidate information, matches against requirements using embeddings, generates compatibility scores, and provides interview questions and feedback. This is a greenfield implementation of the NestJS + LangGraph architecture defined in project-instructions.md.

## Scope

### In Scope
- Install all npm dependencies (LangGraph, ChromaDB, pdf-parse, class-validator, etc.)
- Config module: configuration.ts, llm.config.ts, langgraph.config.ts
- Common module: IP whitelist guard, whitelist service, interfaces, DTOs, enums
- LLM module: Multi-provider abstraction (OpenAI, OpenRouter, Gemini) with factory pattern and fallback
- Recruiter module: Tools (pdf-extractor, skill-extractor, job-matcher, llm-provider), service, controller, state interface
- LangGraph files: PLACEHOLDERS with TODO comments (graph, parser, analyzer, matcher, scorer, feedback)
- Root module updates: Import all modules, apply global guard, ValidationPipe, CORS
- Unit tests for tools, integration tests for services
- Data files: ip-whitelist.json with examples, .env.example

### Out of Scope
- LangGraph node implementations (placeholders only)
- MongoDB integration (optional, deferred)
- Docker/containerization setup
- Swagger/OpenAPI documentation
- Production deployment configuration

## Capabilities

### New Capabilities
- `ip-whitelist-security`: IP-based authentication with CIDR support, file-based whitelist, global guard
- `multi-llm-abstraction`: Factory pattern supporting OpenAI, OpenRouter, Gemini with automatic fallback
- `cv-processing`: PDF extraction, skill extraction, candidate data structuring
- `job-matching`: Semantic matching using ChromaDB embeddings, scoring, recommendation generation
- `recruiter-api`: REST endpoints for candidate evaluation, batch processing, comparison

### Modified Capabilities
- None (greenfield project)

## Approach

Bottom-up implementation with NestJS CLI generators. Module dependency order: Config → Common → LLM → Recruiter. Use `nest generate` for all modules, services, controllers, guards, and DTOs. LangGraph node files are placeholders with detailed TODO comments. All other code fully implemented with proper DI, validation, and error handling.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/config/` | New | Configuration files for app, LLM, LangGraph |
| `src/common/` | New | Guards, services, interfaces, DTOs, enums |
| `src/modules/llm/` | New | Multi-LLM provider abstraction |
| `src/agents/recruiter/` | New | Tools, services, controllers, state, graph, nodes |
| `src/data/` | New | IP whitelist JSON data |
| `src/app.module.ts` | Modified | Import all new modules |
| `src/main.ts` | Modified | Global guard, ValidationPipe, CORS |
| `package.json` | Modified | Add all required dependencies |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LangGraph/ChromaDB API instability | Medium | Pin versions, use hive-academy wrappers |
| CIDR range checking complexity | Low | Use ip-cidr library or implement manually |
| Multi-LLM fallback reliability | Medium | Implement circuit breaker pattern, comprehensive error handling |
| PDF extraction limitations | Low | Handle text-based PDFs only, document limitations |
| Version conflicts with NestJS v11 | Medium | Verify compatibility before installation |

## Rollback Plan

1. Remove all newly created modules (git checkout)
2. Revert package.json changes (npm install)
3. Restore original app.module.ts and main.ts
4. Delete openspec/changes/ai-recruiter-implementation/ directory

## Dependencies

- Node.js v24, npm v11, Nest CLI v11
- ChromaDB server running locally (for testing)
- LLM API keys (OpenAI, OpenRouter, or Gemini)

## Success Criteria

- [ ] All npm dependencies installed and compatible with NestJS v11
- [ ] Config module loads environment variables correctly
- [ ] IP whitelist guard blocks unauthorized IPs with 403 response
- [ ] LLM module creates correct provider based on LLM_PROVIDER env var
- [ ] Recruiter service exposes evaluateCandidate, evaluateBatch, reEvaluate, compareCandidates
- [ ] All 6 controller endpoints respond correctly
- [ ] LangGraph node files contain TODO comments with clear implementation instructions
- [ ] Unit tests pass for all tools
- [ ] Integration tests pass for recruiter service
- [ ] .env.example contains all required environment variables
