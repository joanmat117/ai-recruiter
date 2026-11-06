import { StateGraph } from '@langchain/langgraph';
import { BaseCheckpointSaver } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import {
  RecruiterStateAnnotation,
  RecruiterInputAnnotation,
  RecruiterOutputAnnotation,
} from '../state/recruiter.state';
import { createAnalyzerNode } from '../nodes/analyzer.node';
import { createMatcherNode } from '../nodes/matcher.node';
import { createScorerNode } from '../nodes/scorer.node';
import { createFeedbackNode } from '../nodes/feedback.node';
import { IEvaluationGraph } from '../interfaces/evaluation-graph.interface';
import { AnalyzeJobDescriptionCall, GenerateFeedbackCall } from '../llm/structured-llm-calls';
import { ScoringPolicy } from '../policies/scoring.policy';

/**
 * Creates the evaluation graph with injected dependencies.
 * Flow: analyzer → matcher → scorer → feedback → END
 */
export function createEvaluationGraph(
  llm: BaseChatModel,
  jobMatcher: JobMatcherTool,
  analyzeJobCall: AnalyzeJobDescriptionCall,
  generateFeedbackCall: GenerateFeedbackCall,
  scoringPolicy: ScoringPolicy,
  checkpointer?: BaseCheckpointSaver
): IEvaluationGraph {
  const workflow = new StateGraph(RecruiterStateAnnotation, {
    input: RecruiterInputAnnotation,
    output: RecruiterOutputAnnotation,
  })
    .addNode('analyzer', createAnalyzerNode(analyzeJobCall))
    .addNode('matcher', createMatcherNode(jobMatcher))
    .addNode('scorer', createScorerNode(jobMatcher, scoringPolicy))
    .addNode('feedback', createFeedbackNode(generateFeedbackCall))
    .addEdge('__start__', 'analyzer')
    .addEdge('analyzer', 'matcher')
    .addEdge('matcher', 'scorer')
    .addEdge('scorer', 'feedback')
    .addEdge('feedback', '__end__');

  return workflow.compile({ checkpointer });
}