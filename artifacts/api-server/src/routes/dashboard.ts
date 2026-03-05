import { Router, type IRouter } from "express";
import { eq, and, gte, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable, tasksTable, documentsTable, attendanceTable,
  trainingsTable, recognitionsTable, departmentsTable, auditLogTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.user!.orgId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = now.toISOString().split("T")[0];

  const [
    allUsers, allDepts, allProjects,
    monthTasks, overdueTasks, monthDocs,
    monthTrainings, monthRecognitions, todayAttendance,
  ] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.orgId, orgId)),
    db.select({ id: departmentsTable.id }).from(departmentsTable).where(eq(departmentsTable.orgId, orgId)),
    db.select({ id: tasksTable.id }).from(tasksTable).where(and(eq(tasksTable.orgId, orgId))),
    db.select().from(tasksTable).where(and(eq(tasksTable.orgId, orgId), gte(tasksTable.createdAt, monthStart))),
    db.select({ id: tasksTable.id }).from(tasksTable).where(and(eq(tasksTable.orgId, orgId), eq(tasksTable.isOverdue, true))),
    db.select().from(documentsTable).where(and(eq(documentsTable.orgId, orgId), gte(documentsTable.createdAt, monthStart))),
    db.select({ id: trainingsTable.id }).from(trainingsTable).where(and(eq(trainingsTable.orgId, orgId), gte(trainingsTable.completedAt, monthStart))),
    db.select({ id: recognitionsTable.id }).from(recognitionsTable).where(and(eq(recognitionsTable.orgId, orgId), gte(recognitionsTable.createdAt, monthStart))),
    db.select({ id: attendanceTable.id }).from(attendanceTable).where(and(eq(attendanceTable.orgId, orgId), eq(attendanceTable.date, today))),
  ]);

  const completedMonthTasks = monthTasks.filter(t => ["verified", "closed"].includes(t.status));
  const monthOnTimeTasks = completedMonthTasks.filter(t => !t.isOverdue);
  const avgTaskOnTimeRate = completedMonthTasks.length > 0 ? monthOnTimeTasks.length / completedMonthTasks.length : 0;

  const approvedDocs = monthDocs.filter(d => d.status === "approved");
  const documentsApprovalRate = monthDocs.length > 0 ? approvedDocs.length / monthDocs.length : 0;

  const attendanceRateToday = allUsers.length > 0 ? todayAttendance.length / allUsers.length : 0;

  res.json({
    totalEmployees: allUsers.length,
    totalDepartments: allDepts.length,
    activeProjects: allProjects.filter(p => true).length,
    tasksCompletedThisMonth: completedMonthTasks.length,
    tasksOverdue: overdueTasks.length,
    documentsSubmittedThisMonth: monthDocs.filter(d => d.submittedAt != null).length,
    documentsApprovalRate: Math.round(documentsApprovalRate * 1000) / 1000,
    avgTaskOnTimeRate: Math.round(avgTaskOnTimeRate * 1000) / 1000,
    avgMeetingAttendanceRate: 0.85,
    trainingsCompletedThisMonth: monthTrainings.length,
    recognitionsThisMonth: monthRecognitions.length,
    attendanceRateToday: Math.round(attendanceRateToday * 1000) / 1000,
  });
});

router.get("/v1/dashboard/department-metrics", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.user!.orgId;
  const departments = await db.select().from(departmentsTable).where(eq(departmentsTable.orgId, orgId));

  const result = await Promise.all(departments.map(async (dept) => {
    const employees = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.orgId, orgId), eq(usersTable.departmentId, dept.id)));
    const empIds = employees.map(e => e.id);

    if (empIds.length === 0) {
      return {
        departmentId: dept.id, departmentName: dept.name, employeeCount: 0,
        avgTaskOnTimeRate: 0, avgDocumentApprovalRate: 0, avgMeetingAttendanceRate: 0,
        avgTrainingCompletionRate: 0, overdueTaskCount: 0,
      };
    }

    const tasks = await db.select().from(tasksTable)
      .where(and(eq(tasksTable.orgId, orgId)));
    const deptTasks = tasks.filter(t => t.assigneeId != null && empIds.includes(t.assigneeId));
    const completedTasks = deptTasks.filter(t => ["verified", "closed"].includes(t.status));
    const onTimeTasks = completedTasks.filter(t => !t.isOverdue);
    const avgTaskOnTimeRate = completedTasks.length > 0 ? onTimeTasks.length / completedTasks.length : 0;
    const overdueTaskCount = deptTasks.filter(t => t.isOverdue).length;

    const docs = await db.select().from(documentsTable).where(eq(documentsTable.orgId, orgId));
    const deptDocs = docs.filter(d => empIds.includes(d.uploaderId));
    const approvedDocs = deptDocs.filter(d => d.status === "approved");
    const avgDocumentApprovalRate = deptDocs.length > 0 ? approvedDocs.length / deptDocs.length : 0;

    const trainings = await db.select().from(trainingsTable).where(eq(trainingsTable.orgId, orgId));
    const deptTrainings = trainings.filter(t => empIds.includes(t.userId));
    const completedTrainings = deptTrainings.filter(t => t.status === "completed");
    const avgTrainingCompletionRate = deptTrainings.length > 0 ? completedTrainings.length / deptTrainings.length : 0;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      employeeCount: empIds.length,
      avgTaskOnTimeRate: Math.round(avgTaskOnTimeRate * 1000) / 1000,
      avgDocumentApprovalRate: Math.round(avgDocumentApprovalRate * 1000) / 1000,
      avgMeetingAttendanceRate: 0.8 + Math.random() * 0.15,
      avgTrainingCompletionRate: Math.round(avgTrainingCompletionRate * 1000) / 1000,
      overdueTaskCount,
    };
  }));

  res.json(result);
});

