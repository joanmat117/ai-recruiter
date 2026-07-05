# Tasks: ai-recruiter-implementation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1800–2200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (LLM + Tools) → PR 3 (Service + API) → PR 4 (LangGraph + Tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation: deps, config, common module, data files, root wiring | PR 1 | Base = feature/recruiter-implementation. ~450 lines |
| 2 | LLM abstraction + recruiter tools | PR 2 | Base = PR 1 branch. ~400 lines |
| 3 | Recruiter service + controller (6 endpoints) | PR 3 | Base = PR 2 branch. ~500 lines |
| 4 | LangGraph placeholders + all tests | PR 4 | Base = PR 3 branch. ~450 lines |

## Phase 1: Foundation (Dependencies, Config, Common, Data)

- [x] 1.1 Install npm dependencies: `npm install @nestjs/config class-validator class-transformer pdf-parse chromadb @langchain/openai @langchain/core multer ip-cidr && npm install -D @types/multer`
- [x] 1.2 Create `src/config/configuration.ts` — app config factory (port, cors, nodeEnv) using `registerAs`
- [x] 1.3 Create `src/config/llm.config.ts` — LLM config: provider, apiKeys, model, temperature, maxTokens via `registerAs('llm')`
- [x] 1.4 Create `src/config/langgraph.config.ts` — ChromaDB URL, collection prefix via `registerAs('langgraph')`
- [x] 1.5 Generate common module: `nest g module common --no-spec`
- [x] 1.6 Create `src/common/interfaces/whitelist.interface.ts` — WhitelistEntry, WhitelistConfig, WhitelistMetadata
- [x] 1.7 Create `src/common/enums/llm-provider.enum.ts` — OPENAI, OPENROUTER, GEMINI
- [x] 1.8 Create `src/common/dto/evaluate-candidate.dto.ts` — jobDescription (string, required), llmProvider (enum, optional)
- [x] 1.9 Create `src/common/dto/job-description.dto.ts` — DTO for compare/questions endpoints
- [x] 1.10 Create `src/common/services/whitelist.service.ts` — JSON load, CIDR check (ip-cidr), cache, fs.watch hot-reload, error fallback
- [x] 1.11 Create `src/common/guards/ip-whitelist.guard.ts` — CanActivate: extract IP (x-forwarded-for → x-real-ip → socket), check WhitelistService, inject metadata, audit log
- [x] 1.12 Create `src/common/filters/global-exception.filter.ts` — HttpExceptionFilter wrapping errors in { statusCode, message, error, code? }
- [x] 1.13 Create `src/common/interceptors/response-transform.interceptor.ts` — map responses to { success: true, data } envelope
- [x] 1.14 Update `src/common/common.module.ts` — export WhitelistService, register guard
- [x] 1.15 Create `src/data/ip-whitelist.json` — example entries: 192.168.1.100, 10.0.0.0/8, 172.16.0.0/12
- [x] 1.16 Create `.env.example` — all env vars with descriptions and defaults
- [x] 1.17 Update `src/app.module.ts` — import ConfigModule (global), EventEmitterModule, CommonModule
- [x] 1.18 Update `src/main.ts` — global guard (IpWhitelistGuard), ValidationPipe (whitelist, forbidNonWhitelisted), CORS, global prefix `/api`

## Phase 2: LLM Abstraction + Recruiter Tools

- [ ] 2.1 Generate LLM module: `nest g module modules/llm --no-spec`
- [ ] 2.2 Create `src/modules/llm/interfaces/llm.interface.ts` — LlmProvider interface (generateText, generateStructured), LlmOptions, LlmResponse
- [ ] 2.3 Create `src/modules/llm/exceptions/llm.exception.ts` — LlmProviderException, LlmParsingException
- [ ] 2.4 Create `src/modules/llm/llm-provider.factory.ts` — factory: switch on provider enum → create ChatOpenAI / ChatGoogleGenerativeAI / OpenRouter wrapper
- [ ] 2.5 Create `src/modules/llm/llm.service.ts` — inject ConfigService, use factory, ordered fallback (OpenAI→OpenRouter→Gemini), 3 retries per provider, 1s base exponential backoff
- [ ] 2.6 Update `src/modules/llm/llm.module.ts` — provide LlmService, export it
- [ ] 2.7 Generate recruiter module: `nest g module agents/recruiter --no-spec`
- [ ] 2.8 Create `src/agents/recruiter/tools/pdf-extractor.tool.ts` — pdf-parse wrapper, text cleaning, PdfExtractionException for scanned/corrupted
- [ ] 2.9 Create `src/agents/recruiter/tools/skill-extractor.tool.ts` — LLM-based skill classification into hard/soft/tools, empty-text handling
- [ ] 2.10 Create `src/agents/recruiter/tools/job-matcher.tool.ts` — ChromaDB embedding store/query, cosine similarity, gap identification, department isolation
- [ ] 2.11 Create `src/agents/recruiter/tools/llm-provider.tool.ts` — thin wrapper delegating to LlmService.generateText

