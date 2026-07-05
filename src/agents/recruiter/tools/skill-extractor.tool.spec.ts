import { Test, TestingModule } from '@nestjs/testing';
import { SkillExtractorTool } from './skill-extractor.tool';
import { LlmService } from '../../../modules/llm/llm.service';

describe('SkillExtractorTool', () => {
  let tool: SkillExtractorTool;
  let llmService: LlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillExtractorTool,
        {
          provide: LlmService,
          useValue: {
            generateText: jest.fn(),
          },
        },
      ],
    }).compile();

    tool = module.get<SkillExtractorTool>(SkillExtractorTool);
    llmService = module.get<LlmService>(LlmService);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('extractSkills', () => {
    it('should return empty skills for empty text', async () => {
      const result = await tool.extractSkills('');
      expect(result.hard).toEqual([]);
      expect(result.soft).toEqual([]);
      expect(result.tools).toEqual([]);
    });

    it('should extract skills from CV text', async () => {
      (llmService.generateText as jest.Mock).mockResolvedValue({
        content: '{"hard":["JavaScript","TypeScript"],"soft":["Leadership"],"tools":["VS Code"]}',
      });

      const result = await tool.extractSkills('Experienced developer with JavaScript and TypeScript skills');
      expect(result.hard).toContain('JavaScript');
      expect(result.hard).toContain('TypeScript');
    });
  });
});