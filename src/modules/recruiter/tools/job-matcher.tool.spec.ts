import { Test, TestingModule } from '@nestjs/testing';
import { JobMatcherTool } from './job-matcher.tool';

describe('JobMatcherTool', () => {
  let tool: JobMatcherTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobMatcherTool],
    }).compile();

    tool = module.get<JobMatcherTool>(JobMatcherTool);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('matchSkills', () => {
    it('should match exact skills', async () => {
      const result = await tool.matchSkills(['javascript', 'react'], ['javascript', 'react']);
      expect(result.matchPercentage).toBe(100);
      expect(result.matched).toHaveLength(2);
    });

    it('should identify missing skills', async () => {
      const result = await tool.matchSkills(['javascript'], ['javascript', 'react']);
      expect(result.matchPercentage).toBe(50);
      expect(result.missing).toContain('react');
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate weighted score', () => {
      const score = tool.calculateOverallScore({ skills: 80, experience: 70, education: 90 });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});