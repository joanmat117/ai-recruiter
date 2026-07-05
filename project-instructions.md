```text
DESARROLLA UN PROYECTO COMPLETO CON NESTJS Y LANGGRAPH PARA UN "AI RECRUITER" QUE AUTOMATICE EL SCREENING DE CANDIDATOS

## 🎯 OBJETIVO DEL PROYECTO

Crear un sistema multi-agente de reclutamiento inteligente que:
1. Reciba un CV en PDF y una descripción de puesto
2. Extraiga y estructure la información del candidato
3. Analice el match con la oferta usando embeddings y ChromaDB
4. Genere un score de compatibilidad con explicación
5. Recomiende preguntas para la entrevista
6. Envíe feedback personalizado al candidato

## 🏗️ ARQUITECTURA TÉCNICA

### Stack tecnológico:
- NestJS v10+ con TypeScript
- LangGraph.js (@langchain/langgraph) para el orquestador
- @hive-academy/nestjs-langgraph (integración con NestJS)
- ChromaDB (@hive-academy/nestjs-chromadb) para búsqueda vectorial
- Soporte para múltiples LLM providers: OpenAI, OpenRouter, Google Gemini
- pdf-parse para extraer texto de PDFs
- class-validator + class-transformer para validaciones

### Estructura de carpetas:
```
src/
├── agents/
│   └── recruiter/
│       ├── state/
│       │   └── recruiter.state.ts           [COMPLETO - IA DEBE GENERAR]
│       ├── graph/
│       │   └── recruiter.graph.ts           [IMPLEMENTAR LANGGRAPH - TÚ]
│       ├── nodes/
│       │   ├── parser.node.ts               [IMPLEMENTAR LANGGRAPH - TÚ]
│       │   ├── analyzer.node.ts             [IMPLEMENTAR LANGGRAPH - TÚ]
│       │   ├── matcher.node.ts              [IMPLEMENTAR LANGGRAPH - TÚ]
│       │   ├── scorer.node.ts               [IMPLEMENTAR LANGGRAPH - TÚ]
│       │   └── feedback.node.ts             [IMPLEMENTAR LANGGRAPH - TÚ]
│       ├── tools/
│       │   ├── pdf-extractor.tool.ts        [COMPLETO - IA DEBE GENERAR]
│       │   ├── skill-extractor.tool.ts      [COMPLETO - IA DEBE GENERAR]
│       │   ├── job-matcher.tool.ts          [COMPLETO - IA DEBE GENERAR]
│       │   └── llm-provider.tool.ts         [COMPLETO - IA DEBE GENERAR]
│       ├── services/
│       │   └── recruiter.service.ts         [COMPLETO - IA DEBE GENERAR]
│       └── controllers/
│           └── recruiter.controller.ts      [COMPLETO - IA DEBE GENERAR]
├── common/
│   ├── guards/
│   │   └── ip-whitelist.guard.ts            [COMPLETO - IA DEBE GENERAR]
│   ├── services/
│   │   └── whitelist.service.ts             [COMPLETO - IA DEBE GENERAR]
│   ├── interfaces/
│   │   └── whitelist.interface.ts           [COMPLETO - IA DEBE GENERAR]
│   ├── dto/
│   │   ├── evaluate-candidate.dto.ts        [COMPLETO - IA DEBE GENERAR]
│   │   └── job-description.dto.ts           [COMPLETO - IA DEBE GENERAR]
│   └── enums/
│       └── llm-provider.enum.ts             [COMPLETO - IA DEBE GENERAR]
├── data/
│   └── ip-whitelist.json                    [COMPLETO - IA DEBE GENERAR CON EJEMPLOS]
├── config/
│   ├── configuration.ts                     [COMPLETO - IA DEBE GENERAR]
│   ├── llm.config.ts                        [COMPLETO - IA DEBE GENERAR]
│   └── langgraph.config.ts                  [COMPLETO - IA DEBE GENERAR]
├── modules/
│   └── llm/
│       ├── llm.module.ts                    [COMPLETO - IA DEBE GENERAR]
│       └── llm.service.ts                   [COMPLETO - IA DEBE GENERAR]
└── main.ts                                  [COMPLETO - IA DEBE GENERAR]
```

## 📦 DEPENDENCIAS REQUERIDAS

```json
{
  "dependencies": {
    "@nestjs/core": "^10.0.0",
    "@nestjs/common": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@hive-academy/nestjs-langgraph": "^1.0.0",
    "@hive-academy/nestjs-chromadb": "^1.0.0",
    "@langchain/core": "^0.1.0",
    "@langchain/langgraph": "^0.0.10",
    "@langchain/openai": "^0.0.10",
    "@langchain/google-genai": "^0.0.5",
    "@langchain/community": "^0.0.10",
    "pdf-parse": "^1.1.1",
    "chromadb": "^1.5.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "mongoose": "^7.0.0",
    "openai": "^4.0.0",
    "zod": "^3.22.0",
    "@nestjs/event-emitter": "^2.0.0",
    "multer": "^1.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "@types/multer": "^1.4.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "supertest": "^6.3.0"
  }
}
```

## 🔐 VARIABLES DE ENTORNO

```env
# Provider selection (openai | openrouter | gemini)
LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3-opus
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Google Gemini
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-1.5-pro