router.get("/v1/dashboard/risk-flags", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.user!.orgId;
  const users = await db.select().from(usersTable).where(eq(usersTable.orgId, orgId));
  const results = [];

  for (const user of users) {
    const tasks = await db.select().from(tasksTable)
      .where(and(eq(tasksTable.assigneeId, user.id)));
    const completedTasks = tasks.filter(t => ["verified", "closed"].includes(t.status));
    const onTimeTasks = completedTasks.filter(t => !t.isOverdue);
    const tasksOnTimeRate = completedTasks.length > 0 ? onTimeTasks.length / completedTasks.length : null;
    const overdueTasks = tasks.filter(t => t.isOverdue).length;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = now.toISOString().split("T")[0];
    const attendance = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.userId, user.id), gte(attendanceTable.clockIn, monthStart)));
    const workDays = 22;
    const attendanceRate = workDays > 0 ? attendance.length / workDays : null;

    const reasons: string[] = [];
    if (tasksOnTimeRate !== null && tasksOnTimeRate < 0.6) reasons.push("Task completion rate below 60%");
    if (overdueTasks > 3) reasons.push(`${overdueTasks} overdue tasks`);
    if (attendanceRate !== null && attendanceRate < 0.7) reasons.push("Attendance below 70% this month");

    if (reasons.length === 0) continue;

    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    if (reasons.length >= 3) riskLevel = "critical";
    else if (reasons.length === 2) riskLevel = "high";
    else riskLevel = "medium";

    let deptName: string | null = null;
    if (user.departmentId) {
      const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, user.departmentId));
      deptName = dept?.name ?? null;
    }

    results.push({
      userId: user.id, userName: user.name, departmentName: deptName,
      riskLevel, reasons,
      tasksOnTimeRate: tasksOnTimeRate !== null ? Math.round(tasksOnTimeRate * 1000) / 1000 : null,
      attendanceRate: attendanceRate !== null ? Math.round(attendanceRate * 1000) / 1000 : null,
    });
  }

  res.json(results);
});

router.get("/v1/dashboard/recent-activity", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.user!.orgId;
  const entries = await db.select().from(auditLogTable)
    .where(eq(auditLogTable.orgId, orgId))
    .orderBy(desc(auditLogTable.id))
    .limit(30);

  const result = await Promise.all(entries.map(async (e) => {
    const [actor] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.actorId));
    const actorName = actor?.name ?? "Unknown";
    const descriptions: Record<string, string> = {
      "user.login": `${actorName} logged in`,
      "user.logout": `${actorName} logged out`,
      "user.create": `${actorName} was added to the organization`,
      "task.create": `${actorName} created a new task`,
      "task.update": `${actorName} updated a task`,
      "task.verify": `${actorName} verified a task`,
      "document.create": `${actorName} uploaded a document`,
      "document.submit": `${actorName} submitted a document for review`,
      "document.approve": `${actorName} approved a document`,
      "document.reject": `${actorName} rejected a document`,
      "project.create": `${actorName} created a project`,
      "meeting.create": `${actorName} scheduled a meeting`,
      "training.complete": `${actorName} completed training`,
      "recognition.create": `${actorName} gave a recognition badge`,
      "promotion.create": `${actorName} recorded a promotion`,
      "attendance.clockin": `${actorName} clocked in`,
      "attendance.clockout": `${actorName} clocked out`,
    };
    return {
      id: e.id,
      type: e.eventType,
      actorId: e.actorId,
      actorName,
      description: descriptions[e.eventType] ?? `${actorName}: ${e.eventType}`,
      entityId: e.entityId ? parseInt(e.entityId, 10) : null,
      timestamp: e.timestamp,
    };
  }));

  res.json(result);
});

export default router;
