import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const extractedPdfs = pgTable('extracted_pdfs', {
  id: uuid('id').primaryKey().defaultRandom(),
  s3Key: varchar('s3_key', { length: 500 }).notNull().unique(),
  extractedText: text('extracted_text').notNull(),
  jobDescription: text('job_description').notNull(),
  jobTitle: varchar('job_title', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ExtractedPdf = typeof extractedPdfs.$inferSelect;
export type NewExtractedPdf = typeof extractedPdfs.$inferInsert;