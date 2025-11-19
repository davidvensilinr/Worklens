import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  projectId: integer("project_id"),
  meetingId: integer("meeting_id"),
  assigneeId: integer("assignee_id"),
  assignerId: integer("assigner_id"),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("assigned"),
  deadline: timestamp("deadline", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifierId: integer("verifier_id"),
  progress: integer("progress").notNull().default(0),
  isOverdue: boolean("is_overdue").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

export const taskCheckpointsTable = pgTable("task_checkpoints", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  taskId: integer("task_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"), // pending, submitted, approved, rejected
  proofUrl: text("proof_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const insertTaskCheckpointSchema = createInsertSchema(taskCheckpointsTable).omit({ id: true, createdAt: true });
export type InsertTaskCheckpoint = z.infer<typeof insertTaskCheckpointSchema>;
export type TaskCheckpoint = typeof taskCheckpointsTable.$inferSelect;

export const taskEscalationsTable = pgTable("task_escalations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  taskId: integer("task_id").notNull(),
  escalatedById: integer("escalated_by_id").notNull(),
  escalatedToId: integer("escalated_to_id"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("active"), // active, resolved
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedById: integer("resolved_by_id"),
});

export const insertTaskEscalationSchema = createInsertSchema(taskEscalationsTable).omit({ id: true, createdAt: true, resolvedAt: true, resolvedById: true });
export type InsertTaskEscalation = z.infer<typeof insertTaskEscalationSchema>;
export type TaskEscalation = typeof taskEscalationsTable.$inferSelect;
