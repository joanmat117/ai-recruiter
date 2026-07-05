import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PdfExtractorTool } from '../tools/pdf-extractor.tool';
import { SkillExtractorTool } from '../tools/skill-extractor.tool';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { LlmProviderTool } from '../tools/llm-provider.tool';
import { RecruiterState } from '../state/recruiter.state';

@Injectable()
export class RecruiterService {
  private readonly logger = new Logger(RecruiterService.name);
  private readonly jobStatuses: Map<string, RecruiterState> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly pdfExtractor: PdfExtractorTool,
    private readonly skillExtractor: SkillExtractorTool,
    private readonly jobMatcher: JobMatcherTool,
    private readonly llmProvider: LlmProviderTool,
  ) {}

  async evaluateCandidate(
    cvBuffer: Buffer,
    jobDescription: string,
    jobTitle?: string,
    llmProvider?: string,
  ): Promise<RecruiterState> {
    const startTime = Date.now();
    const jobId = this.generateJobId();

    this.logger.log(`Starting candidate evaluation: ${jobId}`);

    const initialState: RecruiterState = {
      cvBuffer,
      jobDescription,
      jobTitle,
      candidateSkills: { hard: [], soft: [], tools: [] },
      candidateExperience: { years: 0, summary: '', companies: [], roles: [] },
      candidateEducation: [],
      candidateLanguages: [],
      candidateCertifications: [],
      requiredSkills: [],
      preferredSkills: [],
      yearsExperienceRequired: 0,
      educationRequired: '',
      industryKeywords: [],
      skillMatch: { matched: [], missing: [], matchPercentage: 0 },
      experienceMatch: { meetsRequirement: false, yearsMatch: 0, relevanceScore: 0 },
      educationMatch: { meetsRequirement: false, relevancyScore: 0 },
      scores: { overall: 0, skills: 0, experience: 0, education: 0 },
      recommendation: 'reject',
      confidenceLevel: 0,
      reasoning: '',
      strengths: [],
      weaknesses: [],
      redFlags: [],
      greenFlags: [],
      interviewQuestions: [],
      feedbackForCandidate: '',
      currentStep: 'parsing',
      errors: [],
      warnings: [],
      processingTime: 0,
      timestamp: new Date(),
      llmProvider: (llmProvider as any) || this.configService.get('llm.provider', 'openai'),
    };

    try {
      // Step 1: Extract CV text
      this.logger.log(`[${jobId}] Parsing CV...`);
      const extraction = await this.pdfExtractor.extractText(cvBuffer);
      initialState.cvText = extraction.text;
      initialState.currentStep = 'analyzing';

      // Step 2: Extract skills
      this.logger.log(`[${jobId}] Extracting skills...`);
      const skills = await this.skillExtractor.extractSkills(extraction.text);
      initialState.candidateSkills = skills;
      initialState.currentStep = 'matching';

      // Step 3: Parse job description
      this.logger.log(`[${jobId}] Analyzing job description...`);
      const jobAnalysis = await this.analyzeJobDescription(jobDescription);
      initialState.requiredSkills = jobAnalysis.requiredSkills;
      initialState.preferredSkills = jobAnalysis.preferredSkills;
      initialState.yearsExperienceRequired = jobAnalysis.yearsExperienceRequired;
      initialState.educationRequired = jobAnalysis.educationRequired;

      // Step 4: Match skills
      this.logger.log(`[${jobId}] Matching skills...`);
      const allCandidateSkills = [
        ...skills.hard,
        ...skills.soft,
        ...skills.tools,
      ];
      const skillMatch = await this.jobMatcher.matchSkills(allCandidateSkills, jobAnalysis.requiredSkills);
      initialState.skillMatch = skillMatch;

      // Step 5: Calculate scores
      this.logger.log(`[${jobId}] Calculating scores...`);
      const scoreComponents = {
        skills: skillMatch.matchPercentage,
        experience: 70, // Placeholder - would need experience parsing
        education: 80,  // Placeholder - would need education parsing
      };
      const overallScore = this.jobMatcher.calculateOverallScore(scoreComponents);
      initialState.scores = {
        overall: overallScore,
        skills: scoreComponents.skills,
        experience: scoreComponents.experience,
        education: scoreComponents.education,
      };

      // Step 6: Generate recommendation
      initialState.recommendation = this.generateRecommendation(initialState.scores.overall);
      initialState.confidenceLevel = this.calculateConfidence(initialState);
      initialState.currentStep = 'complete';

    } catch (error) {
      this.logger.error(`[${jobId}] Evaluation failed: ${error.message}`);
      initialState.currentStep = 'error';
      initialState.errors.push(error.message);
    }

    initialState.processingTime = Date.now() - startTime;
    this.jobStatuses.set(jobId, initialState);

    return initialState;
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