# ChromaDB
CHROMA_DB_URL=http://localhost:8000
CHROMA_COLLECTION=recruiter_embeddings

# MongoDB (opcional - para persistencia)
MONGODB_URI=mongodb://localhost:27017/recruiter

# App
PORT=3000
NODE_ENV=development
WHITELIST_FILE_PATH=src/data/ip-whitelist.json
```

## 🏢 SEGURIDAD: IP WHITELIST CON JSON

### Funcionalidad de Seguridad:
- El sistema está diseñado para operar en redes locales corporativas
- Autenticación basada en IP (no requiere login de usuarios)
- Lista de IPs permitidas cargada desde un archivo JSON
- Recarga en caliente de la whitelist al modificar el JSON
- Soporte para rangos CIDR (ej: 192.168.1.0/24)
- Logging de todos los accesos para auditoría
- Respuesta 403 con mensaje profesional si la IP no está autorizada

### Archivo ip-whitelist.json (ejemplo a generar):
```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-01-15T10:30:00Z",
  "environment": "production",
  "options": {
    "enableLogging": true,
    "enableExpiration": false,
    "defaultAction": "deny"
  },
  "allowedIps": [
    {
      "ip": "192.168.1.100",
      "description": "Oficina Principal - RRHH",
      "department": "Recursos Humanos",
      "employeeId": "EMP-001"
    },
    {
      "ip": "10.0.0.50",
      "description": "VPN - Reclutador",
      "department": "Recursos Humanos",
      "employeeId": "EMP-002"
    },
    {
      "ip": "192.168.1.0/24",
      "description": "Rango oficina principal",
      "department": "Todas"
    }
  ]
}
```

### Guard de IP Whitelist (IA debe generar):
- Extraer IP del request (soportando proxies con x-forwarded-for)
- Cargar whitelist desde JSON con caché de 1 minuto
- Validar IPs exactas y rangos CIDR
- Añadir metadata del usuario (departamento, employeeId) al request
- Logging estructurado de todos los accesos
- Aplicación GLOBAL del guard en main.ts

## 🧠 ESTADO DEL AGENTE (IA DEBE GENERAR COMPLETO)

```typescript
export interface RecruiterState {
  // INPUT
  cvBuffer?: Buffer;
  cvText?: string;
  jobDescription?: string;
  jobTitle?: string;
  
  // EXTRACCIÓN DEL CV
  candidateSkills: { hard: string[]; soft: string[]; tools: string[]; };
  candidateExperience: { years: number; summary: string; companies: string[]; roles: string[]; };
  candidateEducation: Array<{ degree: string; institution: string; year: number; }>;
  candidateLanguages: string[];
  candidateCertifications: string[];
  
  // ANÁLISIS DE OFERTA
  requiredSkills: string[];
  preferredSkills: string[];
  yearsExperienceRequired: number;
  educationRequired: string;
  industryKeywords: string[];
  
  // MATCHING
  skillMatch: { matched: string[]; missing: string[]; matchPercentage: number; };
  experienceMatch: { meetsRequirement: boolean; yearsMatch: number; relevanceScore: number; };
  educationMatch: { meetsRequirement: boolean; relevancyScore: number; };
  
  // SCORING
  scores: { overall: number; skills: number; experience: number; education: number; };
  
  // DECISIONES
  recommendation: 'strong_hire' | 'hire' | 'consider' | 'reject';
  confidenceLevel: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  greenFlags: string[];
  
  // OUTPUT
  interviewQuestions: string[];
  feedbackForCandidate: string;
  salaryRecommendation?: string;
  nextSteps?: string[];
  
