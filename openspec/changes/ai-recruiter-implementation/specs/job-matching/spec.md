# Job Matching Specification

## Purpose

Semantic matching of candidate profiles against job requirements using ChromaDB embeddings, with scoring, gap analysis, and multi-tenancy support.

## Requirements

### Requirement: Semantic Embedding Storage

The system SHALL store candidate and job description embeddings in ChromaDB. Each document MUST include metadata: candidate ID or job ID, department, timestamp.

#### Scenario: Store candidate embedding

- GIVEN a candidate profile with extracted skills and experience
- WHEN the system generates an embedding and stores it
- THEN ChromaDB contains a document with the embedding vector and metadata `{"type":"candidate","department":"engineering"}`

#### Scenario: Store job description embedding

- GIVEN a job description with requirements
- WHEN the system generates an embedding and stores it
- THEN ChromaDB contains a document with the embedding vector and metadata `{"type":"job","department":"engineering"}`

### Requirement: Cosine Similarity Scoring

The system SHALL compute cosine similarity between candidate and job embeddings to produce a compatibility score from 0.0 to 1.0.

#### Scenario: Strong match

- GIVEN a candidate with "5 years React, TypeScript" and a job requiring "React, TypeScript, 3+ years"
- WHEN the system computes similarity
- THEN the score is ≥ 0.75

#### Scenario: Weak match

- GIVEN a candidate with "Java, Spring Boot" and a job requiring "React, TypeScript"
- WHEN the system computes similarity
- THEN the score is ≤ 0.3

### Requirement: Gap Identification

The system SHALL identify specific gaps between a candidate's profile and job requirements. Gaps MUST be categorized as: missing skills, insufficient experience, missing certifications.

#### Scenario: Skill gap detected

- GIVEN a job requiring "Kubernetes, Docker" and a candidate with "Docker" only
- WHEN the system identifies gaps
- THEN it returns `{"missing_skills": ["Kubernetes"], "category": "skill"}`

#### Scenario: No gaps

- GIVEN a candidate meeting all job requirements
- WHEN the system identifies gaps
- THEN it returns `{"missing_skills": [], "experience_gaps": [], "certification_gaps": []}`

### Requirement: Multi-Tenancy by Department

The system SHALL isolate embeddings by department using ChromaDB collection naming. Collections MUST follow the pattern `recruiter_{department}`.

#### Scenario: Department isolation

- GIVEN candidates in "engineering" and "marketing" departments
- WHEN the system searches for matches in "engineering"
- THEN only "engineering" candidates are returned
- AND "marketing" candidates are not included

#### Scenario: New department auto-creates collection

- GIVEN no collection exists for "design" department
- WHEN a candidate from "design" is stored
- THEN a new collection `recruiter_design` is created automatically

### Requirement: Match Result Structure

The system SHALL return a `MatchResult` containing: candidate ID, job ID, score, matched skills, gap list, and recommendation (strong_match / potential_match / weak_match).

#### Scenario: Strong match recommendation

- GIVEN a match score ≥ 0.75 and no critical gaps
- WHEN the system generates the result
- THEN recommendation is `strong_match`

#### Scenario: Weak match recommendation

- GIVEN a match score ≤ 0.3 or more than 3 critical gaps
- WHEN the system generates the result
- THEN recommendation is `weak_match`
