import { Processor, WorkerHost } from "@nestjs/bullmq";
import { RecruiterQueues } from "../recruiter-queues.enum";
import { type Job } from "bullmq";

@Processor(RecruiterQueues.PDF_EXTRACTION)
export class PdfConsumer extends WorkerHost {
  process(job: Job) {

  }

}
