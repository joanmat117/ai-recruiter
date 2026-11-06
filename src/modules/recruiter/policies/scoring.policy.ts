import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ScoringWeights {
  skills: number;
  experience: number;
  education: number;
}

export interface ScoringThresholds {
  advance: number;
  review: number;
  reject: number;
}

export type RecommendationDecision = 'ADVANCE' | 'REVIEW' | 'REJECT';

@Injectable()
export class ScoringPolicy {
  private readonly weights: ScoringWeights;
  private readonly thresholds: ScoringThresholds;

  constructor(configService: ConfigService) {
    this.weights = {
      skills: configService.get<number>('SCORING_WEIGHT_SKILLS') ?? 0.5,
      experience: configService.get<number>('SCORING_WEIGHT_EXPERIENCE') ?? 0.3,
      education: configService.get<number>('SCORING_WEIGHT_EDUCATION') ?? 0.2,
    };
    this.thresholds = {
      advance: configService.get<number>('SCORING_THRESHOLD_ADVANCE') ?? 85,
      review: configService.get<number>('SCORING_THRESHOLD_REVIEW') ?? 50,
      reject: configService.get<number>('SCORING_THRESHOLD_REJECT') ?? 0,
    };
  }

  getWeights(): ScoringWeights {
    return this.weights;
  }

  getThresholds(): ScoringThresholds {
    return this.thresholds;
  }

  decide(overallScore: number): RecommendationDecision {
    if (overallScore >= this.thresholds.advance) return 'ADVANCE';
    if (overallScore >= this.thresholds.review) return 'REVIEW';
    return 'REJECT';
  }

  calculateOverall(partial: { skills: number; experience: number; education: number }): number {
    return Math.round(
      partial.skills * this.weights.skills +
        partial.experience * this.weights.experience +
        partial.education * this.weights.education
    );
  }
}