import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { promotionsTable, recognitionsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

router.get("/v1/promotions", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req.query;
  const conditions = [eq(promotionsTable.orgId, req.user!.orgId)];
  if (userId) conditions.push(eq(promotionsTable.userId, parseInt(String(userId), 10)));
  const promotions = await db.select().from(promotionsTable).where(and(...conditions));
  const result = await Promise.all(promotions.map(async (p) => {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, p.userId));
    let promotedByName: string | null = null;
    if (p.promotedById) {
      const [m] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, p.promotedById));
      promotedByName = m?.name ?? null;
    }
    return { ...p, userName: u?.name ?? null, promotedByName };
  }));
  res.json(result);
});

router.post("/v1/promotions", requireAuth, async (req, res): Promise<void> => {
  const { userId, oldRole, newRole, notes } = req.body;
  if (!userId || !oldRole || !newRole) {
    res.status(400).json({ error: "userId, oldRole, newRole are required" });
    return;
  }
  const [promotion] = await db.insert(promotionsTable).values({
    orgId: req.user!.orgId, userId, oldRole, newRole,
    promotedById: req.user!.userId, notes: notes ?? null,
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "promotion.create", entityId: String(promotion.id), payload: { userId, oldRole, newRole } });
  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  const [m] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.status(201).json({ ...promotion, userName: u?.name ?? null, promotedByName: m?.name ?? null });
});

router.get("/v1/recognitions", requireAuth, async (req, res): Promise<void> => {
  const { recipientId, giverId } = req.query;
  const conditions = [eq(recognitionsTable.orgId, req.user!.orgId)];
  if (recipientId) conditions.push(eq(recognitionsTable.recipientId, parseInt(String(recipientId), 10)));
  if (giverId) conditions.push(eq(recognitionsTable.giverId, parseInt(String(giverId), 10)));
  const recognitions = await db.select().from(recognitionsTable).where(and(...conditions));
  const result = await Promise.all(recognitions.map(async (r) => {
    const [giver] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.giverId));
    const [recipient] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.recipientId));
    return { ...r, giverName: giver?.name ?? null, recipientName: recipient?.name ?? null };
  }));
  res.json(result);
});

router.post("/v1/recognitions", requireAuth, async (req, res): Promise<void> => {
  const { recipientId, badge, message } = req.body;
  if (!recipientId || !badge) {
    res.status(400).json({ error: "recipientId and badge are required" });
    return;
  }
  const [recognition] = await db.insert(recognitionsTable).values({
    orgId: req.user!.orgId, giverId: req.user!.userId, recipientId, badge, message: message ?? null,
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "recognition.create", entityId: String(recognition.id), payload: { recipientId, badge } });
  const [giver] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  const [recipient] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, recipientId));
  res.status(201).json({ ...recognition, giverName: giver?.name ?? null, recipientName: recipient?.name ?? null });
});

export default router;
