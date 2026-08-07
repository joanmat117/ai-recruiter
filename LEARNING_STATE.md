# 📊 Learning State — LangGraph

> Seguimiento del progreso de aprendizaje por concepto.
> Estados: 🔴 Pendiente | 🟡 En progreso | ✅ Completado

---

## Foundation

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| Qué es LangGraph y para qué sirve | 🟡 En progreso | — | Diferencia con LangChain puro |
| Instalación y setup (`@langchain/langgraph`) | ✅ Completado | — | Ya está en `package.json` |
| Diferencia Graph API vs Functional API | 🔴 Pendiente | — | Elegimos Graph API para este proyecto |

---

## State

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| `Annotation.Root` — definición del schema | ✅ Completado | Paso 1 | `state/recruiter.state.ts` con `RecruiterStateAnnotation` + input/output schemas |
| **Reducers** — cómo se mergean updates | ✅ Completado | Paso 1 | `append` aplicado a errores, warnings, strengths, weaknesses, redFlags, greenFlags, interviewQuestions, nextSteps |
| Campo sin reducer = sobrescribe | ✅ Completado | Paso 1 | Default overwrite |
| Custom reducer para listas acumulativas | ✅ Completado | Paso 1 | Helper `append = (left, right) => [...left, ...right]` |
| Input/Output schemas separados del internal schema | ✅ Completado | Paso 1 | `RecruiterInputAnnotation` + `RecruiterOutputAnnotation` + `StateGraph(ann, { input, output })` |
| `MessagesState` — state pre-armado con `add_messages` | 🔴 Pendiente | Paso 1 | Podría usarse para historial LLM |
| Tipos derivados (`typeof Ann.State`) | ✅ Completado | Paso 1 | `RecruiterState`, `RecruiterInput`, `RecruiterOutput` |
| `StateSteps` como enum | ✅ Completado | Paso 1 | Exponía bug: `'feedback'` no existía en el union |

---

## Nodes

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| Node functions — reciben state, retornan partial update | 🔴 Pendiente | Paso 2 | Firma `(state) => Partial<State>` |
| Inmutabilidad — no mutar el state | 🔴 Pendiente | Paso 2 | Siempre retornar objeto nuevo |
| Nodes asíncronos (`async/await`) | 🔴 Pendiente | Paso 2 | Necesario para llamadas a LLM |
| `retry_policy` — reintentos por nodo | 🔴 Pendiente | Paso 2 | Para nodos que llaman a LLMs |
| `timeout` — límite de ejecución por nodo | 🔴 Pendiente | Paso 2 | Importante para LLMs lentos |
| Acceder a `runtime` y `config` desde un node | 🔴 Pendiente | Paso 2 | Dependencias, thread_id, etc. |

---

## Edges & Compilation

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| Edges normales (`add_edge`) | 🔴 Pendiente | Paso 3 | Flujo determinístico A → B |
| `START` y `END` — nodos virtuales | 🔴 Pendiente | Paso 3 | Entrada y salida del grafo |
| Conditional edges (`add_conditional_edges`) | 🔴 Pendiente | Paso 3 | Routing dinámico según lógica |
| Routing function — retorna nombre del próximo node | 🔴 Pendiente | Paso 3 | Decide el camino |
| `compile()` — valida y prepara el grafo | 🔴 Pendiente | Paso 3 | Obligatorio antes de ejecutar |
| Super-step — nodos en paralelo vs secuencial | 🔴 Pendiente | Paso 3 | Concepto de ejecución |

---

## Execution

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| `graph.invoke(input)` — ejecución síncrona | 🔴 Pendiente | Paso 4 | Retorna state final |
| Input del grafo — objeto parcial inicial | 🔴 Pendiente | Paso 4 | `{ cvBuffer, jobDescription }` |
| State final — resultado post-ejecución | 🔴 Pendiente | Paso 4 | Qué contiene al terminar |
| Visualización (`draw_mermaid_png`, `print_ascii`) | 🔴 Pendiente | Paso 4 | Ver la estructura del grafo |

---

## LLM Integration

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| Chat models (`ChatOpenAI`, `ChatGoogleGenerativeAI`) | 🔴 Pendiente | Paso 5 | Instanciar desde el factory |
| Prompt templates (`ChatPromptTemplate`) | 🔴 Pendiente | Paso 5 | Prompts reutilizables |
| **Structured output** — forzar JSON del LLM | 🔴 Pendiente | Paso 5 | `zod` + `withStructuredOutput` |
| Llamar LLM desde un node | 🔴 Pendiente | Paso 5 | `await model.invoke(...)` |
| Manejo de tokens y truncado | 🔴 Pendiente | Paso 5 | `.substring(0, 4000)` ya existe |

