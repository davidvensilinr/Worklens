import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, organizationsTable } from "@workspace/db";
import { signToken, hashPassword, verifyPassword } from "../lib/jwt";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

router.post("/v1/auth/register", async (req, res): Promise<void> => {
  const { organizationName, email, password, name } = req.body;
  if (!organizationName || !email || !password || !name) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [org] = await db.insert(organizationsTable).values({ name: organizationName }).returning();
  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    orgId: org.id,
    name,
    email,
    passwordHash,
    role: "super_admin",
    mustChangePassword: false,
  }).returning();

  await logEvent({ orgId: org.id, actorId: user.id, eventType: "user.register", entityId: String(user.id), payload: { email } });

  const token = signToken({ userId: user.id, orgId: org.id, role: user.role, email: user.email });
  res.status(201).json({
    token,
    user: {
      id: user.id, orgId: user.orgId, name: user.name, email: user.email,
      role: user.role, departmentId: user.departmentId, managerId: user.managerId,
      hireDate: user.hireDate, jobTitle: user.jobTitle, createdAt: user.createdAt,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

router.post("/v1/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Missing email or password" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await logEvent({ orgId: user.orgId, actorId: user.id, eventType: "user.login", entityId: String(user.id), payload: { email } });

  const token = signToken({ userId: user.id, orgId: user.orgId, role: user.role, email: user.email });
  res.json({
    token,
    user: {
      id: user.id, orgId: user.orgId, name: user.name, email: user.email,
      role: user.role, departmentId: user.departmentId, managerId: user.managerId,
      hireDate: user.hireDate, jobTitle: user.jobTitle, createdAt: user.createdAt,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

router.post("/v1/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash, mustChangePassword: false }).where(eq(usersTable.id, user.id));

  await logEvent({ orgId: user.orgId, actorId: user.id, eventType: "user.change_password", entityId: String(user.id) });

  res.json({ success: true, message: "Password changed successfully" });
});

router.post("/v1/auth/logout", requireAuth, async (req, res): Promise<void> => {
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "user.logout", entityId: String(req.user!.userId) });
  res.sendStatus(204);
});

router.get("/v1/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id, orgId: user.orgId, name: user.name, email: user.email,
    role: user.role, departmentId: user.departmentId, managerId: user.managerId,
    hireDate: user.hireDate, jobTitle: user.jobTitle, createdAt: user.createdAt,
    mustChangePassword: user.mustChangePassword,
  });
});

export default router;
