/**
 * Parser Node — Extract and normalize CV text
 *
 * Responsibilities:
 * - Receive raw CV buffer from state
 * - Use pdf-parse to extract text content
 * - Clean and normalize whitespace
 * - Detect document sections (education, experience, skills, certifications)
 * - Store cleaned text in state.cvText
 *
 * TODO: Implement actual PDF parsing logic
 * TODO: Add section detection using regex patterns
 * TODO: Handle different CV formats (chronological, functional, combination)
 * TODO: Add metadata extraction (author, creation date)
 */
import { RunnableConfig } from '@langchain/core/runnables';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RecruiterState } from '../state/recruiter.state';
import { StateSteps } from '../types/recruiter-state.type';

export function parserNode(state: RecruiterState, config: RunnableConfig): Partial<RecruiterState> {
  const llm = config.configurable?.llm as BaseChatModel;
  console.log('[parser] TODO: Implement CV text extraction and normalization');
  return {
    cvText: state.cvText || '',
    currentStep: StateSteps.Analyzing,
  };
}