---

## Tools & Agent Loop

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| Tools — funciones que el LLM puede invocar | 🔴 Pendiente | Paso 6 | `@tool` o equivalente |
| `model.bind_tools([...])` — conectar tools al modelo | 🔴 Pendiente | Paso 6 | El LLM "sabe" qué tools tiene |
| Tool node — ejecuta las tool calls del LLM | 🔴 Pendiente | Paso 6 | Recibe tool_calls, ejecuta |
| Agent loop: LLM → tools → LLM → respuesta | 🔴 Pendiente | Paso 6 | Ciclo hasta que el LLM termina |
| `Command` — control primitivo (routing + updates) | 🔴 Pendiente | Paso 6 | Return desde nodes y tools |
| Workflow vs Agent — diferencia conceptual | 🔴 Pendiente | Paso 6 | Determinístico vs LLM decide |

---

## Persistence

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| Checkpointer — persistir state entre nodos | 🔴 Pendiente | Paso 7 | `InMemorySaver`, `SqliteSaver` |
| `thread_id` — identificador de ejecución | 🔴 Pendiente | Paso 7 | Se pasa en config |
| State history — acceder snapshots anteriores | 🔴 Pendiente | Paso 7 | `graph.get_state_history(...)` |
| Store — persistencia cross-thread | 🔴 Pendiente | Paso 7 | Datos compartidos entre threads |
| Time travel — volver y re-ejecutar | 🔴 Pendiente | Paso 7 | Desde un checkpoint anterior |

---

## Streaming

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| `graph.stream(input, config)` — AsyncGenerator | 🔴 Pendiente | Paso 8 | Emite updates progresivos |
| Stream modes: `values`, `updates`, `events` | 🔴 Pendiente | Paso 8 | Qué información fluye cada step |
| LangGraph + NestJS SSE (`@Sse()` decorator) | 🔴 Pendiente | Paso 8 | Conectar stream con HTTP |
| Stream del estado completo vs solo cambios | 🔴 Pendiente | Paso 8 | `stream_mode` controla esto |

---

## Human-in-the-Loop

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| `interrupt(value)` — pausar ejecución | 🔴 Pendiente | Paso 9 | Espera input humano |
| `Command(resume="...")` — reanudar ejecución | 🔴 Pendiente | Paso 9 | El valor vuelve al `interrupt()` |
| Validación del input humano | 🔴 Pendiente | Paso 9 | Antes de aceptar la respuesta |
| Interrupts + Checkpointing — requiere checkpointer | 🔴 Pendiente | Paso 9 | El state pausado se guarda |

---

## NestJS Integration

| Concepto | Estado | Paso | Notas |
|----------|--------|------|-------|
| Grafo compilado como provider inyectable | 🔴 Pendiente | Paso 10 | DI de NestJS |
| Mapeo HTTP → state inicial del grafo | 🔴 Pendiente | Paso 10 | Controller → Service → Graph |
| `context` del grafo (runtime config) | 🔴 Pendiente | Paso 10 | Pasar `llmProvider` sin meterlo en state |
| Separación NestJS (HTTP) / LangGraph (lógica) | 🔴 Pendiente | Paso 10 | Architecture boundary |

---

## Resumen

| Categoría | Conceptos | Completados | Progreso |
|-----------|-----------|-------------|----------|
| Foundation | 3 | 1 | 33% |
| State | 6 | 0 | 0% |
| Nodes | 6 | 0 | 0% |
| Edges & Compilation | 6 | 0 | 0% |
| Execution | 4 | 0 | 0% |
| LLM Integration | 5 | 0 | 0% |
| Tools & Agent Loop | 6 | 0 | 0% |
| Persistence | 5 | 0 | 0% |
| Streaming | 4 | 0 | 0% |
| Human-in-the-Loop | 4 | 0 | 0% |
| NestJS Integration | 4 | 0 | 0% |
| **TOTAL** | **53** | **1** | **2%** |

---

## Leyenda de estados

- 🔴 **Pendiente** — no empezaste
- 🟡 **En progreso** — entendiendo el concepto / implementando
- ✅ **Completado** — entendido y aplicado al proyecto

---

## Notas de aprendizaje

> Acá podés ir anotando dudas, descubrimientos o "aha moments".

- _Tu primera nota va aquí..._
