import { Test, TestingModule } from '@nestjs/testing';
import { PdfExtractorTool } from './pdf-extractor.tool';

// Mock pdf-parse
jest.mock('pdf-parse', () => {
  return {
    PDFParse: jest.fn().mockImplementation(() => ({
      getText: jest.fn().mockResolvedValue({ text: 'Extracted PDF text content' }),
      getInfo: jest.fn().mockResolvedValue({
        info: { Title: 'Test CV', Author: 'John Doe' },
        total: 1,
      }),
    })),
  };
});

describe('PdfExtractorTool', () => {
  let tool: PdfExtractorTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfExtractorTool],
    }).compile();

    tool = module.get<PdfExtractorTool>(PdfExtractorTool);
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('extractText', () => {
    it('should extract text from PDF buffer', async () => {
      const mockBuffer = Buffer.from('test pdf content');
      const result = await tool.extractText(mockBuffer);
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text).toBe('Extracted PDF text content');
    });
  });
});