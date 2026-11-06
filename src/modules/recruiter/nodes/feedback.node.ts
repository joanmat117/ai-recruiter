/**
 * Feedback Node — Generate feedback and interview questions
 *
 * Responsibilities:
 * - Receive scoring results, match, candidate profile from state
 * - Use GenerateFeedbackCall strategy to generate personalized feedback
 * - Generate relevant interview questions based on gaps
 * - Identify next steps for the hiring process
 * - Store results in state.output
 *
 * Uses GenerateFeedbackCall strategy (injected via factory)
 * Uses handleNodeError for error handling (A7)
 * Immutability: returns new complete object (A9)
 */
import { RecruiterState } from '../state/recruiter.state';
import { StateSteps } from '../types/recruiter-state.type';
import { GenerateFeedbackCall, FeedbackInput, FeedbackOutput } from '../llm/structured-llm-calls';
import { CandidateProfile, JobAnalysis, MatchResult, Recommendation } from '../state/recruiter.state';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createFeedbackNode(generateFeedbackCall: GenerateFeedbackCall) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const input: FeedbackInput = {
      candidateProfile: JSON.stringify(state.candidate),
      jobAnalysis: JSON.stringify(state.job),
      matchResult: JSON.stringify(state.match),
      scores: JSON.stringify(state.scores),
      recommendation: JSON.stringify(state.recommendation),
    };

    const result = await handleNodeError(StateSteps.Feedback, () =>
      generateFeedbackCall.invoke(input)
    );

    if (!result.success) {
      return createErrorState(StateSteps.Feedback, result.error);
    }

    const feedback: FeedbackOutput = result.data;

    return {
      output: {
        interviewQuestions: feedback.interviewQuestions,
        feedbackForCandidate: feedback.feedbackForCandidate,
        nextSteps: feedback.nextSteps,
        salarySuggestion: feedback.salarySuggestion,
      },
      meta: {
        step: StateSteps.Complete,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}