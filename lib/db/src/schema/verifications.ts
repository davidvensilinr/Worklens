import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const claimsTable = pgTable("claims", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id").notNull(),
  claimType: text("claim_type").notNull(), // e.g. "education", "skill", "project_delivery", "task_delivery"
  description: text("description").notNull(),
  proofUrl: text("proof_url"),
  taskId: integer("task_id"), // Optional: link claim to a specific task
  status: text("status").notNull().default("pending"), // pending, verified, rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClaimSchema = createInsertSchema(claimsTable).omit({ id: true, createdAt: true });
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claimsTable.$inferSelect;

export const claimApprovalsTable = pgTable("claim_approvals", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  claimId: integer("claim_id").notNull(),
  reviewerId: integer("reviewer_id").notNull(),
  status: text("status").notNull(), // verified, rejected
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClaimApprovalSchema = createInsertSchema(claimApprovalsTable).omit({ id: true, createdAt: true });
export type InsertClaimApproval = z.infer<typeof insertClaimApprovalSchema>;
export type ClaimApproval = typeof claimApprovalsTable.$inferSelect;
