# CV Processing Specification

## Purpose

Extract and structure candidate information from PDF CVs, including text extraction, skill classification, and data normalization.

## Requirements

### Requirement: PDF Text Extraction

The system SHALL extract text content from PDF files using `pdf-parse`. Only text-based PDFs are supported; scanned/image PDFs MUST return a clear error.

#### Scenario: Valid text-based PDF

- GIVEN a PDF file containing text CV content
- WHEN the pdf-extractor tool processes it
- THEN it returns the extracted text as a string

#### Scenario: Scanned/image PDF

- GIVEN a PDF file containing only images (no extractable text)
- WHEN the pdf-extractor tool processes it
- THEN it throws a `PdfExtractionException` with message "Scanned PDFs are not supported"

#### Scenario: Corrupted PDF file

- GIVEN a file with `.pdf` extension but invalid PDF structure
- WHEN the pdf-extractor tool processes it
- THEN it throws a `PdfExtractionException` with message describing the parse error

### Requirement: Skill Extraction

The system SHALL use the LLM to extract and classify skills from CV text into three categories: hard skills, soft skills, and tools.

#### Scenario: Extract skills from CV text

- GIVEN extracted CV text mentioning "React, TypeScript, team leadership, Figma, agile methodology"
- WHEN the skill-extractor tool processes it
- THEN it returns `{"hard": ["React", "TypeScript"], "soft": ["team leadership", "agile methodology"], "tools": ["Figma"]}`

#### Scenario: Empty CV text

- GIVEN extracted CV text is empty or whitespace-only
- WHEN the skill-extractor tool processes it
- THEN it returns `{"hard": [], "soft": [], "tools": []}`

### Requirement: Candidate Data Structuring

The system SHALL structure raw CV text into a standardized `CandidateData` interface containing: name, email, phone, experience (years + entries), education, languages, certifications, and extracted skills.

#### Scenario: Complete CV data

- GIVEN a CV with name, contact info, 5 years experience, Bachelor's degree, English/Spanish, AWS certification
- WHEN the system structures the candidate data
- THEN it returns a `CandidateData` object with all fields populated correctly

#### Scenario: Partial CV data

- GIVEN a CV with only name and skills (no contact info or education)
- WHEN the system structures the candidate data
- THEN it returns a `CandidateData` object with present fields populated and absent fields as `null`

### Requirement: LLM-Assisted Extraction

The system SHALL use the configured LLM provider for skill extraction and data structuring. The extraction prompt MUST request structured JSON output.

#### Scenario: LLM returns valid JSON

- GIVEN the LLM processes a CV text extraction request
- WHEN the response is valid JSON matching the expected schema
- THEN the system parses and returns the structured data

#### Scenario: LLM returns invalid JSON

- GIVEN the LLM processes a CV text extraction request
- WHEN the response is not valid JSON
- THEN the system retries once with a stricter prompt
- AND if still invalid, returns a `LlmParsingException`
