import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  actorId: integer("actor_id").notNull(),
  eventType: text("event_type").notNull(),
  entityId: text("entity_id"),
  payload: text("payload"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  hash: text("hash").notNull(),
  previousHash: text("previous_hash"),
});

export type AuditLog = typeof auditLogTable.$inferSelect;
