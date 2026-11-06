import { RecruiterState } from '../state/recruiter.state';
import { StateSteps } from '../types/recruiter-state.type';

export type NodeResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; step: StateSteps };

export async function handleNodeError<T>(
  step: StateSteps,
  fn: () => Promise<T>
): Promise<NodeResult<T>> {
  try {
    const data = await fn();
    return { success: true as const, data };
  } catch (err) {
    return {
      success: false as const,
      error: `${step} failed: ${err instanceof Error ? err.message : String(err)}`,
      step,
    };
  }
}

export function createErrorState(step: StateSteps, error: string): Partial<RecruiterState> {
  return {
    meta: {
      step: StateSteps.Error,
      errors: [error],
      warnings: [],
      processingTime: 0,
      timestamp: new Date(),
    },
  };
}