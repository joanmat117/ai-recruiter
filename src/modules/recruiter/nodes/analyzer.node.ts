/**
 * Analyzer Node — Analyze job description and extract requirements
 *
 * Responsibilities:
 * - Receive job description text from state
 * - Use LLM to extract required skills
 * - Parse years of experience requirement
 * - Identify preferred qualifications
 * - Store results in state.job (JobAnalysis)
 *
 * Uses AnalyzeJobDescriptionCall strategy (injected via factory)
 * Uses handleNodeError for error handling (A7)
 * Immutability: returns new complete object (A9)
 */
import { RecruiterState } from '../state/recruiter.state';
import { StateSteps } from '../types/recruiter-state.type';
import { AnalyzeJobDescriptionCall, JobAnalysis } from '../llm/structured-llm-calls';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createAnalyzerNode(analyzeJobCall: AnalyzeJobDescriptionCall) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const result = await handleNodeError(StateSteps.Analyzing, () =>
      analyzeJobCall.invoke({
        jobTitle: state.jobTitle,
        jobDescription: state.jobDescription,
      })
    );

    if (!result.success) {
      return createErrorState(StateSteps.Analyzing, result.error);
    }

    const jobAnalysis: JobAnalysis = result.data;

    // Inmutabilidad: objeto nuevo completo (A9)
    return {
      job: jobAnalysis,
      meta: {
        step: StateSteps.Analyzing,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}