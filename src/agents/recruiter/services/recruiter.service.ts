import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PdfExtractorTool } from '../tools/pdf-extractor.tool';
import { SkillExtractorTool } from '../tools/skill-extractor.tool';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { LlmProviderTool } from '../tools/llm-provider.tool';
import { RecruiterState } from '../state/recruiter.state';
import recruiterGraph from '../graph/recruiter.graph';

@Injectable()
export class RecruiterService {
  private readonly logger = new Logger(RecruiterService.name);
  private readonly jobStatuses: Map<string, RecruiterState> = new Map();

  async evaluateCandidate(
    cvBuffer: Buffer,
    jobDescription: string,
    jobTitle: string,
    llmProvider?: string,
  ): Promise<RecruiterState> {
    this.logger.log(`Starting candidate evaluation: ${jobId}`);


    recruiterGraph.invoke({
      cvBuffer,
      jobDescription,
      jobTitle,
    }, {
    })
  }

  async evaluateBatch(
    cvBuffers: Buffer[],
    jobDescription: string,
    jobTitle?: string,
    llmProvider?: string,
  ): Promise<{ jobId: string; status: string }[]> {
    const results: { jobId: string; status: string }[] = [];

    for (const cvBuffer of cvBuffers) {
      try {
        const result = await this.evaluateCandidate(cvBuffer, jobDescription, jobTitle, llmProvider);
        results.push({
          jobId: this.generateJobId(),
          status: result.currentStep === 'complete' ? 'completed' : 'failed',
        });
      } catch (error) {
        results.push({
          jobId: this.generateJobId(),
          status: 'failed',
        });
      }
    }

    return results;
  }

  async reEvaluate(
    jobId: string,
    llmProvider: string,
  ): Promise<RecruiterState | null> {
    const existing = this.jobStatuses.get(jobId);
    if (!existing || !existing.cvBuffer) {
      return null;
    }

    return this.evaluateCandidate(
      existing.cvBuffer,
      existing.jobDescription || '',
      existing.jobTitle,
      llmProvider,
    );
  }

  async compareCandidates(
    evaluations: RecruiterState[],
  ): Promise<{
    rankings: Array<{
      rank: number;
      jobId: string;
      score: number;
      recommendation: string;
      strengths: string[];
    }>;
    summary: string;
  }> {
    const sorted = [...evaluations].sort((a, b) => b.scores.overall - a.scores.overall);

    const rankings = sorted.map((eval_, index) => ({
      rank: index + 1,
      jobId: `job-${index}`,
      score: eval_.scores.overall,
      recommendation: eval_.recommendation,
      strengths: eval_.strengths,
    }));

    return {
      rankings,
      summary: `Top candidate scored ${rankings[0]?.score || 0}/100 with recommendation: ${rankings[0]?.recommendation || 'N/A'}`,
    };
  }

  getJobStatus(jobId: string): RecruiterState | undefined {
    return this.jobStatuses.get(jobId);
  }

  private async analyzeJobDescription(jobDescription: string) {
    // Simple parsing - in production would use LLM
    return {
      requiredSkills: this.extractSkillsFromText(jobDescription),
      preferredSkills: [],
      yearsExperienceRequired: this.extractYearsFromText(jobDescription),
      educationRequired: this.extractEducationFromText(jobDescription),
    };
  }

  private extractSkillsFromText(text: string): string[] {
    const skillKeywords = ['javascript', 'typescript', 'python', 'java', 'react', 'node', 'nestjs', 'angular', 'vue', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'sql', 'mongodb', 'postgresql', 'redis', 'graphql', 'rest', 'api'];
    return skillKeywords.filter(skill => text.toLowerCase().includes(skill));
  }

  private extractYearsFromText(text: string): number {
    const match = text.match(/(\d+)\+?\s*years?/i);
    return match ? parseInt(match[1]) : 3;
  }

  private extractEducationFromText(text: string): string {
    if (text.toLowerCase().includes('bachelor')) return 'Bachelor\'s degree';
    if (text.toLowerCase().includes('master')) return 'Master\'s degree';
    if (text.toLowerCase().includes('phd')) return 'PhD';
    return 'Any';
  }

  private generateRecommendation(score: number): RecruiterState['recommendation'] {
    if (score >= 85) return 'strong_hire';
    if (score >= 70) return 'hire';
    if (score >= 50) return 'consider';
    return 'reject';
  }

  private calculateConfidence(state: RecruiterState): number {
    let confidence = 0.5;
    if (state.cvText && state.cvText.length > 100) confidence += 0.2;
    if (state.candidateSkills.hard.length > 0) confidence += 0.1;
    if (state.skillMatch.matchPercentage > 0) confidence += 0.1;
    return Math.min(confidence, 1);
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
