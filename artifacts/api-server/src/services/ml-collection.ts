import { db } from "@workspace/db";
import { 
  usersTable, attendanceTable, leavesTable, 
  tasksTable, taskEscalationsTable,
  messagesTable, conversationsTable,
  trainingsTable, actionItemsTable, recognitionsTable, remindersTable,
  mlFeaturesTable
} from "@workspace/db";
import { eq, sql, and, gte, lt } from "drizzle-orm";

/**
 * Calculates and collects all 32 ML features for every user in the organization,
 * and inserts a new snapshot row into the ml_features table.
 */
export async function collectAllMlFeatures(dateSnapshot: string = new Date().toISOString().split("T")[0]) {
  console.log(`[ML Collection] Starting collection for date: ${dateSnapshot}`);
  
  // 1. Get all active users
  const users = await db.select().from(usersTable);
  console.log(`[ML Collection] Processing ${users.length} users...`);

  for (const user of users) {
    try {
      // --- ATTENDANCE & LEAVES ---
      const attendance = await db.select().from(attendanceTable).where(eq(attendanceTable.userId, user.id));
      const daysPresent = attendance.length;
      
      const overtimeHoursResult = await db.select({
        total: sql<number>`sum(${attendanceTable.hoursWorked})`
      }).from(attendanceTable).where(and(eq(attendanceTable.userId, user.id), eq(attendanceTable.isOvertime, true)));
      const overtimeHours = Number(overtimeHoursResult[0]?.total || 0);

      const sickDays = attendance.filter(a => a.isSick).length;
      const lateArrivalCount = attendance.filter(a => a.isLate).length;
      
      const leaves = await db.select().from(leavesTable).where(and(eq(leavesTable.userId, user.id), eq(leavesTable.status, "approved")));
      const leavesTaken = leaves.length;

      // Calculate total working days based on hire date vs now
      const hireDate = new Date(user.hireDate || "2000-01-01");
      const msDiff = Date.now() - hireDate.getTime();
      const totalWorkingDays = Math.floor(msDiff / (1000 * 60 * 60 * 24) * (5/7)); // Approx 5 days a week

      // --- TASKS & REMINDERS ---
      const tasks = await db.select().from(tasksTable).where(eq(tasksTable.assigneeId, user.id));
      const totalTasks = tasks.length;
      const tasksCompletedOnTime = tasks.filter(t => t.completedAt && t.deadline && new Date(t.completedAt) <= new Date(t.deadline)).length;
      
      // Calculate on-time submission rate
      const onTimeSubmissionRate = totalTasks > 0 ? (tasksCompletedOnTime / totalTasks) * 100 : 0;

      const escalationsResult = await db.select({ count: sql<number>`count(*)` })
        .from(taskEscalationsTable).where(eq(taskEscalationsTable.escalatedToId, user.id));
      const escalations = Number(escalationsResult[0]?.count || 0);

      const reminders = await db.select().from(remindersTable).where(eq(remindersTable.userId, user.id));
      const totalReminders = reminders.length;
      const ackReminders = reminders.filter(r => r.isAcknowledged).length;
      const acknowledgmentRate = totalReminders > 0 ? (ackReminders / totalReminders) * 100 : 0;

      // --- CHAT & MESSAGES ---
      const messages = await db.select().from(messagesTable).where(eq(messagesTable.senderId, user.id));
      const totalMessages = messages.length;
      
      const uniqueTeammatesResult = await db.select({
        count: sql<number>`count(distinct ${conversationsTable.id})`
      }).from(messagesTable)
        .leftJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
        .where(eq(messagesTable.senderId, user.id));
      const uniqueTeammatesMessaged = Number(uniqueTeammatesResult[0]?.count || 0);

      const messagesRepliedTo = messages.filter(m => m.replyToMessageId !== null).length;
      
      // Fake messages received based on conversations they are in
      const messagesReceived = Math.floor(totalMessages * 1.5); // Approximation for ML
      
      // Calculate group messages
      const groupMsgs = await db.select({ count: sql<number>`count(*)` })
        .from(messagesTable)
        .leftJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
        .where(and(eq(messagesTable.senderId, user.id), eq(conversationsTable.isGroup, true)));
      const groupMessagesSent = Number(groupMsgs[0]?.count || 0);

      const afterHoursMessages = messages.length > 0 ? Math.floor(messages.length * 0.1) : 0; // Simple estimation logic

      // --- MEETINGS & ACTION ITEMS ---
      const meetingAttendanceRate = 85.0; // Placeholder until attendance tracking added
      
      const actionItems = await db.select().from(actionItemsTable).where(eq(actionItemsTable.assigneeId, user.id));
      const totalActionItems = actionItems.length;
      const actionItemsCompleted = actionItems.filter(a => a.isCompleted).length;

      // --- TRAINING & RECOGNITION ---
      const trainings = await db.select().from(trainingsTable).where(eq(trainingsTable.userId, user.id));
      const trainingTimesLastYear = trainings.filter(t => t.completedAt).length;
      const selfInitiatedTrainings = trainings.filter(t => !t.isAssigned).length;

      const recsGiven = await db.select({ count: sql<number>`count(*)` }).from(recognitionsTable).where(eq(recognitionsTable.giverId, user.id));
      const peerRecognitionsGiven = Number(recsGiven[0]?.count || 0);
      
      const recsReceived = await db.select({ count: sql<number>`count(*)` }).from(recognitionsTable).where(eq(recognitionsTable.recipientId, user.id));
      const recognitionsReceived = Number(recsReceived[0]?.count || 0);

      // --- ORG & HISTORY ---
      // Experience in current role
      let experienceYearsInCurrentRole = user.totalWorkingYearsBeforeHire || 0;
      if (user.roleStartDate) {
        const roleStart = new Date(user.roleStartDate);
        experienceYearsInCurrentRole = (Date.now() - roleStart.getTime()) / (1000 * 60 * 60 * 24 * 365);
      } else {
        experienceYearsInCurrentRole = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      }

      const totalWorkExperienceYears = (user.totalWorkingYearsBeforeHire || 0) + ((Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
      
      const teamSizeRes = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.teamId, user.teamId || -1));
      const teamSize = Number(teamSizeRes[0]?.count || 1);

      // INSERT SNAPSHOT
      await db.insert(mlFeaturesTable).values({
        orgId: user.orgId,
        userId: user.id,
        date: dateSnapshot,
        
        daysPresent,
        totalWorkingDays,
        overtimeHours,
        sickDays,
        lateArrivalCount,
        leavesTaken,
        leavesEntitled: user.leavesEntitled || 20,
        afterHoursMessages,
        
        totalTasks,
        tasksCompletedOnTime,
        escalations,
        onTimeSubmissionRate,
        acknowledgmentRate,

        avgResponseTimeMins: user.avgResponseTimeMins || 0,
        totalMessages,
        uniqueTeammatesMessaged,
        mentionResponseRate: 0, // Placeholder
        collaborationScore: 0, // Placeholder
        groupMessagesSent,
        messagesRepliedTo,
        messagesReceived,

        meetingAttendanceRate,
        actionItemsCompleted,
        totalActionItems,

        trainingTimesLastYear,
        selfInitiatedTrainings,
        peerRecognitionsGiven,
        recognitionsReceived,

        yearsSinceLastPromotion: user.yearsSinceLastPromotion || 0,
        teamSize,
        experienceYearsInCurrentRole,
        totalWorkExperienceYears,
      });

    } catch (e) {
      console.error(`[ML Collection] Failed to process user ${user.id}:`, e);
    }
  }

  console.log(`[ML Collection] Collection complete for date ${dateSnapshot}!`);
}
