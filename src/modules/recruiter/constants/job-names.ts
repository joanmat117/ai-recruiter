export const PDF_JOBS = {
  EXTRACT_PDF: 'extract-pdf',
} as const;

export const AI_RECRUITER_JOBS = {
  EVALUATE_CANDIDATE: 'evaluate-candidate',
} as const;

export const QUEUE_NAMES = {
  PDF_EXTRACTION: 'pdf-extraction-queue',
  AI_RECRUITER: 'ai-recruiter-queue',
} as const;

export type QueueNames = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export type PdfJobs = (typeof PDF_JOBS)[keyof typeof PDF_JOBS];
export type AiRecruiterJobs = (typeof AI_RECRUITER_JOBS)[keyof typeof AI_RECRUITER_JOBS];