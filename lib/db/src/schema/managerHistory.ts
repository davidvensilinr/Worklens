import { pgTable, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const managerHistoryTable = pgTable("manager_history", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  employeeId: integer("employee_id").notNull().references(() => usersTable.id),
  managerId: integer("manager_id").references(() => usersTable.id), // Nullable if assigned to no manager
  assignedFrom: timestamp("assigned_from", { withTimezone: true }).notNull().defaultNow(),
  assignedUntil: timestamp("assigned_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertManagerHistorySchema = createInsertSchema(managerHistoryTable).omit({ id: true, createdAt: true });
export type InsertManagerHistory = z.infer<typeof insertManagerHistorySchema>;
export type ManagerHistory = typeof managerHistoryTable.$inferSelect;
