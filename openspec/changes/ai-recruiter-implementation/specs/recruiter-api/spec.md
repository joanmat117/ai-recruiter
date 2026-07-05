# Recruiter API Specification

## Purpose

REST API endpoints for candidate evaluation, batch processing, comparison, interview question generation, and feedback within the recruiting workflow.

## Requirements

### Requirement: Evaluate Single Candidate

The system SHALL expose `POST /api/recruiter/evaluate` accepting multipart form data with a CV file (PDF) and a `jobDescription` text field. Returns a `CandidateEvaluation` with score, match result, and extracted candidate data.

#### Scenario: Successful evaluation

- GIVEN a valid PDF CV and job description text
- WHEN POST `/api/recruiter/evaluate` is called
- THEN it returns HTTP 201 with `{ candidateData, matchResult: { score, gaps, recommendation }, extractedSkills }`

#### Scenario: Missing CV file

- GIVEN no CV file in the multipart form
- WHEN POST `/api/recruiter/evaluate` is called
- THEN it returns HTTP 400 with `{"message":"CV file is required"}`

#### Scenario: Invalid file type

- GIVEN a `.docx` file instead of `.pdf`
- WHEN POST `/api/recruiter/evaluate` is called
- THEN it returns HTTP 400 with `{"message":"Only PDF files are accepted"}`

### Requirement: Batch Evaluation

The system SHALL expose `POST /api/recruiter/evaluate-batch` accepting multiple CV files and a job description. Returns an array of evaluations with a batch job ID for status tracking.

#### Scenario: Successful batch evaluation

- GIVEN 3 valid PDF CVs and a job description
- WHEN POST `/api/recruiter/evaluate-batch` is called
- THEN it returns HTTP 201 with `{ jobId, status: "processing", totalFiles: 3 }`

#### Scenario: Empty batch

- GIVEN no CV files in the request
- WHEN POST `/api/recruiter/evaluate-batch` is called
- THEN it returns HTTP 400 with `{"message":"At least one CV file is required"}`

### Requirement: Job Status Tracking

The system SHALL expose `GET /api/recruiter/status/:jobId` returning the current status and results of a batch evaluation job.

#### Scenario: Completed job

- GIVEN a batch job with ID `batch-123` that has completed
- WHEN GET `/api/recruiter/status/batch-123` is called
- THEN it returns `{ jobId, status: "completed", results: [...], completedAt: "..." }`

#### Scenario: In-progress job

- GIVEN a batch job with ID `batch-456` still processing
- WHEN GET `/api/recruiter/status/batch-456` is called
- THEN it returns `{ jobId, status: "processing", progress: { completed: 2, total: 5 } }`

#### Scenario: Unknown job ID

- GIVEN no job with ID `batch-999`
- WHEN GET `/api/recruiter/status/batch-999` is called
- THEN it returns HTTP 404 with `{"message":"Job not found"}`

### Requirement: Candidate Comparison

The system SHALL expose `POST /api/recruiter/compare` accepting multiple candidate IDs and a job description. Returns a ranked comparison with scores and recommendations.

#### Scenario: Compare two candidates

- GIVEN candidates `cand-1` and `cand-2` for a job description
- WHEN POST `/api/recruiter/compare` is called
- THEN it returns `{ rankings: [{candidateId, score, recommendation}], winner: "cand-1" }`

#### Scenario: Single candidate compare

- GIVEN only one candidate ID
- WHEN POST `/api/recruiter/compare` is called
- THEN it returns HTTP 400 with `{"message":"At least two candidates required for comparison"}`

### Requirement: Interview Question Generation

The system SHALL expose `POST /api/recruiter/interview-questions` accepting a job description and candidate data. Returns categorized interview questions.

#### Scenario: Generate questions

- GIVEN a job description and candidate profile
- WHEN POST `/api/recruiter/interview-questions` is called
- THEN it returns `{ technical: [...], behavioral: [...], culture_fit: [...] }`

### Requirement: Feedback Submission

The system SHALL expose `POST /api/recruiter/feedback` accepting evaluation ID and feedback data (rating, notes, recommendation). Stores feedback for future reference.

#### Scenario: Submit feedback

- GIVEN evaluation ID `eval-789` and feedback `{ rating: 4, notes: "Strong candidate", recommendation: "proceed" }`
- WHEN POST `/api/recruiter/feedback` is called
- THEN it returns HTTP 201 with `{ id, evaluationId, saved: true }`
