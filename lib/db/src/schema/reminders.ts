import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  message: text("message"),
  isAcknowledged: boolean("is_acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({ id: true, createdAt: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;
