import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }).notNull().defaultNow(),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  hoursWorked: real("hours_worked"),
  isOvertime: boolean("is_overtime").notNull().default(false),
  isRemote: boolean("is_remote").notNull().default(false),
  isSick: boolean("is_sick").notNull().default(false),
  leaveType: text("leave_type"),
  notes: text("notes"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  photoUrl: text("photo_url"),
  claimId: integer("claim_id"),
  isPhotoVerified: boolean("is_photo_verified").notNull().default(false),
  warningSent: boolean("warning_sent").notNull().default(false),
  isLate: boolean("is_late").notNull().default(false),
  minutesLate: integer("minutes_late"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
