import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const mlFeaturesTable = pgTable("ml_features", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  
  // 1-8: Attendance & Leave
  daysPresent: integer("days_present"),
  totalWorkingDays: integer("total_working_days"),
  overtimeHours: real("overtime_hours"),
  sickDays: integer("sick_days"),
  lateArrivalCount: integer("late_arrival_count"),
  leavesTaken: integer("leaves_taken"),
  leavesEntitled: integer("leaves_entitled"),
  afterHoursMessages: integer("after_hours_messages"),

  // 9-13: Tasks & Reminders
  totalTasks: integer("total_tasks"),
  tasksCompletedOnTime: integer("tasks_completed_on_time"),
  escalations: integer("escalations"),
  onTimeSubmissionRate: real("on_time_submission_rate"),
  acknowledgmentRate: real("acknowledgment_rate"),

  // 14-19: Chat
  avgResponseTimeMins: real("avg_response_time_mins"),
  totalMessages: integer("total_messages"),
  uniqueTeammatesMessaged: integer("unique_teammates_messaged"),
  mentionResponseRate: real("mention_response_rate"),
  collaborationScore: real("collaboration_score"),
  groupMessagesSent: integer("group_messages_sent"),
  messagesRepliedTo: integer("messages_replied_to"),
  messagesReceived: integer("messages_received"),

  // 20-22: Meetings
  meetingAttendanceRate: real("meeting_attendance_rate"),
  actionItemsCompleted: integer("action_items_completed"),
  totalActionItems: integer("total_action_items"),

  // 23-26: Training & Recognition
  trainingTimesLastYear: integer("training_times_last_year"),
  selfInitiatedTrainings: integer("self_initiated_trainings"),
  peerRecognitionsGiven: integer("peer_recognitions_given"),
  recognitionsReceived: integer("recognitions_received"),

  // 27-31: Org & History
  yearsSinceLastPromotion: real("years_since_last_promotion"),
  teamSize: integer("team_size"),
  experienceYearsInCurrentRole: real("experience_years_in_current_role"),
  totalWorkExperienceYears: real("total_work_experience_years"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MlFeatureRow = typeof mlFeaturesTable.$inferSelect;
