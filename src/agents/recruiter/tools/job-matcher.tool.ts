import { Injectable, Logger } from '@nestjs/common';

export interface MatchResult {
  matched: string[];
  missing: string[];
  matchPercentage: number;
}

@Injectable()
export class JobMatcherTool {
  private readonly logger = new Logger(JobMatcherTool.name);

  async matchSkills(candidateSkills: string[], requiredSkills: string[]): Promise<MatchResult> {
    const normalizedCandidate = candidateSkills.map(s => s.toLowerCase().trim());
    const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());

    const matched: string[] = [];
    const missing: string[] = [];

    for (const skill of normalizedRequired) {
      const isMatch = normalizedCandidate.some(cs => 
        cs.includes(skill) || skill.includes(cs)
      );
      if (isMatch) {
        matched.push(skill);
      } else {
        missing.push(skill);
      }
    }

    const matchPercentage = requiredSkills.length > 0
      ? Math.round((matched.length / requiredSkills.length) * 100)
      : 0;

    return { matched, missing, matchPercentage };
  }

  calculateOverallScore(scores: {
    skills: number;
    experience: number;
    education: number;
  }): number {
    const weights = { skills: 0.5, experience: 0.3, education: 0.2 };
    return Math.round(
      scores.skills * weights.skills +
      scores.experience * weights.experience +
      scores.education * weights.education
    );
  }
}
