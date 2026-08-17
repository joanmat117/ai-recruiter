import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RecruiterService } from './recruiter.service';
import { PdfExtractorTool } from '../tools/pdf-extractor.tool';
import { SkillExtractorTool } from '../tools/skill-extractor.tool';
import { JobMatcherTool } from '../tools/job-matcher.tool';
import { LlmProviderTool } from '../tools/llm-provider.tool';

describe('RecruiterService', () => {
  let service: RecruiterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecruiterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          },
        },
        {
          provide: PdfExtractorTool,
          useValue: {
            extractText: jest.fn().mockResolvedValue({ text: 'mock cv text', pageCount: 1 }),
          },
        },
        {
          provide: SkillExtractorTool,
          useValue: {
            extractSkills: jest.fn().mockResolvedValue({ hard: ['JavaScript'], soft: [], tools: [] }),
          },
        },
        {
          provide: JobMatcherTool,
          useValue: {
            matchSkills: jest.fn().mockResolvedValue({ matched: ['javascript'], missing: [], matchPercentage: 100 }),
            calculateOverallScore: jest.fn().mockReturnValue(85),
          },
        },
        {
          provide: LlmProviderTool,
          useValue: {
            generateText: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecruiterService>(RecruiterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateCandidate', () => {
    it('should return evaluation result', async () => {
      const result = await service.evaluateCandidate(
        Buffer.from('test'),
        'Job description',
        'Developer',
      );
      expect(result).toBeDefined();
      expect(result.currentStep).toBe('complete');
      expect(result.scores).toBeDefined();
    });
  });

  describe('compareCandidates', () => {
    it('should rank candidates by score', async () => {
      const evaluations = [
        { scores: { overall: 70 } },
        { scores: { overall: 90 } },
        { scores: { overall: 80 } },
      ] as any[];

      const result = await service.compareCandidates(evaluations);
      expect(result.rankings[0].score).toBe(90);
      expect(result.rankings[1].score).toBe(80);
      expect(result.rankings[2].score).toBe(70);
    });
  });
});