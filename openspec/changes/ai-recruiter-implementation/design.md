# Design: ai-recruiter-implementation

## Technical Approach

Bottom-up NestJS module build: Config → Common → LLM → Recruiter. All modules use `@nestjs/config` for env vars, class-validator for DTOs, and NestJS DI for wiring. IP whitelist enforced globally via `app.useGlobalGuards()` in main.ts. LangGraph nodes are stubs. LLM abstraction uses a factory with ordered fallback (OpenAI → OpenRouter → Gemini).

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| CIDR library | Manual bitmask vs `cidr-regex` npm | Manual = no dep; npm = tested edge cases | Manual bitmask — avoids dependency for simple IPv4 CIDR |
| File watcher | `fs.watch` polling vs `chokidar` | chokidar = reliable but heavy; fs.watch = native but inconsistent | `fs.watch` with 1s debounce — lightweight, sufficient for single file |
| LLM fallback | Circuit breaker vs ordered retry | Circuit breaker = complex state; ordered retry = simpler, sufficient | Ordered retry with 3 attempts per provider, 1s base delay |
| ChromaDB embedding | LangChain embeddings vs raw HTTP | LangChain = abstraction; raw = control | LangChain `OpenAIEmbeddings` — reuse existing `@langchain/openai` dep |
| Multer storage | Disk vs memory | Disk = temp files; memory = simpler for small CVs | Memory storage — CVs are small, avoids disk I/O |

## Data Flow

```
HTTP POST (CV + jobDesc)
  → IpWhitelistGuard (extract IP, check CIDR, inject metadata)
  → RecruiterController (validate DTO, extract file)
  → RecruiterService.evaluateCandidate()
    → PdfExtractorTool.extractText(buffer)        → cvText
    → SkillExtractorTool.extractSkills(cvText)    → candidateSkills
    → JobMatcherTool.match(cvText, jobDesc)        → matchResult
    → LlmService.generateText(prompt)              → scores, feedback
    → return RecruiterState
  → HTTP 201 Response
```

## Module Structure & DI Graph

```
AppModule
├── ConfigModule.forRoot({ isGlobal: true })
├── EventEmitterModule.forRoot()
├── CommonModule (exported: WhitelistService, IpWhitelistGuard)
├── LlmModule (exported: LlmService)
├── RecruiterModule
│   ├── imports: [CommonModule, LlmModule]
│   ├── providers: [RecruiterService, PdfExtractorTool, SkillExtractorTool, JobMatcherTool]
│   └── controllers: [RecruiterController]
└── LangGraphModule (placeholder wiring — not implemented)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add @nestjs/config, class-validator, class-transformer, pdf-parse, chromadb, @langchain/*, multer, @types/multer |
| `src/main.ts` | Modify | Add global guard, ValidationPipe, CORS, global prefix `/api` |
| `src/app.module.ts` | Modify | Import ConfigModule, EventEmitterModule, Common, LLM, Recruiter modules |
| `src/config/configuration.ts` | Create | App config factory: port, cors, nodeEnv |
| `src/config/llm.config.ts` | Create | LLM config: provider, apiKeys per provider, model, temperature |
| `src/config/langgraph.config.ts` | Create | LangGraph config: collection name, chroma URL |
| `src/common/common.module.ts` | Create | Global module exporting WhitelistService |
| `src/common/services/whitelist.service.ts` | Create | File load, CIDR check, cache, fs.watch hot-reload |
| `src/common/guards/ip-whitelist.guard.ts` | Create | CanActivate guard — IP extraction, validation, metadata injection |
| `src/common/interfaces/whitelist.interface.ts` | Create | WhitelistEntry, WhitelistConfig, WhitelistMetadata interfaces |
| `src/common/dto/evaluate-candidate.dto.ts` | Create | DTO with class-validator: jobDescription (string), llmProvider (enum) |
| `src/common/dto/job-description.dto.ts` | Create | DTO for compare/questions endpoints |
| `src/common/enums/llm-provider.enum.ts` | Create | Enum: OPENAI, OPENROUTER, GEMINI |
| `src/modules/llm/llm.module.ts` | Create | Module providing LlmService |
| `src/modules/llm/llm.service.ts` | Create | Factory pattern, fallback chain, retry with exponential backoff |
| `src/modules/llm/llm-provider.factory.ts` | Create | Creates ChatOpenAI/ChatGoogleGenerativeAI based on provider |
| `src/modules/llm/interfaces/llm.interface.ts` | Create | LlmProvider interface, LlmResponse type |
| `src/modules/llm/exceptions/llm.exception.ts` | Create | LlmProviderException, LlmParsingException |
| `src/agents/recruiter/recruiter.module.ts` | Create | Module with tools, service, controller |
| `src/agents/recruiter/services/recruiter.service.ts` | Create | evaluateCandidate, evaluateBatch, reEvaluate, compareCandidates |
| `src/agents/recruiter/controllers/recruiter.controller.ts` | Create | 6 endpoints with @UseInterceptors(FileInterceptor) |
| `src/agents/recruiter/tools/pdf-extractor.tool.ts` | Create | pdf-parse wrapper, text cleaning |
| `src/agents/recruiter/tools/skill-extractor.tool.ts` | Create | LLM-based skill classification |
| `src/agents/recruiter/tools/job-matcher.tool.ts` | Create | ChromaDB semantic matching |
| `src/agents/recruiter/tools/llm-provider.tool.ts` | Create | Thin wrapper delegating to LlmService |
| `src/agents/recruiter/state/recruiter.state.ts` | Create | RecruiterState interface (from project-instructions.md) |
| `src/agents/recruiter/graph/recruiter.graph.ts` | Create | Placeholder — TODO graph with 5 nodes |
| `src/agents/recruiter/nodes/parser.node.ts` | Create | Placeholder — TODO |
| `src/agents/recruiter/nodes/analyzer.node.ts` | Create | Placeholder — TODO |
| `src/agents/recruiter/nodes/matcher.node.ts` | Create | Placeholder — TODO |
| `src/agents/recruiter/nodes/scorer.node.ts` | Create | Placeholder — TODO |
| `src/agents/recruiter/nodes/feedback.node.ts` | Create | Placeholder — TODO |
| `src/data/ip-whitelist.json` | Create | Example whitelist with CIDR ranges |
| `.env.example` | Create | All env vars with descriptions |
| `src/common/filters/global-exception.filter.ts` | Create | HttpExceptionFilter for consistent error responses |
| `src/common/interceptors/response-transform.interceptor.ts` | Create | Wraps responses in `{ success, data }` envelope |

## Key Interfaces

```typescript
// src/common/interfaces/whitelist.interface.ts
interface WhitelistEntry {
  ip: string;            // IP or CIDR (e.g. "192.168.1.100" or "10.0.0.0/8")
  description: string;
  department?: string;
  employeeId?: string;
  expiresAt?: string;    // ISO date, optional
}

