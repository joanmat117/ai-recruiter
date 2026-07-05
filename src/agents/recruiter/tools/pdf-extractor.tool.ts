import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

export interface PdfExtractionResult {
  text: string;
  metadata?: {
    title?: string;
    author?: string;
    creationDate?: Date;
  };
  pageCount: number;
}

@Injectable()
export class PdfExtractorTool {
  private readonly logger = new Logger(PdfExtractorTool.name);

  async extractText(buffer: Buffer): Promise<PdfExtractionResult> {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      const info = await parser.getInfo();
      
      const cleanedText = this.cleanText(textResult.text);
      
      return {
        text: cleanedText,
        metadata: {
          title: info.info?.Title,
          author: info.info?.Author,
          creationDate: info.info?.CreationDate ? new Date(info.info.CreationDate) : undefined,
        },
        pageCount: info.total,
      };
    } catch (error) {
      this.logger.error(`PDF extraction failed: ${error.message}`);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ +/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
