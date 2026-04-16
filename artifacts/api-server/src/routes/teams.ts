import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { teamsTable, departmentsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

router.get("/v1/teams", requireAuth, async (req, res): Promise<void> => {
  const teams = await db.select({
    id: teamsTable.id,
    orgId: teamsTable.orgId,
    departmentId: teamsTable.departmentId,
    name: teamsTable.name,
    leadId: teamsTable.leadId,
    createdAt: teamsTable.createdAt,
    departmentName: departmentsTable.name,
    leadName: usersTable.name,
  })
  .from(teamsTable)
  .leftJoin(departmentsTable, eq(teamsTable.departmentId, departmentsTable.id))
  .leftJoin(usersTable, eq(teamsTable.leadId, usersTable.id))
  .where(eq(teamsTable.orgId, req.user!.orgId));

  res.json(teams);
});

router.post("/v1/teams", requireAuth, async (req, res): Promise<void> => {
  const { name, departmentId, leadId } = req.body;
  
  if (!name || !departmentId) {
    res.status(400).json({ error: "name and departmentId are required" });
    return;
  }

  const [team] = await db.insert(teamsTable).values({
    orgId: req.user!.orgId,
    name,
    departmentId,
    leadId: leadId || null,
  }).returning();

  await logEvent({
    orgId: req.user!.orgId,
    actorId: req.user!.userId,
    eventType: "team.create",
    entityId: String(team.id),
    payload: { name, departmentId }
  });

  res.status(201).json(team);
});

router.patch("/v1/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, leadId, departmentId } = req.body;

  const updates: Partial<typeof teamsTable.$inferInsert> = {};
  if (name) updates.name = name;
  if (leadId !== undefined) updates.leadId = leadId;
  if (departmentId !== undefined) updates.departmentId = departmentId;

  const [team] = await db.update(teamsTable).set(updates)
    .where(and(eq(teamsTable.id, id), eq(teamsTable.orgId, req.user!.orgId)))
    .returning();

  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  await logEvent({
    orgId: req.user!.orgId,
    actorId: req.user!.userId,
    eventType: "team.update",
    entityId: String(id),
    payload: updates
  });

  res.json(team);
});

export default router;