// src/modules/llm/interfaces/llm.interface.ts
interface LlmProvider {
  generateText(prompt: string, options?: LlmOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T>;
}

// src/agents/recruiter/state/recruiter.state.ts
interface RecruiterState {
  cvBuffer?: Buffer;
  cvText?: string;
  jobDescription?: string;
  jobTitle?: string;
  candidateSkills: { hard: string[]; soft: string[]; tools: string[] };
  // ... (full interface from project-instructions.md lines 198-249)
  currentStep: 'idle' | 'parsing' | 'analyzing' | 'matching' | 'scoring' | 'complete' | 'error';
  errors: string[];
  processingTime: number;
  timestamp: Date;
  llmProvider: LlmProviderEnum;
}
```

## Security Design

**IP Extraction Order**: `x-forwarded-for[0]` → `x-real-ip` → `req.socket.remoteAddress`

**CIDR Algorithm**: Parse IP and CIDR to 32-bit integers, mask both with `~((1 << (32 - prefix)) - 1)`, compare. Falls back to exact string match for non-CIDR entries.

**Hot Reload**: `fs.watch(whitelistPath)` with 1s debounce. On change, re-parse JSON, validate structure, swap in-memory cache atomically. On file read error, keep last valid cache and log warning.

**Audit Log Format**: `{"event":"ip_access","ip":"...","decision":"allowed|denied","path":"...","method":"...","timestamp":"..."}`

## Error Handling

- **Global Filter** (`GlobalExceptionFilter`): Catches all `HttpException`, formats as `{ statusCode, message, error, code?, support? }`.
- **LLM Fallback**: Try primary → catch → try next provider → catch → throw `LlmProviderException("All providers failed")`.
- **PDF Errors**: `PdfExtractionException` for scanned/corrupted PDFs with descriptive message.
- **Validation Errors**: NestJS `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | WhitelistService CIDR logic | Mock fs, test exact IP + CIDR range + deny cases |
| Unit | IpWhitelistGuard | Mock WhitelistService, test request extraction, metadata injection |
| Unit | LlmService fallback | Mock provider factory, test retry and fallback chain |
| Unit | PdfExtractorTool | Mock pdf-parse, test extraction and error cases |
| Unit | SkillExtractorTool | Mock LlmService, test skill classification |
| Unit | JobMatcherTool | Mock ChromaDB client, test similarity scoring |
| Integration | RecruiterService | Mock tools, test evaluateCandidate flow |
| Integration | RecruiterController | Supertest with mocked service, test all 6 endpoints |
| E2E | Full pipeline | Real app with mocked external services |

**Mocking**: Use NestJS `@nestjs/testing` Test module with custom providers. Mock ChromaDB via `{ provide: CHROMA_CLIENT, useValue: mockClient }`. Mock LLM via `{ provide: LlmService, useValue: mockLlmService }`.

## Implementation Order

1. `npm install` all dependencies
2. `nest generate module config` → create configuration.ts, llm.config.ts
3. `nest generate module common` → create services, guards, interfaces, DTOs, enums, filters
4. `nest generate module modules/llm` → create LlmService, factory, interfaces, exceptions
5. `nest generate module agents/recruiter` → create tools, service, controller, state
6. Create LangGraph placeholder files (graph + 5 nodes)
7. Create data/ip-whitelist.json, .env.example
8. Update app.module.ts and main.ts
9. Write unit tests for all tools
10. Write integration tests for RecruiterService
11. Verify: `npm run build && npm test`

## Migration / Rollout

No migration required — greenfield project.

## Open Questions

- [ ] Should the `langgraph.config.ts` use `@hive-academy/nestjs-langgraph` or raw `@langchain/langgraph`? (Affects import paths in graph/node files)
- [ ] Is MongoDB persistence in scope for batch job status tracking, or should batch results be held in-memory only?
