import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { leavesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

/** Enrich a leave record with employee name and approver names */
async function enrichLeave(leave: typeof leavesTable.$inferSelect) {
  const [emp] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, leave.userId));
  let managerName: string | null = null;
  let hrName: string | null = null;
  if (leave.managerApproverId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, leave.managerApproverId));
    managerName = u?.name ?? null;
  }
  if (leave.hrApproverId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, leave.hrApproverId));
    hrName = u?.name ?? null;
  }
  return { ...leave, employeeName: emp?.name ?? null, managerApproverName: managerName, hrApproverName: hrName };
}

/** Recompute and persist overall status based on both legs */
async function syncStatus(leaveId: number, orgId: number): Promise<typeof leavesTable.$inferSelect> {
  const [leave] = await db.select().from(leavesTable).where(and(eq(leavesTable.id, leaveId), eq(leavesTable.orgId, orgId)));
  let status = leave.status;
  // If either leg rejected → overall rejected
  if (leave.managerApprovalStatus === "rejected" || leave.hrApprovalStatus === "rejected") {
    status = "rejected";
  } else if (leave.managerApprovalStatus === "approved" && leave.hrApprovalStatus === "approved") {
    status = "approved";
  } else if (leave.managerApprovalStatus === "approved") {
    status = "manager_approved";
  } else {
    status = "pending";
  }
  const [updated] = await db.update(leavesTable).set({ status }).where(eq(leavesTable.id, leaveId)).returning();
  return updated;
}

// ─── LIST ────────────────────────────────────────────────────────────────────

router.get("/v1/leaves", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req.query;
  const role = req.user!.role;
  const actorId = req.user!.userId;
  const orgId = req.user!.orgId;

  let leaves: (typeof leavesTable.$inferSelect)[];

  if (role === "employee") {
    // Employees see only their own
    leaves = await db.select().from(leavesTable)
      .where(and(eq(leavesTable.orgId, orgId), eq(leavesTable.userId, actorId)))
      .orderBy(desc(leavesTable.createdAt));
  } else if (role === "manager") {
    // Managers see their direct reports' leaves
    const reports = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.orgId, orgId), eq(usersTable.managerId, actorId)));
    const reportIds = reports.map(r => r.id);
    if (reportIds.length === 0) {
      res.json([]); return;
    }
    leaves = await db.select().from(leavesTable)
      .where(and(eq(leavesTable.orgId, orgId), or(...reportIds.map(id => eq(leavesTable.userId, id)))))
      .orderBy(desc(leavesTable.createdAt));
  } else {
    // HR admin / super_admin — see all, optionally filtered by userId
    const conditions = [eq(leavesTable.orgId, orgId)];
    if (userId) conditions.push(eq(leavesTable.userId, parseInt(String(userId), 10)));
    leaves = await db.select().from(leavesTable).where(and(...conditions)).orderBy(desc(leavesTable.createdAt));
  }

  const result = await Promise.all(leaves.map(enrichLeave));
  res.json(result);
});

// ─── GET SINGLE ──────────────────────────────────────────────────────────────

router.get("/v1/leaves/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [leave] = await db.select().from(leavesTable)
    .where(and(eq(leavesTable.id, id), eq(leavesTable.orgId, req.user!.orgId)));
  if (!leave) { res.status(404).json({ error: "Leave not found" }); return; }
  res.json(await enrichLeave(leave));
});

// ─── CREATE (employee submits) ────────────────────────────────────────────────

router.post("/v1/leaves", requireAuth, async (req, res): Promise<void> => {
  const { leaveType, startDate, endDate, reason } = req.body;
  if (!leaveType || !startDate || !endDate || !reason) {
    res.status(400).json({ error: "leaveType, startDate, endDate, and reason are required" });
    return;
  }
  const [leave] = await db.insert(leavesTable).values({
    orgId: req.user!.orgId,
    userId: req.user!.userId,
    leaveType, startDate, endDate, reason,
    status: "pending",
    managerApprovalStatus: "pending",
    hrApprovalStatus: "pending",
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "leave.submit", entityId: String(leave.id), payload: { leaveType, startDate, endDate } });
  res.status(201).json(await enrichLeave(leave));
});

// ─── MANAGER APPROVE ─────────────────────────────────────────────────────────

