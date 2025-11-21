import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { tasksTable, usersTable, projectsTable, taskCheckpointsTable, claimsTable, taskEscalationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

async function enrichTask(task: typeof tasksTable.$inferSelect) {
  let assigneeName: string | null = null;
  let assignerName: string | null = null;
  let projectTitle: string | null = null;
  if (task.assigneeId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, task.assigneeId));
    assigneeName = u?.name ?? null;
  }
  if (task.assignerId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, task.assignerId));
    assignerName = u?.name ?? null;
  }
  if (task.projectId) {
    const [p] = await db.select({ title: projectsTable.title }).from(projectsTable).where(eq(projectsTable.id, task.projectId));
    projectTitle = p?.title ?? null;
  }
  const now = new Date();
  const isOverdue = !!(task.deadline && now > task.deadline && !["verified", "closed"].includes(task.status));

  let activeEscalation = null;
  if (task.status === "escalated") {
    const [esc] = await db.select().from(taskEscalationsTable).where(and(eq(taskEscalationsTable.taskId, task.id), eq(taskEscalationsTable.status, "active")));
    activeEscalation = esc ?? null;
  }

  return { ...task, assigneeName, assignerName, projectTitle, isOverdue, activeEscalation };
}

router.get("/v1/tasks", requireAuth, async (req, res): Promise<void> => {
  const { projectId, meetingId, assigneeId, status, priority } = req.query;
  const conditions = [eq(tasksTable.orgId, req.user!.orgId)];
  if (projectId) conditions.push(eq(tasksTable.projectId, parseInt(String(projectId), 10)));
  if (meetingId) conditions.push(eq(tasksTable.meetingId, parseInt(String(meetingId), 10)));
  if (assigneeId) conditions.push(eq(tasksTable.assigneeId, parseInt(String(assigneeId), 10)));
  if (status) conditions.push(eq(tasksTable.status, String(status)));
  if (priority) conditions.push(eq(tasksTable.priority, String(priority)));

  const tasks = await db.select().from(tasksTable).where(and(...conditions));
  const result = await Promise.all(tasks.map(enrichTask));
  res.json(result);
});

router.post("/v1/tasks", requireAuth, async (req, res): Promise<void> => {
  const { title, description, projectId, meetingId, assigneeId, priority, deadline } = req.body;
  if (!title || !priority) {
    res.status(400).json({ error: "title and priority are required" });
    return;
  }
  const [task] = await db.insert(tasksTable).values({
    orgId: req.user!.orgId, title, description: description ?? null,
    projectId: projectId ?? null, meetingId: meetingId ?? null, assigneeId: assigneeId ?? null,
    assignerId: req.user!.userId, priority, status: "assigned",
    deadline: deadline ? new Date(deadline) : null, progress: 0, isOverdue: false,
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "task.create", entityId: String(task.id), payload: { title, priority, assigneeId } });
  res.status(201).json(await enrichTask(task));
});

router.get("/v1/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [task] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.orgId, req.user!.orgId)));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(await enrichTask(task));
});

router.patch("/v1/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { title, description, status, priority, progress, deadline } = req.body;
  const updates: Partial<typeof tasksTable.$inferInsert> = {};
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (status) {
    updates.status = status;
    if (status === "submitted") updates.completedAt = new Date();
  }
  if (priority) updates.priority = priority;
  if (progress !== undefined) updates.progress = progress;
  if (deadline !== undefined) updates.deadline = deadline ? new Date(deadline) : null;

  const [task] = await db.update(tasksTable).set(updates)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.orgId, req.user!.orgId))).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "task.update", entityId: String(task.id), payload: updates });
  res.json(await enrichTask(task));
});

router.post("/v1/tasks/:id/verify", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { action } = req.body;
  if (!action || !["verify", "reject"].includes(action)) {
    res.status(400).json({ error: "action must be verify or reject" });
    return;
  }
  const newStatus = action === "verify" ? "verified" : "in_progress";
  const [task] = await db.update(tasksTable).set({
    status: newStatus,
    ...(action === "verify" && { verifiedAt: new Date(), verifierId: req.user!.userId, progress: 100 }),
  }).where(and(eq(tasksTable.id, id), eq(tasksTable.orgId, req.user!.orgId))).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: `task.${action}`, entityId: String(task.id) });
  res.json(await enrichTask(task));
});

router.get("/v1/tasks/:id/checkpoints", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const checkpoints = await db.select().from(taskCheckpointsTable)
    .where(and(eq(taskCheckpointsTable.taskId, id), eq(taskCheckpointsTable.orgId, req.user!.orgId)));
  res.json(checkpoints);
});

router.post("/v1/tasks/:id/checkpoints", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [checkpoint] = await db.insert(taskCheckpointsTable).values({
    orgId: req.user!.orgId,
    taskId: id,
    title,
    status: "pending",
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "task.checkpoint.create", entityId: String(id), payload: { checkpointId: checkpoint.id, title } });
  res.status(201).json(checkpoint);
});

