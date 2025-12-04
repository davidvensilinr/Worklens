import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leavesTable = pgTable("leaves", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id").notNull(), // employee who requested

  leaveType: text("leave_type").notNull(), // "annual" | "sick" | "emergency" | "unpaid" | "other"
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(),     // YYYY-MM-DD
  reason: text("reason").notNull(),

  // Overall status
  status: text("status").notNull().default("pending"),
  // "pending" -> "manager_approved" -> "approved"
  // "pending" -> "rejected" (if manager or HR rejects)
  // "manager_approved" -> "rejected" (if HR rejects)

  // Manager approval leg
  managerApprovalStatus: text("manager_approval_status").notNull().default("pending"),
  // "pending" | "approved" | "rejected"
  managerApproverId: integer("manager_approver_id"),
  managerApprovedAt: timestamp("manager_approved_at", { withTimezone: true }),
  managerNote: text("manager_note"),

  // HR approval leg
  hrApprovalStatus: text("hr_approval_status").notNull().default("pending"),
  // "pending" | "approved" | "rejected"
  hrApproverId: integer("hr_approver_id"),
  hrApprovedAt: timestamp("hr_approved_at", { withTimezone: true }),
  hrNote: text("hr_note"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeaveSchema = createInsertSchema(leavesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLeave = z.infer<typeof insertLeaveSchema>;
export type Leave = typeof leavesTable.$inferSelect;
