import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("employee"),
  departmentId: integer("department_id"),
  teamId: integer("team_id"),
  managerId: integer("manager_id"),
  hireDate: text("hire_date"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  jobTitle: text("job_title"),
  dateOfBirth: text("date_of_birth").notNull().default("2000-01-01"),
  gender: integer("gender"), // 0=Female, 1=Male
  distanceFromHome: integer("distance_from_home"),
  numCompaniesWorked: integer("num_companies_worked"),
  totalWorkingYearsBeforeHire: integer("total_working_years_before_hire"),
  education: integer("education"), // 1=Below College, 2=College, 3=Bachelor, 4=Master, 5=Doctor
  standardWorkingHours: real("standard_working_hours").notNull().default(8),
  workStartTime: text("work_start_time").default("09:00"), // 24h format HH:MM
  workEndTime: text("work_end_time").default("17:00"),     // 24h format HH:MM
  leavesEntitled: integer("leaves_entitled").notNull().default(20),
  roleStartDate: text("role_start_date"),
  homeLocation: text("home_location"),
  officeLocation: text("office_location"),
  jobLevel: integer("job_level"), // 1-5
  stockOptionLevel: integer("stock_option_level").notNull().default(0), // 0-4
  yearsSinceLastPromotion: integer("years_since_last_promotion"),
  responseCount: integer("response_count").notNull().default(0),
  totalResponseTimeMins: real("total_response_time_mins").notNull().default(0),
  avgResponseTimeMins: real("avg_response_time_mins").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
