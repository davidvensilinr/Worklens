import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { claimsTable, claimApprovalsTable, usersTable, attendanceTable, tasksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";
import fs from "fs/promises";
import path from "path";

const router: IRouter = Router();

router.get("/v1/verifications/claims", requireAuth, async (req, res): Promise<void> => {
  const claims = await db.select().from(claimsTable)
    .where(eq(claimsTable.orgId, req.user!.orgId))
    .orderBy(desc(claimsTable.createdAt));
  res.json(claims);
});

router.post("/v1/verifications/claims", requireAuth, async (req, res): Promise<void> => {
  const { claimType, description, proofUrl } = req.body;
  
  // Auto-verify survey claims since they are personal subjective metrics
  const isSurvey = claimType.startsWith("survey_");
  const status = isSurvey ? "verified" : "pending";

  const [claim] = await db.insert(claimsTable).values({
    orgId: req.user!.orgId,
    userId: req.user!.userId,
    claimType,
    description,
    proofUrl: proofUrl ?? null,
    status
  }).returning();

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "claim.created", entityId: String(claim.id) });
  res.status(201).json(claim);
});

router.post("/v1/verifications/claims/:claimId/approve", requireAuth, async (req, res): Promise<void> => {
  const claimId = parseInt(Array.isArray(req.params.claimId) ? req.params.claimId[0] : req.params.claimId, 10);
  const { status, reason } = req.body;

  const [claim] = await db.select().from(claimsTable).where(eq(claimsTable.id, claimId));
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  if (claim.userId === req.user!.userId) {
    res.status(403).json({ error: "Cannot verify your own claim" });
    return;
  }

  const [approval] = await db.insert(claimApprovalsTable).values({
    orgId: req.user!.orgId,
    claimId,
    reviewerId: req.user!.userId,
    status,
    reason
  }).returning();

  // If approved/rejected, update the claim status
  await db.update(claimsTable).set({ status }).where(eq(claimsTable.id, claimId));

  if (status === "verified" && claim.claimType === "attendance_photo") {
    // 1. Update attendance record
    const [attendance] = await db.select().from(attendanceTable).where(eq(attendanceTable.claimId, claimId));
    if (attendance) {
      await db.update(attendanceTable).set({
        isPhotoVerified: true,
        photoUrl: null
      }).where(eq(attendanceTable.id, attendance.id));
    }
    
    // 2. Delete the physical photo
    if (claim.proofUrl && claim.proofUrl.startsWith("/uploads/")) {
      try {
        const fileName = claim.proofUrl.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "uploads", fileName);
        await fs.unlink(filePath);
      } catch (e) {
        console.error("Failed to delete attendance photo:", e);
      }
    }
  }

  if (status === "verified" && claim.claimType === "task_delivery" && claim.taskId) {
    // Mark the task as verified
    await db.update(tasksTable).set({
      status: "verified",
      verifiedAt: new Date(),
      verifierId: req.user!.userId,
      progress: 100
    }).where(eq(tasksTable.id, claim.taskId));
  }

  if (status === "rejected" && claim.claimType === "attendance_photo") {
    const { notifyHR } = await import("../lib/notifications");
    await notifyHR(req.user!.orgId, claim.userId, `An attendance photo was rejected by peers (Claim ID: ${claim.id}).`, "claim_rejected");
  }

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: `claim.${status}`, entityId: String(claim.id), payload: { reason } });

  res.status(201).json(approval);
});

export default router;
