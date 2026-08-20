import { ExtractedPdf } from "src/db/types/extracted-pdf.types";
import { IExtractedPdfRepository } from "../interfaces/extracted-pdf.repository.interface";


export class InMemoryExtractedPdfRepository implements IExtractedPdfRepository {

  private extractedPdfs: ExtractedPdf[] = [];

  async save({ extractedText, pdfUrl, name }: { extractedText: string; pdfUrl: string; name: string; }): Promise<void> {

    const newExtractedPdf: ExtractedPdf = {
      id: (Math.random() * 1000000).toString(),
      extractedText,
      pdfUrl,
      name,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.extractedPdfs.push(newExtractedPdf);
  }

  async findAll({ page, limit }: { page: number; limit: number; }): Promise<{ items: ExtractedPdf[]; total: number; page: number; totalPages: number; }> {
    const total = this.extractedPdfs.length;
    const totalPages = Math.ceil(total / limit);
    const items = this.extractedPdfs.slice((page - 1) * limit, page * limit);

    return { items, total, page, totalPages };
  }

  async deleteById({ id }: { id: string; }): Promise<void> {
    this.extractedPdfs = this.extractedPdfs.filter(pdf => pdf.id !== id);
  }

  async findById({ id }: { id: string; }): Promise<ExtractedPdf | null> {
    const pdf = this.extractedPdfs.find(pdf => pdf.id === id);
    return pdf || null;
  }

  async updateById(extractedPdf: Partial<Omit<ExtractedPdf, 'id' | 'createdAt' | 'updatedAt'>> & { id: string }): Promise<void> {
    const index = this.extractedPdfs.findIndex(pdf => pdf.id === extractedPdf.id);
    if (index !== -1) {
      this.extractedPdfs[index] = {
        ...this.extractedPdfs[index],
        ...extractedPdf,
        updatedAt: new Date()
      };
    }
  }

}
