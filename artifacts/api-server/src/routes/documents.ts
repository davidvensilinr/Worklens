import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { documentsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

async function enrichDoc(doc: typeof documentsTable.$inferSelect) {
  let uploaderName: string | null = null;
  let verifierName: string | null = null;
  if (doc.uploaderId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, doc.uploaderId));
    uploaderName = u?.name ?? null;
  }
  if (doc.verifierId) {
    const [v] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, doc.verifierId));
    verifierName = v?.name ?? null;
  }
  return { ...doc, uploaderName, verifierName };
}

router.get("/v1/documents", requireAuth, async (req, res): Promise<void> => {
  const { status, uploaderId, departmentId } = req.query;
  const conditions = [eq(documentsTable.orgId, req.user!.orgId)];
  if (status) conditions.push(eq(documentsTable.status, String(status)));
  if (uploaderId) conditions.push(eq(documentsTable.uploaderId, parseInt(String(uploaderId), 10)));
  if (departmentId) conditions.push(eq(documentsTable.departmentId, parseInt(String(departmentId), 10)));

  const docs = await db.select().from(documentsTable).where(and(...conditions));
  const result = await Promise.all(docs.map(enrichDoc));
  res.json(result);
});

router.post("/v1/documents", requireAuth, async (req, res): Promise<void> => {
  const { title, description, deadline, fileUrl, fileType, departmentId } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const [doc] = await db.insert(documentsTable).values({
    orgId: req.user!.orgId, uploaderId: req.user!.userId, title,
    description: description ?? null, deadline: deadline ? new Date(deadline) : null,
    fileUrl: fileUrl ?? null, fileType: fileType ?? null,
    departmentId: departmentId ?? null, status: "pending", version: 1,
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "document.create", entityId: String(doc.id), payload: { title } });
  res.status(201).json(await enrichDoc(doc));
});

router.get("/v1/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [doc] = await db.select().from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.orgId, req.user!.orgId)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(await enrichDoc(doc));
});

router.patch("/v1/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { title, description, deadline } = req.body;
  const [doc] = await db.update(documentsTable).set({
    ...(title && { title }),
    ...(description !== undefined && { description }),
    ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
  }).where(and(eq(documentsTable.id, id), eq(documentsTable.orgId, req.user!.orgId))).returning();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(await enrichDoc(doc));
});

router.post("/v1/documents/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [doc] = await db.update(documentsTable).set({ status: "submitted", submittedAt: new Date() })
    .where(and(eq(documentsTable.id, id), eq(documentsTable.orgId, req.user!.orgId))).returning();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "document.submit", entityId: String(doc.id) });
  res.json(await enrichDoc(doc));
});

router.post("/v1/documents/:id/verify", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { action, rejectionReason } = req.body;
  if (!action || !["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "action must be approve or reject" });
    return;
  }
  const status = action === "approve" ? "approved" : "rejected";
  const [doc] = await db.update(documentsTable).set({
    status, verifiedAt: new Date(), verifierId: req.user!.userId,
    rejectionReason: rejectionReason ?? null,
    ...(status === "rejected" && { version: undefined }),
  }).where(and(eq(documentsTable.id, id), eq(documentsTable.orgId, req.user!.orgId))).returning();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: `document.${action}`, entityId: String(doc.id), payload: { rejectionReason } });
  res.json(await enrichDoc(doc));
});

export default router;
