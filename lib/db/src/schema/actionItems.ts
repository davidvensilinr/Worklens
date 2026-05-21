import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { meetingsTable } from "./meetings";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actionItemsTable = pgTable("action_items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  meetingId: integer("meeting_id").notNull().references(() => meetingsTable.id),
  assigneeId: integer("assignee_id").notNull().references(() => usersTable.id),
  description: text("description").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertActionItemSchema = createInsertSchema(actionItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItemsTable.$inferSelect;
