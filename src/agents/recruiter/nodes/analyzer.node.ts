/**
 * Analyzer Node — Analyze job description and extract requirements
 *
 * Responsibilities:
 * - Receive job description text from state
 * - Use LLM to extract required skills
 * - Parse years of experience requirement
 * - Identify preferred qualifications
 * - Store results in state.requiredSkills, state.preferredSkills, etc.
 *
 * TODO: Implement LLM-based job description analysis
 * TODO: Add skill normalization (e.g., "JS" → "JavaScript")
 * TODO: Parse salary range if available
 * TODO: Extract industry keywords
 */
import { RunnableConfig } from '@langchain/core/runnables';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RecruiterState } from '../state/recruiter.state';
import { StateSteps } from '../types/recruiter-state.type';

export function analyzerNode(state: RecruiterState, config: RunnableConfig): Partial<RecruiterState> {
  const llm = config.configurable?.llm as BaseChatModel;
  console.log('[analyzer] TODO: Implement job description analysis');
  return {
    requiredSkills: [],
    preferredSkills: [],
    yearsExperienceRequired: 0,
    educationRequired: '',
    currentStep: StateSteps.Matching,
  };
}