import { Router, type IRouter } from "express";
import { eq, or, and, desc } from "drizzle-orm";
import { db, conversationsTable, conversationParticipantsTable, messagesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

// --- File Upload Security Configuration ---
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types (whitelist approach — block everything else)
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
]);

// Blocked file extensions (defense-in-depth — even if MIME check passes)
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".com",
  ".vbs", ".js", ".jsx", ".ts", ".tsx", ".php", ".py", ".rb",
  ".jar", ".class", ".war",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Sanitize original filename: strip path components and special characters
    const sanitized = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
      .replace(/\.{2,}/g, "."); // Prevent .. path traversal
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + "-" + sanitized);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1, // Only 1 file per request
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type ${ext} is not allowed`));
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(`MIME type ${file.mimetype} is not allowed`));
    }
    cb(null, true);
  },
});

router.get("/v1/chat/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  // Get all conversations this user is part of
  const participations = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, userId));
  
  if (participations.length === 0) {
    res.json([]);
    return;
  }

  const conversationIds = participations.map(p => p.conversationId);
  const conversations = await db.select().from(conversationsTable)
    .where(inArray(conversationsTable.id, conversationIds));

  // Get all participants for these conversations to format the result
  const allParticipants = await db.select({
    conversationId: conversationParticipantsTable.conversationId,
    userId: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
  })
  .from(conversationParticipantsTable)
  .innerJoin(usersTable, eq(usersTable.id, conversationParticipantsTable.userId))
  .where(inArray(conversationParticipantsTable.conversationId, conversationIds));

  const result = conversations.map(c => {
    const participants = allParticipants.filter(p => p.conversationId === c.id);
    // If it's a 1-on-1, use the other person's name as the conversation name
    let name = c.name;
    if (!c.isGroup) {
      const other = participants.find(p => p.userId !== userId);
      name = other ? other.name : "Unknown";
    }
    return { ...c, name, participants };
  });

  res.json(result);
});

router.post("/v1/chat/conversations", requireAuth, async (req, res): Promise<void> => {
  const { participantIds, isGroup, name } = req.body;
  const userId = req.user!.userId;
  
  const allParticipantIds = Array.from(new Set([userId, ...participantIds]));

  if (!isGroup && allParticipantIds.length === 2) {
    // Check if a 1-on-1 conversation already exists
    // This is a bit tricky with Drizzle, so we do it in code for simplicity
    const myConversations = await db.select().from(conversationParticipantsTable).where(eq(conversationParticipantsTable.userId, userId));
    const otherConversations = await db.select().from(conversationParticipantsTable).where(eq(conversationParticipantsTable.userId, allParticipantIds.find(id => id !== userId)!));
    
    const sharedIds = myConversations.map(c => c.conversationId).filter(id => otherConversations.some(oc => oc.conversationId === id));
    if (sharedIds.length > 0) {
      const existing = await db.select().from(conversationsTable).where(and(inArray(conversationsTable.id, sharedIds), eq(conversationsTable.isGroup, false)));
      if (existing.length > 0) {
        res.json(existing[0]);
        return;
      }
    }
  }

  const [conversation] = await db.insert(conversationsTable).values({
    isGroup: isGroup ?? false,
    name: name || null,
  }).returning();

  await Promise.all(allParticipantIds.map(pid => 
    db.insert(conversationParticipantsTable).values({ conversationId: conversation.id, userId: pid })
  ));

  res.status(201).json(conversation);
});

router.get("/v1/chat/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const conversationId = parseInt(req.params.id as string, 10);
  
  // Verify participation
  const [participation] = await db.select().from(conversationParticipantsTable)
    .where(and(eq(conversationParticipantsTable.conversationId, conversationId), eq(conversationParticipantsTable.userId, req.user!.userId)));
    
  if (!participation) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }

  const messages = await db.select({
    id: messagesTable.id,
    conversationId: messagesTable.conversationId,
    senderId: messagesTable.senderId,
    content: messagesTable.content,
    attachmentUrl: messagesTable.attachmentUrl,
    attachmentType: messagesTable.attachmentType,
    replyToMessageId: messagesTable.replyToMessageId,
    createdAt: messagesTable.createdAt,
    senderName: usersTable.name,
  })
  .from(messagesTable)
  .innerJoin(usersTable, eq(usersTable.id, messagesTable.senderId))
  .where(eq(messagesTable.conversationId, conversationId))
  .orderBy(messagesTable.createdAt); // Ascending

  res.json(messages);
});

router.post("/v1/chat/upload", requireAuth, upload.single("file"), (req, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

export default router;

// Helper to use inArray since it wasn't imported at the top
import { inArray as drizzleInArray } from "drizzle-orm";
function inArray(column: any, values: any[]) {
  if (values.length === 0) return eq(column, -1); // Fallback for empty array
  return drizzleInArray(column, values);
}
