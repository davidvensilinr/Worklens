import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recognitionsTable = pgTable("recognitions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  giverId: integer("giver_id").notNull().references(() => usersTable.id),
  recipientId: integer("recipient_id").notNull().references(() => usersTable.id),
  badge: text("badge"),
  message: text("message").notNull(),
  coreValue: text("core_value"), // optional tie to a company value
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecognitionSchema = createInsertSchema(recognitionsTable).omit({ id: true, createdAt: true });
export type InsertRecognition = z.infer<typeof insertRecognitionSchema>;
export type Recognition = typeof recognitionsTable.$inferSelect;
