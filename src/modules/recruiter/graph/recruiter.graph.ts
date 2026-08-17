import { StateGraph } from '@langchain/langgraph';
import { RecruiterInputAnnotation, RecruiterOutputAnnotation, RecruiterStateAnnotation } from '../state/recruiter.state';
import { parserNode } from '../nodes/parser.node';
import { analyzerNode } from '../nodes/analyzer.node';
import { matcherNode } from '../nodes/matcher.node';
import { scorerNode } from '../nodes/scorer.node';
import { feedbackNode } from '../nodes/feedback.node';

/**
 * Recruiter Graph — Multi-agent pipeline for candidate evaluation
 *
 * This graph orchestrates the following nodes:
 * 1. parser — Extract and normalize CV text
 * 2. analyzer — Analyze job description and extract requirements
 * 3. matcher — Match candidate skills against job requirements
 * 4. scorer — Calculate compatibility scores
 * 5. feedback — Generate feedback and interview questions
 *
 * Flow: parser → analyzer → matcher → scorer → feedback → END
 *
 * TODO: Add error handling and retry logic
 * TODO: Integrate with ChromaDB for vector search
 */

// Create the graph
const workflow = new StateGraph(RecruiterStateAnnotation, {
  input: RecruiterInputAnnotation,
  output: RecruiterOutputAnnotation
})
  .addNode('parser', parserNode)
  .addNode('analyzer', analyzerNode)
  .addNode('matcher', matcherNode)
  .addNode('scorer', scorerNode)
  .addNode('feedback', feedbackNode)
  .addEdge('__start__', 'parser')
  .addEdge('parser', 'analyzer')
  .addEdge('analyzer', 'matcher')
  .addEdge('matcher', 'scorer')
  .addEdge('scorer', 'feedback')
  .addEdge('feedback', '__end__');

// Compile the graph
export const recruiterGraph = workflow.compile();

export default recruiterGraph;
