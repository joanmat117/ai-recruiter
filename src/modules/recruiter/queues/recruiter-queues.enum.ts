import { QUEUE_NAMES } from '../constants/job-names';

export const RecruiterQueues = {
  PDF_EXTRACTION: QUEUE_NAMES.PDF_EXTRACTION,
  AI_RECRUITER: QUEUE_NAMES.AI_RECRUITER,
} as const;

export type RecruiterQueues = (typeof RecruiterQueues)[keyof typeof RecruiterQueues];