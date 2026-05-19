import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { trainingProgramsTable, trainingsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

router.get("/v1/training-programs", requireAuth, async (req, res): Promise<void> => {
  const programs = await db.select().from(trainingProgramsTable)
    .where(eq(trainingProgramsTable.orgId, req.user!.orgId));
  const result = await Promise.all(programs.map(async (p) => {
    const enrollments = await db.select({ id: trainingsTable.id }).from(trainingsTable).where(eq(trainingsTable.programId, p.id));
    return { ...p, enrollmentCount: enrollments.length };
  }));
  res.json(result);
});

router.post("/v1/training-programs", requireAuth, async (req, res): Promise<void> => {
  const { title, description, durationHours, deadline } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const [program] = await db.insert(trainingProgramsTable).values({
    orgId: req.user!.orgId, title, description: description ?? null,
    durationHours: durationHours ?? null, deadline: deadline ? new Date(deadline) : null,
    createdById: req.user!.userId,
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "training_program.create", entityId: String(program.id), payload: { title } });
  res.status(201).json({ ...program, enrollmentCount: 0 });
});

router.get("/v1/trainings", requireAuth, async (req, res): Promise<void> => {
  const { userId, status } = req.query;
  const conditions = [eq(trainingsTable.orgId, req.user!.orgId)];
  if (userId) conditions.push(eq(trainingsTable.userId, parseInt(String(userId), 10)));
  if (status) conditions.push(eq(trainingsTable.status, String(status)));

  const trainings = await db.select().from(trainingsTable).where(and(...conditions));
  const result = await Promise.all(trainings.map(async (t) => {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.userId));
    const [p] = await db.select({ title: trainingProgramsTable.title }).from(trainingProgramsTable).where(eq(trainingProgramsTable.id, t.programId));
    return { ...t, userName: u?.name ?? null, programTitle: p?.title ?? null };
  }));
  res.json(result);
});

router.post("/v1/trainings", requireAuth, async (req, res): Promise<void> => {
  const { programId, userId, isAssigned } = req.body;
  if (!programId) {
    res.status(400).json({ error: "programId is required" });
    return;
  }
  const targetUserId = userId ?? req.user!.userId;
  const [training] = await db.insert(trainingsTable).values({
    orgId: req.user!.orgId, userId: targetUserId, programId,
    status: "enrolled", isAssigned: isAssigned ?? false,
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "training.enroll", entityId: String(training.id), payload: { programId, userId: targetUserId } });
  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, targetUserId));
  const [p] = await db.select({ title: trainingProgramsTable.title }).from(trainingProgramsTable).where(eq(trainingProgramsTable.id, programId));
  res.status(201).json({ ...training, userName: u?.name ?? null, programTitle: p?.title ?? null });
});

router.post("/v1/trainings/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { score, hoursSpent } = req.body;
  if (score === undefined) {
    res.status(400).json({ error: "score is required" });
    return;
  }
  const [training] = await db.update(trainingsTable).set({
    status: score >= 60 ? "completed" : "failed", score, hoursSpent: hoursSpent ?? null, completedAt: new Date(),
  }).where(eq(trainingsTable.id, id)).returning();
  if (!training) {
    res.status(404).json({ error: "Training not found" });
    return;
  }
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "training.complete", entityId: String(training.id), payload: { score } });
  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, training.userId));
  const [p] = await db.select({ title: trainingProgramsTable.title }).from(trainingProgramsTable).where(eq(trainingProgramsTable.id, training.programId));
  res.json({ ...training, userName: u?.name ?? null, programTitle: p?.title ?? null });
});

export default router;
