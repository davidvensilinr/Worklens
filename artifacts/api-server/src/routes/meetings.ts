import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import { meetingsTable, usersTable, conversationsTable, conversationParticipantsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logEvent } from "../lib/audit";

const router: IRouter = Router();

type Attendee = { userId: number; userName?: string | null; response: string };

async function enrichMeeting(meeting: typeof meetingsTable.$inferSelect) {
  const [organizer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, meeting.organizerId));
  const rawAttendees = (meeting.attendees as Attendee[]) ?? [];
  const attendees = await Promise.all(rawAttendees.map(async (a) => {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.userId));
    return { userId: a.userId, userName: u?.name ?? null, response: a.response };
  }));
  return { ...meeting, organizerName: organizer?.name ?? null, attendees };
}

router.get("/v1/meetings", requireAuth, async (req, res): Promise<void> => {
  const { from, to } = req.query;
  const conditions = [eq(meetingsTable.orgId, req.user!.orgId)];
  const meetings = await db.select().from(meetingsTable).where(and(...conditions));
  const filtered = meetings.filter(m => {
    if (from && m.scheduledAt < new Date(String(from))) return false;
    if (to && m.scheduledAt > new Date(String(to))) return false;
    return true;
  });
  const result = await Promise.all(filtered.map(enrichMeeting));
  res.json(result);
});

router.post("/v1/meetings", requireAuth, async (req, res): Promise<void> => {
  const { title, description, scheduledAt, durationMinutes, agenda, attendeeIds } = req.body;
  if (!title || !scheduledAt) {
    res.status(400).json({ error: "title and scheduledAt are required" });
    return;
  }
  const attendees: Attendee[] = (attendeeIds ?? []).map((id: number) => ({ userId: id, response: "pending" }));
  
  // Create a dedicated group conversation for the meeting chat
  const [conversation] = await db.insert(conversationsTable).values({
    isGroup: true,
    name: `Meeting: ${title}`,
  }).returning();

  // Add organizer and attendees to the conversation
  const allParticipantIds = Array.from(new Set([req.user!.userId, ...(attendeeIds ?? [])]));
  if (allParticipantIds.length > 0) {
    await db.insert(conversationParticipantsTable).values(
      allParticipantIds.map(pid => ({ conversationId: conversation.id, userId: pid }))
    );
  }

  const [meeting] = await db.insert(meetingsTable).values({
    orgId: req.user!.orgId, organizerId: req.user!.userId, title,
    description: description ?? null, scheduledAt: new Date(scheduledAt),
    durationMinutes: durationMinutes ?? null, agenda: agenda ?? null,
    status: "scheduled", attendees, conversationId: conversation.id,
  }).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "meeting.create", entityId: String(meeting.id), payload: { title, scheduledAt } });
  res.status(201).json(await enrichMeeting(meeting));
});

router.get("/v1/meetings/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [meeting] = await db.select().from(meetingsTable)
    .where(and(eq(meetingsTable.id, id), eq(meetingsTable.orgId, req.user!.orgId)));
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(await enrichMeeting(meeting));
});

router.patch("/v1/meetings/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { title, scheduledAt, durationMinutes, agenda, minutes, status } = req.body;
  const [meeting] = await db.update(meetingsTable).set({
    ...(title && { title }),
    ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
    ...(durationMinutes !== undefined && { durationMinutes }),
    ...(agenda !== undefined && { agenda }),
    ...(minutes !== undefined && { minutes }),
    ...(status && { status }),
  }).where(and(eq(meetingsTable.id, id), eq(meetingsTable.orgId, req.user!.orgId))).returning();
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(await enrichMeeting(meeting));
});

router.post("/v1/meetings/:id/respond", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { response } = req.body;
  if (!response || !["accepted", "declined"].includes(response)) {
    res.status(400).json({ error: "response must be accepted or declined" });
    return;
  }
  const [meeting] = await db.select().from(meetingsTable)
    .where(and(eq(meetingsTable.id, id), eq(meetingsTable.orgId, req.user!.orgId)));
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  const attendees = (meeting.attendees as Attendee[]).map((a) =>
    a.userId === req.user!.userId ? { ...a, response } : a
  );
  const [updated] = await db.update(meetingsTable).set({ attendees })
    .where(eq(meetingsTable.id, id)).returning();
  await logEvent({ orgId: req.user!.orgId, actorId: req.user!.userId, eventType: "meeting.respond", entityId: String(id), payload: { response } });
  res.json(await enrichMeeting(updated));
});

export default router;
