import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingProgramsTable = pgTable("training_programs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  durationHours: real("duration_hours"),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrainingProgramSchema = createInsertSchema(trainingProgramsTable).omit({ id: true, createdAt: true });
export type InsertTrainingProgram = z.infer<typeof insertTrainingProgramSchema>;
export type TrainingProgram = typeof trainingProgramsTable.$inferSelect;

export const trainingsTable = pgTable("trainings", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id").notNull(),
  programId: integer("program_id").notNull(),
  status: text("status").notNull().default("enrolled"),
  isAssigned: boolean("is_assigned").notNull().default(false),
  score: real("score"),
  hoursSpent: real("hours_spent"),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertTrainingSchema = createInsertSchema(trainingsTable).omit({ id: true, enrolledAt: true });
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type Training = typeof trainingsTable.$inferSelect;
