import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { departmentsTable, usersTable, tasksTable, attendanceTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

router.get("/v1/departments", requireAuth, async (req, res): Promise<void> => {
  const departments = await db.select().from(departmentsTable)
    .where(eq(departmentsTable.orgId, req.user!.orgId));

  const result = await Promise.all(departments.map(async (dept) => {
    let headName: string | null = null;
    if (dept.headId) {
      const [head] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, dept.headId));
      headName = head?.name ?? null;
    }
    const employees = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.orgId, req.user!.orgId), eq(usersTable.departmentId, dept.id)));
    return { ...dept, headName, employeeCount: employees.length };
  }));

  res.json(result);
});

router.post("/v1/departments", requireAuth, async (req, res): Promise<void> => {
  const { name, headId } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [dept] = await db.insert(departmentsTable).values({ orgId: req.user!.orgId, name, headId: headId ?? null }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "department.create", entityId: String(dept.id), payload: { name } });
  res.status(201).json({ ...dept, headName: null, employeeCount: 0 });
});

router.get("/v1/departments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [dept] = await db.select().from(departmentsTable)
    .where(and(eq(departmentsTable.id, id), eq(departmentsTable.orgId, req.user!.orgId)));
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  let headName: string | null = null;
  if (dept.headId) {
    const [head] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, dept.headId));
    headName = head?.name ?? null;
  }
  const employees = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.orgId, req.user!.orgId), eq(usersTable.departmentId, dept.id)));
  res.json({ ...dept, headName, employeeCount: employees.length });
});

router.patch("/v1/departments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, headId } = req.body;
  const [dept] = await db.update(departmentsTable)
    .set({ ...(name && { name }), ...(headId !== undefined && { headId }) })
    .where(and(eq(departmentsTable.id, id), eq(departmentsTable.orgId, req.user!.orgId)))
    .returning();
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "department.update", entityId: String(dept.id), payload: { name, headId } });
  res.json({ ...dept, headName: null, employeeCount: 0 });
});

export default router;