  // METADATA
  currentStep: 'idle' | 'parsing' | 'analyzing' | 'matching' | 'scoring' | 'complete' | 'error';
  errors: string[];
  warnings: string[];
  processingTime: number;
  timestamp: Date;
  llmProvider: 'openai' | 'openrouter' | 'gemini';
}
```

## 🛠️ HERRAMIENTAS (TOOLS) - IA DEBE GENERAR COMPLETO

### 1. PdfExtractorTool
- Extraer texto de PDF usando pdf-parse
- Manejar diferentes formatos de CV
- Limpiar texto (remover caracteres especiales, normalizar espacios)
- Extraer metadatos del PDF (autor, fecha creación)

### 2. SkillExtractorTool
- Usar LLM para extraer skills estructurados
- Clasificar en hard/soft/tools
- Normalizar nombres de skills (ej: "JS" → "JavaScript")
- Detectar años de experiencia por skill usando expresiones regulares + LLM

### 3. JobMatcherTool
- Comparar CV vs oferta usando embeddings de ChromaDB
- Calcular similitud semántica con cosine similarity
- Identificar gaps específicos entre CV y oferta
- Sugerir áreas de mejora para el candidato

### 4. LlmProviderTool
- Abstracción para múltiples proveedores (OpenAI, OpenRouter, Gemini)
- Factory pattern para crear clientes LLM
- Manejo de fallbacks entre providers si uno falla
- Rate limiting y retry logic con exponential backoff

## 🏗️ SERVICIO PRINCIPAL - IA DEBE GENERAR COMPLETO

### RecruiterService
- Inyección de dependencias: LangGraph Agent Service, todas las Tools, LLM Provider, ChromaDB Service
- Método evaluateCandidate(): recibe CV buffer + job description, crea estado inicial, invoca el grafo de LangGraph
- Método evaluateBatch(): procesar múltiples CVs en paralelo
- Método reEvaluate(): actualizar evaluación con nuevo feedback usando checkpoints de LangGraph
- Método compareCandidates(): comparar candidatos entre sí y generar ranking

### RecruiterController
- POST /api/recruiter/evaluate - Evaluar un candidato (multipart/form-data con CV + jobDescription)
- POST /api/recruiter/evaluate-batch - Evaluar múltiples CVs (multipart/form-data con multiple CVs + jobDescription)
- GET /api/recruiter/status/:jobId - Para procesos asíncronos largos
- POST /api/recruiter/compare - Comparar múltiples candidatos lado a lado
- POST /api/recruiter/interview-questions - Generar preguntas personalizadas
- POST /api/recruiter/feedback - Generar feedback constructivo

## 🎯 PARTE DE LANGGRAPH - TÚ DEBES IMPLEMENTAR

### archivos que debes implementar tu:
1. src/agents/recruiter/graph/recruiter.graph.ts - Grafo completo con todos los nodos y routing
2. src/agents/recruiter/nodes/parser.node.ts - Nodo de extracción de CV
3. src/agents/recruiter/nodes/analyzer.node.ts - Nodo de análisis de oferta
4. src/agents/recruiter/nodes/matcher.node.ts - Nodo de matching
5. src/agents/recruiter/nodes/scorer.node.ts - Nodo de scoring y recomendación
6. src/agents/recruiter/nodes/feedback.node.ts - Nodo de generación de feedback

### Estos archivos deben dejarse como placeholders con comentarios TODO explicando qué debe hacer cada nodo

## 🔧 CONFIGURACIÓN - IA DEBE GENERAR COMPLETO

### 1. app.module.ts
- Importar ConfigModule, LangGraphModule, ChromadbModule, EventEmitterModule
- Registrar RecruiterModule, LlmModule, WhitelistModule

### 2. main.ts
- Aplicar IpWhitelistGuard GLOBALMENTE
- Habilitar ValidationPipe
- Configurar CORS para desarrollo

### 3. LLM Module
- Servicio abstracto que soporta OpenAI, OpenRouter y Gemini
- Factory para crear el cliente según la variable de entorno LLM_PROVIDER
- Fallback automático si un provider falla

## 🧪 TESTS - IA DEBE GENERAR

- Tests unitarios para cada tool
- Tests de integración para el servicio
- Tests del guard de IP whitelist
- Mock de ChromaDB para tests

## 📝 DOCUMENTACIÓN - IA DEBE GENERAR

### README.md:
- Instalación y configuración
- Variables de entorno explicadas
- Ejemplos de uso con curl
- Explicación de la arquitectura multi-agente
- Cómo añadir nuevos LLM providers
- Cómo gestionar la whitelist de IPs
- Scripts de administración

### Swagger/OpenAPI:
- Documentación completa de todos los endpoints
- Schemas de request/response
- Ejemplos de uso autenticado (con IP whitelist)

## ✅ CHECKLIST DE ENTREGABLES DE LA IA

La IA debe generar:

### Código Fuente Completo:
- [ ] Proyecto NestJS completo con estructura de carpetas
- [ ] Todas las herramientas (tools) implementadas
- [ ] Servicio RecruiterService completo
- [ ] Controlador con endpoints REST
- [ ] Configuración de múltiples LLM providers
- [ ] Configuración de ChromaDB con multi-tenencia por IP/departamento
- [ ] Guard de IP Whitelist con carga desde JSON
- [ ] DTOs y validaciones
- [ ] Variables de entorno y configuración
- [ ] Tests unitarios y de integración
- [ ] Documentación completa

### Archivos a dejar para que TÚ implementes (con TODO comments):
- [ ] recruiter.graph.ts - Grafo LangGraph
- [ ] parser.node.ts - Nodo de extracción
- [ ] analyzer.node.ts - Nodo de análisis
- [ ] matcher.node.ts - Nodo de matching
- [ ] scorer.node.ts - Nodo de scoring
- [ ] feedback.node.ts - Nodo de feedback

### Archivos de Configuración:
- [ ] package.json con todas las dependencias
- [ ] tsconfig.json
- [ ] nest-cli.json
- [ ] .env.example
- [ ] docker-compose.yml (opcional, para ChromaDB y MongoDB)
- [ ] ip-whitelist.json con ejemplos

## 🚀 EJEMPLO DE USO ESPERADO

```bash
# Evaluar un candidato (desde una IP autorizada)
curl -X POST http://localhost:3000/api/recruiter/evaluate \
  -F "cv=@candidate.pdf" \
  -F "jobDescription={\"title\":\"Senior Backend Engineer\",\"description\":\"...\"}" \
  -F "llmProvider=openai"

