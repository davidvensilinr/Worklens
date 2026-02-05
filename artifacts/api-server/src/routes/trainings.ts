import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { trainingCertificationsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), "uploads")),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + path.extname(file.originalname))
});
const upload = multer({ storage });

const router: IRouter = Router();

router.get("/v1/training-certifications", requireAuth, async (req, res): Promise<void> => {
  const records = await db.select().from(trainingCertificationsTable)
    .where(eq(trainingCertificationsTable.orgId, req.user!.orgId))
    .orderBy(desc(trainingCertificationsTable.createdAt));

  const result = await Promise.all(records.map(async (r) => {
    const [u] = await db.select({ name: usersTable.name, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, r.userId));
    let reviewerName = null;
    if (r.reviewedBy) {
      const [rev] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.reviewedBy));
      reviewerName = rev?.name ?? null;
    }
    return { ...r, userName: u?.name ?? null, userRole: u?.role ?? null, reviewerName };
  }));

  res.json(result);
});

router.post("/v1/training-certifications", requireAuth, upload.single("document"), async (req, res): Promise<void> => {
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const documentUrl = req.file ? `/uploads/${req.file.filename}` : null;
  if (!documentUrl) {
    res.status(400).json({ error: "document upload is required" });
    return;
  }

  const [record] = await db.insert(trainingCertificationsTable).values({
    orgId: req.user!.orgId,
    userId: req.user!.userId,
    title,
    documentUrl,
    status: "pending"
  }).returning();
  
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "training.submitted", entityId: String(record.id), payload: { title } });
  const [u] = await db.select({ name: usersTable.name, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  
  res.status(201).json({ ...record, userName: u?.name ?? null, userRole: u?.role ?? null, reviewerName: null });
});

router.patch("/v1/training-certifications/:id/review", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { status, trainingHours } = req.body;
  
  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be approved or rejected" });
    return;
  }

  if (status === "approved" && (trainingHours === undefined || trainingHours === null)) {
    res.status(400).json({ error: "trainingHours is required when approving" });
    return;
  }

  const [existing] = await db.select().from(trainingCertificationsTable).where(eq(trainingCertificationsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Training record not found" });
    return;
  }

  const [record] = await db.update(trainingCertificationsTable).set({
    status,
    trainingHours: status === "approved" ? parseFloat(trainingHours) : null,
    reviewedBy: req.user!.userId,
    reviewedAt: new Date(),
  }).where(eq(trainingCertificationsTable.id, id)).returning();

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "training.reviewed", entityId: String(record.id), payload: { status, trainingHours } });
  
  const [u] = await db.select({ name: usersTable.name, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, record.userId));
  const [rev] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  
  res.json({ ...record, userName: u?.name ?? null, userRole: u?.role ?? null, reviewerName: rev?.name ?? null });
});

export default router;