router.post("/v1/leaves/:id/manager-approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { note } = req.body;
  const role = req.user!.role;
  if (!["manager", "hr_admin", "super_admin"].includes(role)) {
    res.status(403).json({ error: "Only managers or admins can perform manager approval" }); return;
  }
  const [existing] = await db.select().from(leavesTable)
    .where(and(eq(leavesTable.id, id), eq(leavesTable.orgId, req.user!.orgId)));
  if (!existing) { res.status(404).json({ error: "Leave not found" }); return; }
  if (existing.managerApprovalStatus !== "pending") {
    res.status(400).json({ error: "Manager approval already submitted" }); return;
  }
  await db.update(leavesTable).set({
    managerApprovalStatus: "approved",
    managerApproverId: req.user!.userId,
    managerApprovedAt: new Date(),
    managerNote: note ?? null,
  }).where(eq(leavesTable.id, id));
  const updated = await syncStatus(id, req.user!.orgId);
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "leave.manager_approve", entityId: String(id), payload: { note } });
  res.json(await enrichLeave(updated));
});

// ─── MANAGER REJECT ──────────────────────────────────────────────────────────

router.post("/v1/leaves/:id/manager-reject", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { note } = req.body;
  const role = req.user!.role;
  if (!["manager", "hr_admin", "super_admin"].includes(role)) {
    res.status(403).json({ error: "Only managers or admins can perform manager rejection" }); return;
  }
  const [existing] = await db.select().from(leavesTable)
    .where(and(eq(leavesTable.id, id), eq(leavesTable.orgId, req.user!.orgId)));
  if (!existing) { res.status(404).json({ error: "Leave not found" }); return; }
  if (existing.managerApprovalStatus !== "pending") {
    res.status(400).json({ error: "Manager approval already submitted" }); return;
  }
  await db.update(leavesTable).set({
    managerApprovalStatus: "rejected",
    managerApproverId: req.user!.userId,
    managerApprovedAt: new Date(),
    managerNote: note ?? null,
  }).where(eq(leavesTable.id, id));
  const updated = await syncStatus(id, req.user!.orgId);
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "leave.manager_reject", entityId: String(id), payload: { note } });
  res.json(await enrichLeave(updated));
});

// ─── HR APPROVE ──────────────────────────────────────────────────────────────

router.post("/v1/leaves/:id/hr-approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { note } = req.body;
  const role = req.user!.role;
  if (!["hr_admin", "super_admin"].includes(role)) {
    res.status(403).json({ error: "Only HR admins can perform HR approval" }); return;
  }
  const [existing] = await db.select().from(leavesTable)
    .where(and(eq(leavesTable.id, id), eq(leavesTable.orgId, req.user!.orgId)));
  if (!existing) { res.status(404).json({ error: "Leave not found" }); return; }
  if (existing.hrApprovalStatus !== "pending") {
    res.status(400).json({ error: "HR approval already submitted" }); return;
  }
  await db.update(leavesTable).set({
    hrApprovalStatus: "approved",
    hrApproverId: req.user!.userId,
    hrApprovedAt: new Date(),
    hrNote: note ?? null,
  }).where(eq(leavesTable.id, id));
  const updated = await syncStatus(id, req.user!.orgId);
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "leave.hr_approve", entityId: String(id), payload: { note } });
  res.json(await enrichLeave(updated));
});

// ─── HR REJECT ───────────────────────────────────────────────────────────────

router.post("/v1/leaves/:id/hr-reject", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { note } = req.body;
  const role = req.user!.role;
  if (!["hr_admin", "super_admin"].includes(role)) {
    res.status(403).json({ error: "Only HR admins can perform HR rejection" }); return;
  }
  const [existing] = await db.select().from(leavesTable)
    .where(and(eq(leavesTable.id, id), eq(leavesTable.orgId, req.user!.orgId)));
  if (!existing) { res.status(404).json({ error: "Leave not found" }); return; }
  if (existing.hrApprovalStatus !== "pending") {
    res.status(400).json({ error: "HR approval already submitted" }); return;
  }
  await db.update(leavesTable).set({
    hrApprovalStatus: "rejected",
    hrApproverId: req.user!.userId,
    hrApprovedAt: new Date(),
    hrNote: note ?? null,
  }).where(eq(leavesTable.id, id));
  const updated = await syncStatus(id, req.user!.orgId);
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "leave.hr_reject", entityId: String(id), payload: { note } });
  res.json(await enrichLeave(updated));
});

export default router;