# Respuesta esperada
{
  "success": true,
  "data": {
    "scores": { "overall": 85, "skills": 90, "experience": 80, "education": 85 },
    "recommendation": "strong_hire",
    "reasoning": "El candidato cumple con todos los requisitos técnicos...",
    "strengths": ["Amplia experiencia en TypeScript", "Liderazgo técnico"],
    "weaknesses": ["Falta experiencia en AWS"],
    "interviewQuestions": ["¿Cómo manejarías una migración...?"],
    "feedbackForCandidate": "Muy buena impresión general..."
  }
}

# Si la IP no está autorizada
{
  "statusCode": 403,
  "error": "Access Denied",
  "message": "IP 192.168.1.50 is not authorized to access this resource",
  "code": "IP_NOT_WHITELISTED",
  "support": "Contact IT support to request IP whitelisting"
}
```

## 📋 NOTAS IMPORTANTES

1. **El archivo ip-whitelist.json debe cargarse desde src/data/ con recarga en caliente**
2. **El guard de IP whitelist debe aplicarse GLOBALMENTE en main.ts**
3. **Todos los endpoints deben estar protegidos por el guard**
4. **El logging debe incluir IP, timestamp, path y método para auditoría**
5. **Soporte para rangos CIDR (ej: 192.168.1.0/24)**
6. **Multi-tenencia: cada departamento/empresa tiene su propia colección en ChromaDB**
7. **El código debe ser modular y desacoplado, permitiendo cambiar fácilmente entre LLM providers**
8. **Todas las partes de LangGraph deben dejarse como placeholders con TODO comments**
9. **Incluir ejemplos de streaming para mostrar progreso en tiempo real**

## 🔥 RECOMENDACIONES DE ESTILO

- Usar TypeScript estricto con tipos bien definidos
- Seguir las convenciones de NestJS (módulos, controladores, servicios)
- Usar class-validator para validaciones de DTOs
- Incluir manejo de errores robusto en todas las herramientas
- Documentar todas las funciones con JSDoc
- Seguir principios SOLID y clean architecture
- Usar inyección de dependencias para todo

---

FIN DEL PROMPT

INSTRUCCIONES FINALES:
1. Genera el proyecto completo siguiendo esta estructura
2. TODOS los archivos marcados como [COMPLETO - IA DEBE GENERAR] deben estar implementados
3. TODOS los archivos marcados como [IMPLEMENTAR LANGGRAPH - TÚ] deben dejarse como placeholders con comentarios TODO detallados
4. Incluye ejemplos de uso en la documentación
5. Asegúrate de que el guard de IP whitelist funcione correctamente
6. Incluye scripts de administración para la whitelist
```

