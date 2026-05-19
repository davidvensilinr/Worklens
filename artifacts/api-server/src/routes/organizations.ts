import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { organizationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

router.get("/v1/organizations/current", requireAuth, async (req, res): Promise<void> => {
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, req.user!.orgId));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json(org);
});

router.patch("/v1/organizations/current", requireAuth, async (req, res): Promise<void> => {
  const { name, domain } = req.body;
  const [org] = await db.update(organizationsTable)
    .set({ ...(name && { name }), ...(domain !== undefined && { domain }) })
    .where(eq(organizationsTable.id, req.user!.orgId))
    .returning();
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "organization.update", entityId: String(org.id), payload: { name, domain } });
  res.json(org);
});

export default router;
