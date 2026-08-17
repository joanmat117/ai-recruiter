import { Test, TestingModule } from '@nestjs/testing';
import { RecruiterController } from './recruiter.controller';
import { RecruiterService } from '../services/recruiter.service';

describe('RecruiterController', () => {
  let controller: RecruiterController;
  let service: RecruiterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecruiterController],
      providers: [
        {
          provide: RecruiterService,
          useValue: {
            evaluateCandidate: jest.fn(),
            evaluateBatch: jest.fn(),
            getJobStatus: jest.fn(),
            compareCandidates: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RecruiterController>(RecruiterController);
    service = module.get<RecruiterService>(RecruiterService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('evaluateCandidate', () => {
    it('should throw if no file uploaded', async () => {
      await expect(
        controller.evaluateCandidate(null as any, 'job description'),
      ).rejects.toThrow('CV file is required');
    });

    it('should throw if no job description', async () => {
      const mockFile = { buffer: Buffer.from('test') } as any;
      await expect(
        controller.evaluateCandidate(mockFile, ''),
      ).rejects.toThrow('Job description is required');
    });
  });

  describe('evaluateBatch', () => {
    it('should throw if no files uploaded', async () => {
      await expect(
        controller.evaluateBatch([], 'job description'),
      ).rejects.toThrow('At least one CV file is required');
    });
  });
});