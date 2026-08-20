import { ExtractedPdf } from "src/db/types/extracted-pdf.types";


export interface IExtractedPdfRepository {
  save: ({ extractedText, pdfUrl, name }: { extractedText: string, pdfUrl: string, name: string }) => Promise<void>,
  deleteById: ({ id }: { id: string }) => Promise<void>,
  findById: ({ id }: { id: string }) => Promise<ExtractedPdf | null>,
  findAll: ({
    page, limit
  }: {
    page: number,
    limit: number
  }) => Promise<{
    items: ExtractedPdf[],
    total: number,
    page: number,
    totalPages: number
  }>,
  updateById: (extractedPdf: Partial<Omit<ExtractedPdf, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>
}

export const EXTRACTED_PDF_REPOSITORY = Symbol('IExtractedPdfRepository');