router.put("/v1/tasks/:id/checkpoints/:checkpointId", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const checkpointId = parseInt(Array.isArray(req.params.checkpointId) ? req.params.checkpointId[0] : req.params.checkpointId, 10);
  const { proofUrl, status } = req.body;
  
  const updates: Partial<typeof taskCheckpointsTable.$inferInsert> = {};
  if (proofUrl !== undefined) updates.proofUrl = proofUrl;
  if (status) updates.status = status;

  const [checkpoint] = await db.update(taskCheckpointsTable).set(updates)
    .where(and(
      eq(taskCheckpointsTable.id, checkpointId),
      eq(taskCheckpointsTable.taskId, taskId),
      eq(taskCheckpointsTable.orgId, req.user!.orgId)
    )).returning();
    
  if (!checkpoint) {
    res.status(404).json({ error: "Checkpoint not found" });
    return;
  }
  
  // Calculate progress automatically based on checkpoints
  const checkpoints = await db.select().from(taskCheckpointsTable).where(eq(taskCheckpointsTable.taskId, taskId));
  if (checkpoints.length > 0) {
    const completedCount = checkpoints.filter(c => c.status === "approved" || c.status === "submitted").length;
    const progress = Math.round((completedCount / checkpoints.length) * 100);
    await db.update(tasksTable).set({ progress }).where(eq(tasksTable.id, taskId));
  }

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "task.checkpoint.update", entityId: String(taskId), payload: { checkpointId, updates } });
  res.json(checkpoint);
});

router.post("/v1/tasks/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { proofUrl, description } = req.body;

  if (!proofUrl || !description) {
    res.status(400).json({ error: "proofUrl and description are required for Proof of Work" });
    return;
  }

  // 1. Mark task as pending_verification
  const [task] = await db.update(tasksTable).set({
    status: "pending_verification",
    completedAt: new Date(),
  }).where(and(eq(tasksTable.id, id), eq(tasksTable.orgId, req.user!.orgId))).returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // 2. Create Claim
  const [claim] = await db.insert(claimsTable).values({
    orgId: req.user!.orgId,
    userId: req.user!.userId,
    claimType: "task_delivery",
    description: `Task Completion: ${task.title} - ${description}`,
    proofUrl: proofUrl,
    taskId: id,
    status: "pending",
  }).returning();

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "task.complete.claim_created", entityId: String(id), payload: { claimId: claim.id } });
  res.json({ task: await enrichTask(task), claim });
});

router.get("/v1/tasks/:id/escalations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const escalations = await db.select().from(taskEscalationsTable)
    .where(and(eq(taskEscalationsTable.taskId, id), eq(taskEscalationsTable.orgId, req.user!.orgId)));
  res.json(escalations);
});

router.post("/v1/tasks/:id/escalate", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { reason, escalatedToId } = req.body;

  if (!reason) {
    res.status(400).json({ error: "reason is required for escalation" });
    return;
  }

  // 1. Mark task as escalated
  const [task] = await db.update(tasksTable).set({
    status: "escalated",
  }).where(and(eq(tasksTable.id, id), eq(tasksTable.orgId, req.user!.orgId))).returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // 2. Create Escalation Record
  const [escalation] = await db.insert(taskEscalationsTable).values({
    orgId: req.user!.orgId,
    taskId: id,
    escalatedById: req.user!.userId,
    escalatedToId: escalatedToId ? Number(escalatedToId) : null,
    reason,
    status: "active",
  }).returning();

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "task.escalated", entityId: String(id), payload: { escalationId: escalation.id, reason, escalatedToId } });
  res.json({ task: await enrichTask(task), escalation });
});

router.post("/v1/tasks/:id/escalations/:escalationId/resolve", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const escalationId = parseInt(Array.isArray(req.params.escalationId) ? req.params.escalationId[0] : req.params.escalationId, 10);

  // Mark escalation as resolved
  const [escalation] = await db.update(taskEscalationsTable).set({
    status: "resolved",
    resolvedAt: new Date(),
    resolvedById: req.user!.userId,
  }).where(and(
    eq(taskEscalationsTable.id, escalationId),
    eq(taskEscalationsTable.taskId, taskId),
    eq(taskEscalationsTable.orgId, req.user!.orgId)
  )).returning();

  if (!escalation) {
    res.status(404).json({ error: "Escalation not found" });
    return;
  }

  // Set task back to in_progress
  const [task] = await db.update(tasksTable).set({
    status: "in_progress",
  }).where(eq(tasksTable.id, taskId)).returning();

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "task.escalation.resolved", entityId: String(taskId), payload: { escalationId } });
  res.json({ task: await enrichTask(task), escalation });
});

export default router;
