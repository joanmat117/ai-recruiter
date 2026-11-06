/**
 * Matcher Node — Match candidate skills against job requirements
 *
 * Responsibilities:
 * - Receive candidate profile and job analysis from state
 * - Use JobMatcherTool to match skills, experience, education
 * - Store match results in state.match (MatchResult)
 *
 * Uses JobMatcherTool (injected via factory)
 * Uses handleNodeError for error handling (A7)
 * Immutability: returns new complete object (A9)
 */
import { RecruiterState } from '../state/recruiter.state';
import { StateSteps } from '../types/recruiter-state.type';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { CandidateProfile, JobAnalysis, MatchResult } from '../state/recruiter.state';
import { handleNodeError, createErrorState } from '../graph/node-error-handler';

export function createMatcherNode(jobMatcher: JobMatcherTool) {
  return async (state: RecruiterState): Promise<Partial<RecruiterState>> => {
    const candidate = state.candidate as CandidateProfile;
    const job = state.job as JobAnalysis;

    const result = await handleNodeError(StateSteps.Matching, async () => {
      if (!candidate || !job) {
        throw new Error('Missing candidate or job data');
      }

      // Match skills
      const skillMatch = await jobMatcher.matchSkills(
        candidate.skills,
        job.required.skills
      );

      // Calculate experience match
      const experienceMatch = calculateExperienceMatch(
        candidate.yearsOfExperience,
        job.required.yearsOfExperience
      );

      // Calculate education match
      const educationMatch = calculateEducationMatch(
        candidate.education,
        job.required.education
      );

      const matchResult: MatchResult = {
        score: skillMatch.matchPercentage,
        details: {
          skills: {
            matched: skillMatch.matched,
            missing: skillMatch.missing,
            score: skillMatch.matchPercentage,
          },
          experience: {
            score: experienceMatch.score,
            reasoning: experienceMatch.reasoning,
          },
          education: {
            score: educationMatch.score,
            reasoning: educationMatch.reasoning,
          },
        },
        strengths: [...skillMatch.matched],
        weaknesses: [...skillMatch.missing],
        redFlags: [],
        greenFlags: skillMatch.matched.length > 5 ? ['Strong skill alignment'] : [],
      };

      return matchResult;
    });

    if (!result.success) {
      return createErrorState(StateSteps.Matching, result.error);
    }

    // Objeto nuevo completo (A9)
    return {
      match: result.data,
      meta: {
        step: StateSteps.Matching,
        errors: [],
        warnings: [],
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  };
}

function calculateExperienceMatch(
  candidateYears: number,
  requiredYears: number
): { score: number; reasoning: string } {
  if (requiredYears === 0) {
    return { score: 100, reasoning: 'No experience required' };
  }
  const ratio = candidateYears / requiredYears;
  if (ratio >= 1) {
    return { score: 100, reasoning: `Meets requirement (${candidateYears}/${requiredYears} years)` };
  }
  if (ratio >= 0.75) {
    return { score: 75, reasoning: `Close to requirement (${candidateYears}/${requiredYears} years)` };
  }
  if (ratio >= 0.5) {
    return { score: 50, reasoning: `Partial experience (${candidateYears}/${requiredYears} years)` };
  }
  return { score: 25, reasoning: `Below requirement (${candidateYears}/${requiredYears} years)` };
}

function calculateEducationMatch(
  candidateEducation: CandidateProfile['education'],
  requiredEducation: string
): { score: number; reasoning: string } {
  if (!requiredEducation || requiredEducation.toLowerCase() === 'any') {
    return { score: 100, reasoning: 'No specific education required' };
  }
  const hasMatchingDegree = candidateEducation.some(
    (edu) =>
      edu.degree.toLowerCase().includes(requiredEducation.toLowerCase()) ||
      edu.field.toLowerCase().includes(requiredEducation.toLowerCase())
  );
  if (hasMatchingDegree) {
    return { score: 100, reasoning: `Matches required education: ${requiredEducation}` };
  }
  return {
    score: 50,
    reasoning: `Education mismatch. Required: ${requiredEducation}, Found: ${candidateEducation.map((e) => e.degree).join(', ') || 'None'}`,
  };
}