/**
 * Scorer Node — Calculate compatibility scores and generate recommendation
 *
 * Responsibilities:
 * - Receive match results from state
 * - Calculate weighted scores using ScoringPolicy (skills 50%, experience 30%, education 20%)
 * - Generate recommendation based on score thresholds (ADVANCE, REVIEW, REJECT)
 * - Calculate confidence level
 * - Store results in state.scores, state.recommendation
 *
 * Uses ScoringPolicy (injected via factory) and JobMatcherTool for calculateOverallScore
 * Uses handleNodeError for error handling (A7)
 * Immutability: returns new complete object (A9)
 */
import { RecruiterState } from '../state/recruiter.state';
import { StateSteps } from '../types/recruiter-state.type';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { ScoringPolicy, RecommendationDecision } from '../policies/scoring.policy';
import { MatchResult } from '../state/recruiter.state';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createScorerNode(
  jobMatcher: JobMatcherTool,
  scoringPolicy: ScoringPolicy
) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const result = await handleNodeError(StateSteps.Scoring, async () => {
      const match = state.match as MatchResult;

      if (!match) {
        throw new Error('No match data available');
      }

      const skillsScore = match.details.skills.score;

      const candidateYears = state.candidate?.yearsOfExperience || 0;
      const requiredYears = state.job?.required?.yearsOfExperience || 0;
      const experienceScore = requiredYears > 0
        ? Math.min(100, Math.round((candidateYears / requiredYears) * 100))
        : 50;
      const expReasoning = requiredYears > 0
        ? `Candidato: ${candidateYears} años, Requerido: ${requiredYears} años`
        : 'No se especificó experiencia requerida';

      const reqEdu = (state.job?.required?.education || '').toLowerCase();
      const candEdu = state.candidate?.education?.map(e => e.degree.toLowerCase()).join(' ') || '';
      const eduHierarchy = { phd: 4, master: 3, bachelor: 2, degree: 1 };
      const reqLevel = eduHierarchy[reqEdu as keyof typeof eduHierarchy] || 1;
      const candLevel = Math.max(...(state.candidate?.education?.map(e =>
        eduHierarchy[e.degree.toLowerCase() as keyof typeof eduHierarchy] || 0) || [0]));
      const educationScore = candLevel >= reqLevel ? 100 : Math.round((candLevel / reqLevel) * 100);
      const eduReasoning = `Requerido: ${reqEdu || 'cualquiera'}, Candidato nivel: ${candLevel}`;

      // Usar Policy inyectable para overall (A6)
      const overall = scoringPolicy.calculateOverall({
        skills: skillsScore,
        experience: experienceScore,
        education: educationScore,
      });

      const decision = scoringPolicy.decide(overall);

      return {
        overall,
        skillsScore,
        experienceScore,
        educationScore,
        expReasoning,
        eduReasoning,
        decision,
      };
    });

    if (!result.success) {
      return createErrorState(StateSteps.Scoring, result.error);
    }

    const { overall, skillsScore, experienceScore, educationScore, expReasoning, eduReasoning, decision } = result.data;

    // Objeto nuevo completo (A9)
    return {
      scores: { overall, skills: skillsScore, experience: experienceScore, education: educationScore },
      recommendation: {
        decision,
        confidence: 80, // TODO: calcular basado en completitud
        reasoning: `Score ${overall}/100 (skills: ${skillsScore}, exp: ${experienceScore}, edu: ${educationScore})`,
      },
      match: {
        // Spread shallow OK porque reemplazamos details completo
        ...state.match,
        details: {
          skills: state.match?.details?.skills || { matched: [], missing: [], score: 0 },
          experience: { score: experienceScore, reasoning: expReasoning },
          education: { score: educationScore, reasoning: eduReasoning },
        },
      },
      meta: {
        step: StateSteps.Scoring,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}