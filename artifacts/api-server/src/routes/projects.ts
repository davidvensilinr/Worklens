import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, tasksTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

async function enrichProject(project: typeof projectsTable.$inferSelect) {
  let managerName: string | null = null;
  if (project.managerId) {
    const [m] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, project.managerId));
    managerName = m?.name ?? null;
  }
  const tasks = await db.select({ id: tasksTable.id, status: tasksTable.status }).from(tasksTable).where(eq(tasksTable.projectId, project.id));
  const completedTaskCount = tasks.filter(t => ["verified", "closed"].includes(t.status)).length;
  return { ...project, managerName, taskCount: tasks.length, completedTaskCount };
}

router.get("/v1/projects", requireAuth, async (req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.orgId, req.user!.orgId));
  const result = await Promise.all(projects.map(enrichProject));
  res.json(result);
});

router.post("/v1/projects", requireAuth, async (req, res): Promise<void> => {
  const { title, description, deadline, managerId } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const [project] = await db.insert(projectsTable).values({
    orgId: req.user!.orgId, title, description: description ?? null,
    deadline: deadline ? new Date(deadline) : null, managerId: managerId ?? null,
    status: "active",
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "project.create", entityId: String(project.id), payload: { title } });
  res.status(201).json(await enrichProject(project));
});

router.get("/v1/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.orgId, req.user!.orgId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(await enrichProject(project));
});

router.patch("/v1/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { title, description, deadline, status, managerId } = req.body;
  const [project] = await db.update(projectsTable).set({
    ...(title && { title }), ...(description !== undefined && { description }),
    ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
    ...(status && { status }), ...(managerId !== undefined && { managerId }),
  }).where(and(eq(projectsTable.id, id), eq(projectsTable.orgId, req.user!.orgId))).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(await enrichProject(project));
});

export default router;
