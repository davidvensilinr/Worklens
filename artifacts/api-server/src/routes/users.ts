import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, departmentsTable, managerHistoryTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { hashPassword } from "../lib/jwt";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

async function enrichUser(user: typeof usersTable.$inferSelect) {
  let departmentName: string | null = null;
  let managerName: string | null = null;
  if (user.departmentId) {
    const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, user.departmentId));
    departmentName = dept?.name ?? null;
  }
  if (user.managerId) {
    const [mgr] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, user.managerId));
    managerName = mgr?.name ?? null;
  }
  return {
    id: user.id, orgId: user.orgId, name: user.name, email: user.email,
    role: user.role, departmentId: user.departmentId, departmentName,
    managerId: user.managerId, managerName, hireDate: user.hireDate,
    jobTitle: user.jobTitle, standardWorkingHours: user.standardWorkingHours,
    workStartTime: user.workStartTime,
    workEndTime: user.workEndTime,
    dateOfBirth: user.dateOfBirth,
    homeLocation: user.homeLocation,
    officeLocation: user.officeLocation,
    distanceFromHome: user.distanceFromHome,
    createdAt: user.createdAt,
  };
}

router.get("/v1/users", requireAuth, async (req, res): Promise<void> => {
  const { departmentId, role, search } = req.query;
  const conditions = [eq(usersTable.orgId, req.user!.orgId)];
  if (departmentId) conditions.push(eq(usersTable.departmentId, parseInt(String(departmentId), 10)));
  if (role) conditions.push(eq(usersTable.role, String(role)));

  const users = await db.select().from(usersTable).where(and(...conditions));
  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(String(search).toLowerCase()) || u.email.toLowerCase().includes(String(search).toLowerCase()))
    : users;

  const result = await Promise.all(filtered.map(enrichUser));
  res.json(result);
});

router.post("/v1/users", requireAuth, async (req, res): Promise<void> => {
  const { name, email, password, role, departmentId, teamId, managerId, managerAssignedFrom, hireDate, jobTitle, standardWorkingHours, workStartTime, workEndTime, dateOfBirth, homeLocation, officeLocation, distanceFromHome, education, gender, numCompaniesWorked, jobLevel, totalWorkingYearsBeforeHire, yearsSinceLastPromotion } = req.body;
  if (!name || !email || !role || !dateOfBirth) {
    res.status(400).json({ error: "name, email, role, and dateOfBirth are required" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = hashPassword(password ?? "Welcome@123");
  const [user] = await db.insert(usersTable).values({
    orgId: req.user!.orgId, name, email, passwordHash, role,
    departmentId: departmentId ?? null, teamId: teamId ?? null, managerId: managerId ?? null,
    hireDate: hireDate ?? null, jobTitle: jobTitle ?? null,
    standardWorkingHours: standardWorkingHours ?? 8,
    workStartTime: workStartTime ?? "09:00",
    workEndTime: workEndTime ?? "17:00",
    dateOfBirth, homeLocation: homeLocation ?? null, officeLocation: officeLocation ?? null,
    distanceFromHome: distanceFromHome ?? null,
    education: education ?? null,
    gender: gender ?? null,
    numCompaniesWorked: numCompaniesWorked ?? null,
    jobLevel: jobLevel ?? null,
    totalWorkingYearsBeforeHire: totalWorkingYearsBeforeHire ?? null,
    yearsSinceLastPromotion: yearsSinceLastPromotion ?? null,
    mustChangePassword: !password,
  }).returning();

  if (managerId) {
    await db.insert(managerHistoryTable).values({
      orgId: req.user!.orgId,
      employeeId: user.id,
      managerId,
      assignedFrom: managerAssignedFrom ? new Date(managerAssignedFrom) : new Date(),
    });
  }

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "user.create", entityId: String(user.id), payload: { email, role } });
  res.status(201).json(await enrichUser(user));
});

router.get("/v1/users/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [user] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.orgId, req.user!.orgId)));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(await enrichUser(user));
});

router.patch("/v1/users/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, role, departmentId, teamId, managerId, jobTitle, standardWorkingHours, workStartTime, workEndTime, homeLocation, officeLocation, distanceFromHome, education, gender, numCompaniesWorked, jobLevel, totalWorkingYearsBeforeHire, yearsSinceLastPromotion } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name) updates.name = name;
  if (role) updates.role = role;
  if (departmentId !== undefined) updates.departmentId = departmentId;
  if (teamId !== undefined) updates.teamId = teamId;
  if (managerId !== undefined) updates.managerId = managerId;
  if (jobTitle !== undefined) updates.jobTitle = jobTitle;
  if (standardWorkingHours !== undefined) updates.standardWorkingHours = standardWorkingHours;
  if (workStartTime !== undefined) updates.workStartTime = workStartTime;
  if (workEndTime !== undefined) updates.workEndTime = workEndTime;
  if (homeLocation !== undefined) updates.homeLocation = homeLocation;
  if (officeLocation !== undefined) updates.officeLocation = officeLocation;
  if (distanceFromHome !== undefined) updates.distanceFromHome = distanceFromHome;
  if (education !== undefined) updates.education = education;
  if (gender !== undefined) updates.gender = gender;
  if (numCompaniesWorked !== undefined) updates.numCompaniesWorked = numCompaniesWorked;
  if (jobLevel !== undefined) updates.jobLevel = jobLevel;
  if (totalWorkingYearsBeforeHire !== undefined) updates.totalWorkingYearsBeforeHire = totalWorkingYearsBeforeHire;
  if (yearsSinceLastPromotion !== undefined) updates.yearsSinceLastPromotion = yearsSinceLastPromotion;

  const [existing] = await db.select().from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.orgId, req.user!.orgId)));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Handle Manager Reassignment
  if (managerId !== undefined && existing.managerId !== managerId) {
    // Close current active manager history
    await db.update(managerHistoryTable)
      .set({ assignedUntil: new Date() })
      .where(and(
        eq(managerHistoryTable.employeeId, id),
        eq(managerHistoryTable.orgId, req.user!.orgId),
        isNull(managerHistoryTable.assignedUntil)
      ));

    // Open new manager history if there is a new manager
    if (managerId) {
      await db.insert(managerHistoryTable).values({
        orgId: req.user!.orgId,
        employeeId: id,
        managerId,
      });
    }
  }

  const [user] = await db.update(usersTable).set(updates)
    .where(and(eq(usersTable.id, id), eq(usersTable.orgId, req.user!.orgId)))
    .returning();
    
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "user.update", entityId: String(user.id), payload: updates });
  res.json(await enrichUser(user));
});

router.get("/v1/users/:id/manager-history", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const history = await db.select({
    id: managerHistoryTable.id,
    managerId: managerHistoryTable.managerId,
    managerName: usersTable.name,
    assignedFrom: managerHistoryTable.assignedFrom,
    assignedUntil: managerHistoryTable.assignedUntil
  })
  .from(managerHistoryTable)
  .leftJoin(usersTable, eq(managerHistoryTable.managerId, usersTable.id))
  .where(and(eq(managerHistoryTable.employeeId, id), eq(managerHistoryTable.orgId, req.user!.orgId)))
  .orderBy(desc(managerHistoryTable.assignedFrom));
  
  res.json(history);
});

export default router;
