# LangGraph Placeholders Specification

## Purpose

LangGraph workflow skeleton with node definitions, routing logic, and placeholder implementations for the recruiting pipeline. All nodes contain TODO comments with clear implementation instructions.

## Requirements

### Requirement: Graph Definition

The system SHALL define a LangGraph `StateGraph` in `recruiter.graph.ts` with 5 nodes and conditional routing. The graph MUST compile successfully but contain placeholder node implementations.

#### Scenario: Graph compiles

- GIVEN the graph definition file with all 5 nodes registered
- WHEN the module loads
- THEN the graph compiles without errors
- AND the graph has nodes: `parser`, `analyzer`, `matcher`, `scorer`, `feedback`

#### Scenario: Graph routing defined

- GIVEN the compiled graph
- WHEN inspecting edges
- THEN edges define flow: `parser → analyzer → matcher → scorer → feedback`
- AND a conditional edge from `scorer` routes to `feedback` or `analyzer` based on score threshold

### Requirement: Parser Node Placeholder

The system SHALL define `parser.node.ts` with a `TODO` comment block describing: input (raw CV text), processing (text normalization, section detection), output (parsed CV structure).

#### Scenario: Parser node exists

- GIVEN the parser node file
- WHEN imported
- THEN it exports a node function that accepts state and returns `{ ...state, parsedCV: null }`
- AND contains a TODO comment with implementation instructions

#### Scenario: Parser receives input

- GIVEN state with `rawText: "CV content"`
- WHEN the parser node executes
- THEN it returns state unchanged (placeholder behavior)
- AND the TODO comment describes expected output structure

### Requirement: Analyzer Node Placeholder

The system SHALL define `analyzer.node.ts` with a `TODO` comment block describing: input (parsed CV), processing (LLM-based skill/experience analysis), output (candidate profile with structured skills).

#### Scenario: Analyzer node exists

- GIVEN the analyzer node file
- WHEN imported
- THEN it exports a node function that accepts state and returns `{ ...state, candidateProfile: null }`
- AND contains a TODO comment with implementation instructions

### Requirement: Matcher Node Placeholder

The system SHALL define `matcher.node.ts` with a `TODO` comment block describing: input (candidate profile + job description), processing (ChromaDB embedding lookup, cosine similarity), output (match score and gaps).

#### Scenario: Matcher node exists

- GIVEN the matcher node file
- WHEN imported
- THEN it exports a node function that accepts state and returns `{ ...state, matchResult: null }`
- AND contains a TODO comment with implementation instructions

### Requirement: Scorer Node Placeholder

The system SHALL define `scorer.node.ts` with a `TODO` comment block describing: input (match result), processing (weighted scoring algorithm), output (final score 0-100 and recommendation).

#### Scenario: Scorer node exists

- GIVEN the scorer node file
- WHEN imported
- THEN it exports a node function that accepts state and returns `{ ...state, score: 0, recommendation: "pending" }`
- AND contains a TODO comment describing score threshold routing logic

### Requirement: Feedback Node Placeholder

The system SHALL define `feedback.node.ts` with a `TODO` comment block describing: input (score, candidate profile, job requirements), processing (LLM-generated feedback), output (structured feedback with strengths, gaps, recommendation).

#### Scenario: Feedback node exists

- GIVEN the feedback node file
- WHEN imported
- THEN it exports a node function that accepts state and returns `{ ...state, feedback: null }`
- AND contains a TODO comment with implementation instructions

### Requirement: State Interface

The system SHALL define a `RecruiterState` TypeScript interface in `recruiter.state.ts` representing the graph's shared state. All node functions MUST accept and return this type.

#### Scenario: State type check

- GIVEN the `RecruiterState` interface
- WHEN a node function is defined
- THEN TypeScript enforces that input and output conform to `RecruiterState`
