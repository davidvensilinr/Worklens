import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import { attendanceTable, usersTable, claimsTable } from "@workspace/db";
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

router.get("/v1/attendance", requireAuth, async (req, res): Promise<void> => {
  const { userId, from, to } = req.query;
  const conditions = [eq(attendanceTable.orgId, req.user!.orgId)];
  if (userId) conditions.push(eq(attendanceTable.userId, parseInt(String(userId), 10)));
  if (from) conditions.push(gte(attendanceTable.date, String(from)));
  if (to) conditions.push(lte(attendanceTable.date, String(to)));

  const records = await db.select().from(attendanceTable).where(and(...conditions));
  const result = await Promise.all(records.map(async (r) => {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.userId));
    return { ...r, userName: u?.name ?? null };
  }));
  res.json(result);
});

router.get("/v1/attendance/warnings", requireAuth, async (req, res): Promise<void> => {
  // Find attendance records with unverified photos older than 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const records = await db.select().from(attendanceTable).where(
    and(
      eq(attendanceTable.orgId, req.user!.orgId),
      eq(attendanceTable.isPhotoVerified, false),
      lte(attendanceTable.clockIn, twentyFourHoursAgo)
    )
  );

  const result = await Promise.all(records.filter(r => r.photoUrl).map(async (r) => {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.userId));
    return { ...r, userName: u?.name ?? null };
  }));
  
  res.json(result);
});

router.post("/v1/attendance", requireAuth, upload.single("photo"), async (req, res): Promise<void> => {
  const { date, isRemote, isSick, leaveType, notes, latitude, longitude } = req.body;
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }

  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  let claimId: number | null = null;
  if (photoUrl) {
    const [claim] = await db.insert(claimsTable).values({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      claimType: "attendance_photo",
      description: "Clock-in photo verification",
      proofUrl: photoUrl,
      status: "pending"
    }).returning();
    claimId = claim.id;
  }

  const [record] = await db.insert(attendanceTable).values({
    orgId: req.user!.orgId, userId: req.user!.userId, date,
    clockIn: new Date(), 
    isRemote: isRemote === "true" || isRemote === true,
    isSick: isSick === "true" || isSick === true, 
    leaveType: leaveType ?? null, notes: notes ?? null,
    latitude: latitude ? parseFloat(latitude) : null, 
    longitude: longitude ? parseFloat(longitude) : null,
    isOvertime: false,
    photoUrl, claimId, isPhotoVerified: false,
    isLate: false, minutesLate: null,
  }).returning();

  // Compute lateness based on employee's work schedule
  const [empUser] = await db.select({ workStartTime: usersTable.workStartTime }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  let isLate = false;
  let minutesLate: number | null = null;
  if (empUser?.workStartTime) {
    const [sh, sm] = empUser.workStartTime.split(":").map(Number);
    const now = new Date(record.clockIn);
    const scheduledStart = new Date(now);
    scheduledStart.setHours(sh, sm, 0, 0);
    const diffMs = now.getTime() - scheduledStart.getTime();
    if (diffMs > 0) {
      isLate = true;
      minutesLate = Math.floor(diffMs / 60000);
    }
  }
  // Update the record with lateness info
  const [finalRecord] = await db.update(attendanceTable)
    .set({ isLate, minutesLate })
    .where(eq(attendanceTable.id, record.id))
    .returning();

  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "attendance.clockin", entityId: String(finalRecord.id), payload: { date, isLate, minutesLate } });
  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.status(201).json({ ...finalRecord, userName: u?.name ?? null });
});

router.post("/v1/attendance/:id/clockout", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const clockOut = new Date();
  const [existing] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }
  const hoursWorked = (clockOut.getTime() - existing.clockIn.getTime()) / 1000 / 3600;
  
  const otherRecords = await db.select().from(attendanceTable).where(
    and(
      eq(attendanceTable.userId, existing.userId),
      eq(attendanceTable.date, existing.date)
    )
  );
  const pastHours = otherRecords.filter(r => r.id !== id && r.hoursWorked != null).reduce((sum, r) => sum + r.hoursWorked!, 0);
  const totalHoursToday = pastHours + hoursWorked;

  const [u] = await db.select({ name: usersTable.name, standardWorkingHours: usersTable.standardWorkingHours }).from(usersTable).where(eq(usersTable.id, existing.userId));
  const standardHours = u?.standardWorkingHours ?? 8;
  const isOvertime = totalHoursToday > standardHours;

  const [record] = await db.update(attendanceTable).set({ clockOut, hoursWorked, isOvertime })
    .where(eq(attendanceTable.id, id)).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "attendance.clockout", entityId: String(record.id), payload: { hoursWorked, totalHoursToday, isOvertime } });
  res.json({ ...record, userName: u?.name ?? null });
});

export default router;
