# AI Recruiter — Roadmap de Aprendizaje LangGraph

> **Objetivo:** Completar este proyecto para dominar LangGraph desde cero.
> **Stack:** NestJS + TypeScript + LangGraph + LangChain (OpenAI/Gemini).
> **Metodología:** Cada paso se construye sobre el anterior. No saltearse.

📊 **Tracking de progreso:** [LEARNING_STATE.md](./LEARNING_STATE.md) — trackea qué conceptos están pendientes, en progreso o completados.

---

## Tabla de contenidos

1. [Diagnóstico actual](#diagnóstico-actual)
2. [Mapa de aprendizaje (orden de implementación)](#mapa-de-aprendizaje)
3. [Paso 1: Modelar el State con Annotation](#paso-1-modelar-el-state-con-annotation)
4. [Paso 2: Implementar Nodes reales](#paso-2-implementar-nodes-reales)
5. [Paso 3: Conectar edges y compilar el grafo](#paso-3-conectar-edges-y-compilar-el-grafo)
6. [Paso 4: Invocar el grafo y verificar ejecución](#paso-4-invocar-el-grafo-y-verificar-ejecución)
7. [Paso 5: Integrar LLMs en los nodes (prompt + structured output)](#paso-5-integrar-llms-en-los-nodes-prompt--structured-output)
8. [Paso 6: Agregar herramientas (tools) al agente](#paso-6-agregar-herramientas-tools-al-agente)
9. [Paso 7: Checkpointing y persistencia (MemorySaver)](#paso-7-checkpointing-y-persistencia)
10. [Paso 8: Streaming de resultados](#paso-8-streaming-de-resultados)
11. [Paso 9: Human-in-the-loop con interrupts](#paso-9-human-in-the-loop-con-interrupts)
12. [Paso 10: Migrar el controlador NestJS para usar el grafo](#paso-10-migrar-el-controlador-nestjs-para-usar-el-grafo)
13. [Glosario de conceptos LangGraph](#glosario-de-conceptos-langgraph)

---

## Diagnóstico actual

Lo que **ya existe** pero está desconectado:

| Componente | Archivo | Estado |
|-----------|---------|--------|
| Interfaz `RecruiterState` | `state/recruiter.state.ts` | ✅ Definida (pero es una interface TS, no un `Annotation` de LangGraph) |
| Grafo con 5 nodos placeholder | `graph/recruiter.graph.ts` | ⚠️ Estructura armada, nodos son `console.log` |
| Node: parser | `nodes/parser.node.ts` | ❌ TODO |
| Node: analyzer | `nodes/analyzer.node.ts` | ❌ TODO |
| Node: matcher | `nodes/matcher.node.ts` | ❌ TODO (aunque `JobMatcherTool` ya existe como clase separada) |
| Node: scorer | `nodes/scorer.node.ts` | ❌ TODO |
| Node: feedback | `nodes/feedback.node.ts` | ❌ TODO |
| Tool: pdf-extractor | `tools/pdf-extractor.tool.ts` | ✅ Funciona (pero no está en el grafo) |
| Tool: skill-extractor | `tools/skill-extractor.tool.ts` | ⚠️ Recibe LlmService, pero el factory no está implementado |
| Tool: job-matcher | `tools/job-matcher.tool.ts` | ✅ Funciona como clase standalone |
| Tool: llm-provider | `tools/llm-provider.tool.ts` | ❌ Probablemente TODO |
| LLM Factory | `modules/llm/llm-provider.factory.ts` | ❌ Los providers lanzan "Not implemented yet" |
| LLM Service | `modules/llm/llm.service.ts` | ⚠️ Estructura de fallback armada, pero delega en el factory vacío |

**Problema central:** El proyecto tiene la arquitectura pensada pero nadie conectó las piezas. El grafo existe pero no hace nada. Los nodos están vacíos. El LLM factory está vacío. Las tools funcionan pero flotan fuera del grafo.

---

## Mapa de aprendizaje

```
State → Nodes → Edges → Compile → Invoke
         ↓                             
    LLM Integration                   
         ↓                             
    Tools (tool calling)              
         ↓                             
    Checkpointing (persistence)       
         ↓                             
    Streaming                         
         ↓                             
    Human-in-the-loop (interrupts)    
```

Cada paso está diseñado para que aprendas **un concepto de LangGraph** y lo apliques inmediatamente al proyecto.

---

## Paso 1: Modelar el State con Annotation

### Qué hacer

Convertir la interfaz `RecruiterState` de TypeScript a un `Annotation.Root` de LangGraph. El state es la **memoria compartida** del grafo: todos los nodos lo leen y escriben aquí.

### Por qué

LangGraph usa `Annotation` (o `TypedDict` en Python) para definir el schema del state. Cada campo puede tener un **reducer** que controla cómo se acumulan los updates (appendar a una lista vs sobrescribir un valor, etc.). Sin esto, el grafo no puede compilar.

### Conceptos que debes aprender

- **`Annotation.Root`**: Define la forma del state del grafo.
- **Reducers**: Funciones que controlan cómo se combinan updates parciales de los nodos con el state existente. Por defecto, cada key se sobrescribe. Para listas (skills, errores, preguntas de entrevista) necesitás un reducer que **append**.
- **`MessagesState`**: Un state pre-armado de LangGraph que ya incluye `messages` con `add_messages` reducer. Podría servir si querés mantener un historial de conversación con el LLM dentro del grafo.

### Documentación

- [Graph API overview — State](https://docs.langchain.com/oss/python/langgraph/graph-api#state)
- [Use the graph API — Define and update state](https://docs.langchain.com/oss/python/langgraph/use-graph-api#define-and-update-state)
- [Reducers en profundidad](https://docs.langchain.com/oss/python/langgraph/graph-api#reducers)

### Resultado esperado

El archivo `state/recruiter.state.ts` debe exportar un `Annotation.Root` equivalente a la interfaz actual, con los reducers apropiados para campos acumulativos (`errors`, `warnings`, `interviewQuestions`, `strengths`, `weaknesses`, `redFlags`, `greenFlags`).

---

## Paso 2: Implementar Nodes reales

### Qué hacer

Reemplazar los 5 nodes placeholder (`parser`, `analyzer`, `matcher`, `scorer`, `feedback`) por funciones reales que:
- Reciban el state como primer parámetro
- Retornen un objeto parcial con los campos que quieren actualizar

### Por qué

En LangGraph, los nodes son **funciones puras** que reciben el state y devuelven updates. El framework se encarga de mergear esos updates en el state usando los reducers definidos en el Paso 1. No mutás el state directamente: devolvés un patch.

### Conceptos que debes aprender

- **Node functions**: Reciben `(state)` y retornan `Partial<State>`. Pueden ser síncronas o asíncronas.
- **Inmutabilidad**: Nunca modificar el state directamente. Siempre retornar un objeto con los cambios.
- **Reintentos (retry_policy)**: Podés configurar reintentos por nodo cuando llaman a un LLM que puede fallar.
- **Timeout por nodo**: Los nodes que llaman a LLMs deberían tener timeout.

### Documentación

- [Graph API overview — Nodes](https://docs.langchain.com/oss/python/langgraph/graph-api#nodes)
- [Use the graph API — Add retry policies](https://docs.langchain.com/oss/python/langgraph/use-graph-api#add-retry-policies)

### Resultado esperado

Cada node debe realizar su trabajo real:
- `parserNode`: Llama a `PdfExtractorTool.extractText()` y guarda `cvText` en el state
- `analyzerNode`: Analiza la job description (primero con regex/keywords, luego con LLM en el Paso 5)
- `matcherNode`: Usa `JobMatcherTool.matchSkills()` para comparar skills
- `scorerNode`: Calcula scores ponderados y genera recomendación
- `feedbackNode`: Genera preguntas de entrevista y feedback (placeholder aceptable por ahora)

---

## Paso 3: Conectar edges y compilar el grafo

### Qué hacer

Definir los edges del grafo:
- `START → parser`
- `parser → analyzer` (edge normal, siempre secuencial)
- `analyzer → matcher`
- `matcher → scorer`
- `scorer → feedback`
- `feedback → END`

Llamar a `workflow.compile()`.

### Por qué

Los edges definen el flujo. Los **edges normales** son determinísticos (siempre van al mismo node). Más adelante podrías usar **conditional edges** para, por ejemplo, re-evaluar si el score es muy bajo, o saltar a feedback si el CV está vacío.

Compilar es el paso que valida la estructura del grafo (que no haya nodos huérfanos, etc.) y lo prepara para ejecución.

### Conceptos que debes aprender

- **Edges normales**: `add_edge("node_a", "node_b")` — siempre van de A a B.
- **Conditional edges**: `add_conditional_edges("node_a", routing_function)` — eligen el próximo node según lógica.
- **`START` y `END`**: Nodos virtuales que marcan entrada y salida.
- **Compilación**: `compile()` valida y prepara. Recibe `checkpointer`, `store`, etc. (los veremos después).
- **Super-step**: LangGraph ejecuta en "superpasos" — nodes que se pueden paralelizar corren juntos en el mismo super-step.

### Documentación

- [Graph API overview — Edges](https://docs.langchain.com/oss/python/langgraph/graph-api#edges)
- [Graph API overview — Compiling your graph](https://docs.langchain.com/oss/python/langgraph/graph-api#compiling-your-graph)
- [Use the graph API — Create a sequence of steps](https://docs.langchain.com/oss/python/langgraph/use-graph-api#create-a-sequence-of-steps)

### Resultado esperado

El grafo compila sin errores y podés visualizarlo con `graph.get_graph().draw_mermaid_png()` (o imprimir la estructura). El flujo secuencial está funcionando end-to-end.

---

## Paso 4: Invocar el grafo y verificar ejecución

### Qué hacer

Crear un script de prueba (o un endpoint temporal) que invoque el grafo con un input de ejemplo y verifique que el state final tenga sentido.

### Por qué

Antes de integrar LLMs (que son lentos y costosos), necesitás confirmar que el grafo **funciona**: los nodos se ejecutan en orden, los updates se mergean correctamente, los reducers funcionan, y el state final tiene la forma esperada.

### Conceptos que debes aprender

- **`graph.invoke(input)`**: Ejecuta el grafo síncronamente y retorna el state final.
- **Input del grafo**: Es un objeto parcial que inicializa algunos campos del state (ej: `{ cvBuffer, jobDescription }`).
- **State final**: Es el resultado después de que todos los nodos ejecutaron.

### Documentación

- [Quickstart — Build and compile the agent](https://docs.langchain.com/oss/python/langgraph/quickstart)

### Resultado esperado

Podés ejecutar `graph.invoke({ cvBuffer: ..., jobDescription: "..." })` y obtener un state con `scores`, `recommendation`, `currentStep: "complete"` llenos con datos reales (aunque los scores sean basados en lógica simple todavía).

---

## Paso 5: Integrar LLMs en los nodes (prompt + structured output)

### Qué hacer

Implementar el `LlmProviderFactory` para que realmente instancie `ChatOpenAI` o `ChatGoogleGenerativeAI`. Luego, desde los nodes (especialmente `analyzerNode` y `feedbackNode`), llamar al LLM para:

- **Analyzer**: Extraer skills requeridas de la job description con structured output
- **Feedback**: Generar preguntas de entrevista personalizadas

### Por qué

Hasta ahora todo es lógica determinística (regex, keyword matching). El valor real del proyecto viene cuando el LLM **razona** sobre el CV y la descripción del puesto. LangGraph brilla cuando mezclás steps determinísticos (parsing, matching) con steps agenticos (LLM generando análisis).

### Conceptos que debes aprender

- **Chat models en LangChain**: `ChatOpenAI`, `ChatGoogleGenerativeAI` — cómo instanciarlos, configurar temperatura, etc.
- **Structured output**: `model.withStructuredOutput(schema)` o `zod` para forzar al LLM a devolver JSON con una forma específica. Acá entra `zod` (que ya está en package.json).
- **Prompt templates**: `ChatPromptTemplate` para construir prompts reutilizables.
- **Invocación dentro de un node**: Un node puede `await` una llamada al LLM porque LangGraph soporta nodes asíncronos.

### Documentación

- [LangGraph quickstart — Define model node](https://docs.langchain.com/oss/python/langgraph/quickstart)
- [Structured output con Zod](https://docs.langchain.com/oss/python/langgraph/use-graph-api) (buscar "structured" en la página)

### Resultado esperado

El `analyzerNode` ahora usa el LLM para extraer skills requeridas de la job description en vez de keyword matching básico. El `feedbackNode` genera preguntas personalizadas según el perfil del candidato y los gaps encontrados.

---

## Paso 6: Agregar herramientas (tools) al agente

### Qué hacer

Convertir las herramientas existentes (`PdfExtractorTool`, `SkillExtractorTool`, `JobMatcherTool`) en herramientas que el LLM puede **llamar dinámicamente** (tool calling). En vez de que el flujo sea totalmente determinístico, el agente decide qué tool usar según el contexto.

### Por qué

Este es el salto de un **workflow** a un **agente**. En un workflow, vos definís el orden de los pasos. En un agente, el LLM decide qué hacer next. LangGraph permite modelos híbridos: algunos pasos fijos (parsing) y otros controlados por el LLM (qué analizar, qué preguntar).

### Conceptos que debes aprender

- **Tools**: Funciones decoradas con `@tool` (Python) o definidas como objetos que el LLM puede invocar.
- **`model.bind_tools([tool1, tool2])`**: Conecta herramientas al modelo para que pueda llamarlas.
- **Tool node**: Un node especial que ejecuta las tool calls que el LLM solicitó.
- **Conditional routing**: Después del LLM, un conditional edge decide si hay que ejecutar tools o terminar.
- **Agent loop**: LLM → tool calls → tool node → LLM → ... → respuesta final.

### Documentación

- [Quickstart — Define tools and model](https://docs.langchain.com/oss/python/langgraph/quickstart)
- [Graph API overview — `Command` (return from tools)](https://docs.langchain.com/oss/python/langgraph/graph-api#return-from-tools)

### Resultado esperado

El agente puede decidir, por ejemplo, llamar a `extractSkills` si necesita más información del candidato, o llaman a `matchSkills` para comparar. El grafo ahora tiene un ciclo LLM ↔ tools.

---

## Paso 7: Checkpointing y persistencia

### Qué hacer

Compilar el grafo con `MemorySaver` (o `SqliteSaver` para desarrollo persistente). Cada ejecución del grafo queda identificada por un `thread_id`, y el state se guarda entre nodos.

### Por qué

El checkpointing te da:
1. **Persistencia**: Si el proceso se cae a mitad de ejecución, puede retomar desde el último checkpoint.
2. **Time travel**: Podés volver a un checkpoint anterior y re-ejecutar desde ahí.
3. **Human-in-the-loop**: Podés pausar el grafo y resumir después ( Paso 9).

### Conceptos que debes aprender

- **Checkpointer**: Interfaz que guarda snapshots del state. `InMemorySaver` (memoria, no persiste), `SqliteSaver` (archivo local), `PostgresSaver` (producción).
- **`thread_id`**: Identificador de una ejecución/conversación. Se pasa en el config: `{ configurable: { thread_id: "..." } }`.
- **State history**: Podés acceder a todos los snapshots de una ejecución.
- **Store vs Checkpointer**: El checkpointer guarda el state del grafo por thread. El store guarda datos cross-thread (preferencias de usuario, conocimiento compartido).

### Documentación

- [Persistence overview](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Checkpointers en detalle](https://docs.langchain.com/oss/python/langgraph/checkpointers)

### Resultado esperado

Cada evaluación de CV queda guardada con un `thread_id`. Podés re-ejecutar, inspeccionar el historial de una evaluación, y (más adelante) implementar "time travel" para ajustar resultados.

---

## Paso 8: Streaming de resultados

### Qué hacer

Exponer el grafo vía `stream` en vez de `invoke`. A medida que cada node completa, emitir el update al cliente (EventSource/WebSocket desde NestJS).

### Por qué

Evaluar un CV puede tardar 10-30 segundos (llamadas a PDF parsing + LLM). Con streaming, el usuario ve progreso en tiempo real: "parsing CV...", "analyzing skills...", "generating scores...". Mejora drásticamente la UX.

### Conceptos que debes aprender

- **`graph.stream(input, config)`**: Retorna un AsyncGenerator que emite updates.
- **Stream modes**: `"values"` (state completo cada step), `"updates"` (solo lo que cambió), `"events"` (todos los eventos).
- **`stream_mode`**: Controla qué información fluye al cliente.
- **LangGraph + NestJS**: Cóntectar el stream del grafo con `@Sse()` decorator de NestJS.

### Documentación

- [Streaming en LangGraph](https://docs.langchain.com/oss/python/langgraph/streaming)

### Resultado esperado

El endpoint `POST /recruiter/evaluate` retorna un Server-Sent Events stream que muestra el progreso de la evaluación en tiempo real, y finalmente el resultado completo.

---

## Paso 9: Human-in-the-loop con interrupts

### Qué hacer

Agregar un `interrupt()` antes de publicar el resultado final. Un revisor humano puede:
- Aprobar la recomendación
- Pedir re-evaluación
- Modificar el score manualmente

### Por qué

En reclutamiento, las decisiones automatizadas necesitan supervisión. LangGraph tiene soporte nativo para pausar la ejecución y esperar input humano. Esto se combina con el checkpointing (Paso 7): el grafo se pausa, se guarda el estado, y cuando el humano responde, continúa.

### Conceptos que debes aprender

- **`interrupt(value)`**: Pausa la ejecución del node y espera un valor.
- **`Command(resume="...")`**: Reanuda la ejecución con el valor provisto por el humano.
- **Validation del input humano**: Podés validar la respuesta antes de aceptarla.
- **Interrupts + Checkpointing**: Los interrupts requieren un checkpointer para guardar el state pausado.

### Documentación

- [Interrupts overview](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Graph API overview — `Command` (resume)](https://docs.langchain.com/oss/python/langgraph/graph-api#resume)

### Resultado esperado

El grafo evalúa al candidato, genera una recomendación, y **se pausa** antes de guardarla. Un endpoint `POST /recruiter/review/:jobId` permite al humano aprobar/rechazar/modificar. Al resumir, el grafo continúa y guarda el resultado final.

---

## Paso 10: Migrar el controlador NestJS para usar el grafo

### Qué hacer

Reemplazar la lógica secuencial en `RecruiterService.evaluateCandidate()` por `graph.invoke()` / `graph.stream()`. El controlador expone endpoints REST/SSE que delegan en el grafo.

### Por qué

La arquitectura actual tiene toda la lógica en un service con pasos manuales. El objetivo final es que el service sea un **wrapper** que inicializa el state, invoca el grafo, y retorna el resultado. El grafo se convierte en el cerebro.

### Conceptos que debes aprender

- **Separación de concerns**: NestJS maneja HTTP/validación/serialización. LangGraph maneja la lógica de negocio.
- **Dependency Injection**: El grafo compilado se puede tratar como un provider inyectable en NestJS.
- **State initialization**: Cómo mapear el input del endpoint (CV + job description) al state inicial del grafo.
- **Config por runtime**: Pasar `llmProvider` como config al invocar el grafo (sin meterlo en el state).

### Documentación

- [Graph API overview — Runtime context](https://docs.langchain.com/oss/python/langgraph/graph-api#runtime-context)

### Resultado esperado

`RecruiterService` es una capa fina que traduce HTTP → state inicial, invoca el grafo, y retorna el resultado. Toda la lógica vive en los nodes del grafo. Si mañana querés cambiar el scoring, tocás un node, no un service.

---

## Glosario de conceptos LangGraph

| Concepto | Qué es | Analogía |
|----------|--------|----------|
| **State** | Datos compartidos que fluyen entre nodos | Un documento que todos leen y editan |
| **Annotation** | Definición del schema del state | El formato del documento |
| **Reducer** | Cómo se mergean updates en una key del state | Regla de "append" vs "sobrescribir" |
| **Node** | Función que procesa y retorna updates | Una estación de trabajo en una línea de montaje |
| **Edge** | Conexión entre nodos (determinística o condicional) | La cinta transportadora |
| **Conditional Edge** | Edge que elige el próximo node según lógica | Un desvío en la cinta según el producto |
| **START / END** | Nodos virtuales de entrada/salida | Puerta de entrada y salida de la fábrica |
| **Compile** | Validar y preparar el grafo para ejecución | Encender la fábrica |
| **Invoke** | Ejecutar el grafo síncronamente | Procesar un lote completo |
| **Stream** | Ejecutar y emitir updates progresivamente | Ver la línea de producción en tiempo real |
| **Checkpointer** | Persiste el state entre nodos | Foto del estado de la fábrica en cada step |
| **Thread ID** | Identificador de una ejecución específica | Número de orden de producción |
| **Store** | Persistencia cross-thread | Base de conocimiento de la empresa |
| **Interrupt** | Pausar ejecución y esperar input humano | Botón de pausa en la línea |
| **Command** | Control primitivo para routing + updates | Instrucción del operador a la fábrica |
| **Tool** | Función que el LLM puede invocar | Herramienta que el operario elige usar |
| **Super-step** | Una iteración sobre los nodos activos | Un "tick" del reloj de la fábrica |
| **Message passing** | Mecanismo de comunicación entre nodos | Mensajes entre estaciones de trabajo |

---

## Recursos oficiales de LangGraph

| Recurso | URL |
|---------|-----|
| Overview | https://docs.langchain.com/oss/python/langgraph/overview |
| Quickstart | https://docs.langchain.com/oss/python/langgraph/quickstart |
| Graph API overview | https://docs.langchain.com/oss/python/langgraph/graph-api |
| Use the Graph API (práctico) | https://docs.langchain.com/oss/python/langgraph/use-graph-api |
| Functional API | https://docs.langchain.com/oss/python/langgraph/functional-api |
| Persistence | https://docs.langchain.com/oss/python/langgraph/persistence |
| Checkpointers | https://docs.langchain.com/oss/python/langgraph/checkpointers |
| Stores | https://docs.langchain.com/oss/python/langgraph/stores |
| Interrupts (human-in-the-loop) | https://docs.langchain.com/oss/python/langgraph/interrupts |
| Streaming | https://docs.langchain.com/oss/python/langgraph/streaming |
| Fault tolerance | https://docs.langchain.com/oss/python/langgraph/fault-tolerance |
| Backward compatibility | https://docs.langchain.com/oss/python/langgraph/backward-compatibility |
| Subgraphs | https://docs.langchain.com/oss/python/langgraph/use-subgraphs |
| Map-reduce con Send API | https://docs.langchain.com/oss/python/langgraph/use-graph-api#map-reduce-and-the-send-api |
| LangGraph JS/TS SDK | https://docs.langchain.com/langsmith/langgraph-js-ts-sdk |

---

## Consejos finales

1. **No saltear pasos.** El Paso 2 no funciona sin el Paso 1. El Paso 7 no tiene sentido sin el Paso 4.

2. **Probá en Node/islamiento primero.** Antes de integrar con NestJS, creá un script standalone (`npx ts-node test-graph.ts`) que pruebe el grafo. Más rápido feedback loop.

3. **Usá `draw_mermaid_png()` o `get_graph().print_ascii()`** para visualizar el grafo después de cada cambio. Ver la estructura ayuda a razonar.

4. **Empezá sin LLM.** Los Pasos 1-4 usan solo lógica determinística (las tools que ya existen). Así aprendés la mecánica de LangGraph sin el ruido de las llamadas a API.

5. **Activá LangSmith.** Si podés, configurá `LANGSMITH_TRACING=true` para ver trazas de cada ejecución. Es revelador para debuggear.

6. **El state es sagrado.** Si algo no funciona, probablemente sea un reducer mal definido o un update que no está llegando. Pone un `console.log` en cada node y compará el state antes/después.

7. **Leé el código fuente.** LangGraph es open source. Si la doc no te cierra, andá al repo en GitHub y mirá los ejemplos.
