import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const evaluations = pgTable('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: varchar('job_id', { length: 255 }).notNull().unique(),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  cvText: text('cv_text').notNull(),
  jobDescription: text('job_description').notNull(),
  jobTitle: varchar('job_title', { length: 255 }),
  scores: jsonb('scores').notNull(),
  recommendation: jsonb('recommendation').notNull(),
  matchDetails: jsonb('match_details').notNull(),
  output: jsonb('output').notNull(),
  meta: jsonb('meta').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  // TODO Fase 5: relación con extracted_pdfs
}));

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;