import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { LlmProviderFactory } from './llm-provider.factory';

describe('LlmService', () => {
  let service: LlmService;
  let factory: LlmProviderFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: LlmProviderFactory,
          useValue: {
            createProvider: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'llm.provider') return 'openai';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    factory = module.get<LlmProviderFactory>(LlmProviderFactory);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateText', () => {
    it('should return text from primary provider', async () => {
      const mockProvider = {
        generateText: jest.fn().mockResolvedValue({ content: 'test response' }),
      };
      (factory.createProvider as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.generateText('test prompt');
      expect(result.content).toBe('test response');
    });
  });
});