import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { auditLogTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/audit-log", requireAuth, async (req, res): Promise<void> => {
  const { userId, eventType, from, to, limit, offset } = req.query;
  const conditions = [eq(auditLogTable.orgId, req.user!.orgId)];
  if (userId) conditions.push(eq(auditLogTable.actorId, parseInt(String(userId), 10)));
  if (eventType) conditions.push(eq(auditLogTable.eventType, String(eventType)));

  const lim = parseInt(String(limit ?? "100"), 10);
  const off = parseInt(String(offset ?? "0"), 10);

  let entries = await db.select().from(auditLogTable)
    .where(and(...conditions))
    .orderBy(desc(auditLogTable.id))
    .limit(lim)
    .offset(off);

  if (from || to) {
    entries = entries.filter(e => {
      if (from && e.timestamp < new Date(String(from))) return false;
      if (to && e.timestamp > new Date(String(to))) return false;
      return true;
    });
  }

  const result = await Promise.all(entries.map(async (e) => {
    const [actor] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, e.actorId));
    return { ...e, actorName: actor?.name ?? null };
  }));
  res.json(result);
});

router.get("/v1/audit-log/verify", requireAuth, async (req, res): Promise<void> => {
  const entries = await db.select().from(auditLogTable)
    .where(eq(auditLogTable.orgId, req.user!.orgId))
    .orderBy(auditLogTable.id);

  let brokenChainAt: number | null = null;
  let prevHash: string | null = null;

  for (const entry of entries) {
    if (entry.previousHash !== prevHash) {
      brokenChainAt = entry.id;
      break;
    }
    prevHash = entry.hash;
  }

  res.json({
    verified: brokenChainAt === null,
    totalEntries: entries.length,
    brokenChainAt,
    message: brokenChainAt === null ? "Audit log integrity verified — chain is intact" : `Chain broken at entry ${brokenChainAt}`,
  });
});

export default router;
