import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { RecruiterQueues } from "../recruiter-queues.enum";
import { type Job } from "bullmq";
import { PdfExtractorTool } from "../../tools/pdf-extractor.tool";
import { Inject, Logger } from "@nestjs/common";
import { EXTRACTED_PDF_REPOSITORY, type IExtractedPdfRepository } from "../../interfaces/extracted-pdf.repository.interface";

export type PdfJob = Job<{ url: string, name: string }, { text: string }>;

@Processor(RecruiterQueues.PDF_EXTRACTION)
export class PdfConsumer extends WorkerHost {

  private readonly logger = new Logger(PdfConsumer.name);

  constructor(
    private readonly pdfExtractorTool: PdfExtractorTool,
    @Inject(EXTRACTED_PDF_REPOSITORY)
    private readonly extractedPdfRepository: IExtractedPdfRepository
  ) {
    super()
  }

  async process(job: PdfJob) {

    const response = await fetch(job.data.url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/pdf',
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from ${job.data.url}: ${response.statusText}`);
    }

    const pdfBuffer = await response.arrayBuffer().then(arrayBuffer => Buffer.from(arrayBuffer));

    const result = await this.pdfExtractorTool.extractText(pdfBuffer)

    return {
      text: result.text
    }
  }

  @OnWorkerEvent("completed")
  onCompleted(job: PdfJob) {
    this.logger.log(`PDF ${job.id} extraction job completed for URL: ${job.data.url}`);

    this.extractedPdfRepository.save({
      extractedText: job.returnvalue.text,
      name: job.data.name,
      pdfUrl: job.data.url
    })

  }

}
