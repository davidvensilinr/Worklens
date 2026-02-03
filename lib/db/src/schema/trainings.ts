import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingCertificationsTable = pgTable("training_certifications", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  documentUrl: text("document_url").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  trainingHours: real("training_hours"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrainingCertificationSchema = createInsertSchema(trainingCertificationsTable).omit({ id: true, createdAt: true });
export type InsertTrainingCertification = z.infer<typeof insertTrainingCertificationSchema>;
export type TrainingCertification = typeof trainingCertificationsTable.$inferSelect;