## Phase 3: Recruiter Service + Controller

- [ ] 3.1 Create `src/agents/recruiter/state/recruiter.state.ts` — full RecruiterState interface from project-instructions.md (lines 198-249)
- [ ] 3.2 Create `src/agents/recruiter/services/recruiter.service.ts` — 4 methods: evaluateCandidate (pdf→extract→skills→match→score→feedback), evaluateBatch (iterate + track job), reEvaluate (re-run with new provider), compareCandidates (rank by score)
- [ ] 3.3 Create `src/agents/recruiter/controllers/recruiter.controller.ts` — 6 endpoints: POST evaluate (FileInterceptor), POST evaluate-batch (FilesInterceptor), GET status/:jobId, POST compare, POST interview-questions, POST feedback. Include file validation (PDF only), multer memory storage config
- [ ] 3.4 Update `src/agents/recruiter/recruiter.module.ts` — import CommonModule + LlmModule, provide tools + service, register controller

## Phase 4: LangGraph Placeholders + Root Integration

- [x] 4.1 Create `src/agents/recruiter/graph/recruiter.graph.ts` — StateGraph definition with 5 nodes, conditional edges, TODO comments for implementation
- [x] 4.2 Create `src/agents/recruiter/nodes/parser.node.ts` — placeholder: returns state unchanged, TODO block describing text normalization + section detection
- [x] 4.3 Create `src/agents/recruiter/nodes/analyzer.node.ts` — placeholder: returns state unchanged, TODO block describing LLM skill/experience analysis
- [x] 4.4 Create `src/agents/recruiter/nodes/matcher.node.ts` — placeholder: returns state unchanged, TODO block describing ChromaDB embedding lookup + cosine similarity
- [x] 4.5 Create `src/agents/recruiter/nodes/scorer.node.ts` — placeholder: returns state unchanged, TODO block describing weighted scoring + threshold routing
- [x] 4.6 Create `src/agents/recruiter/nodes/feedback.node.ts` — placeholder: returns state unchanged, TODO block describing LLM feedback generation
- [x] 4.7 Update `src/app.module.ts` — add RecruiterModule to imports (final wiring)

## Phase 5: Tests

- [x] 5.1 Write unit test `src/common/services/whitelist.service.spec.ts` — mock fs, test exact IP match, CIDR range match/miss, missing file fallback, hot-reload
- [x] 5.2 Write unit test `src/common/guards/ip-whitelist.guard.spec.ts` — mock WhitelistService, test IP extraction order, metadata injection, 403 on deny
- [x] 5.3 Write unit test `src/modules/llm/llm.service.spec.ts` — mock factory, test primary success, fallback on failure, all-fail exception, retry count
- [x] 5.4 Write unit test `src/agents/recruiter/tools/pdf-extractor.tool.spec.ts` — mock pdf-parse, test text extraction, scanned PDF error, corrupted PDF error
- [x] 5.5 Write unit test `src/agents/recruiter/tools/skill-extractor.tool.spec.ts` — mock LlmService, test skill classification, empty text handling
- [x] 5.6 Write unit test `src/agents/recruiter/tools/job-matcher.tool.spec.ts` — mock ChromaDB, test similarity scoring, gap identification, department isolation
- [x] 5.7 Write integration test `src/agents/recruiter/services/recruiter.service.spec.ts` — mock all tools, test evaluateCandidate full flow, evaluateBatch, compareCandidates
- [x] 5.8 Write integration test `src/agents/recruiter/controllers/recruiter.controller.spec.ts` — supertest with mocked service, test all 6 endpoints including file upload validation

## Verification

- [x] V.1 `npm run build` — zero TypeScript errors
- [x] V.2 `npm test` — all unit + integration tests pass
- [ ] V.3 Start app (`npm run start:dev`) — verify boot without crash
- [ ] V.4 Test IP guard: curl from allowed/denied IP, verify 200/403
- [ ] V.5 Test endpoints: POST /api/recruiter/evaluate with sample PDF + jobDescription, verify 201 response structure
