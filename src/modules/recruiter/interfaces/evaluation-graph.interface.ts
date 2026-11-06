import { RecruiterInput, RecruiterOutput } from '../state/recruiter.state';
import { RunnableConfig } from '@langchain/core/runnables';

export interface IEvaluationGraph {
  invoke(input: RecruiterInput, config?: RunnableConfig): Promise<RecruiterOutput>;
  // Opcional para streaming futuro:
  // stream(input: RecruiterInput, config?: RunnableConfig): AsyncGenerator<Partial<RecruiterOutput>>;
}