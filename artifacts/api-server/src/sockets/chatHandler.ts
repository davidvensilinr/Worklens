import { Server, Socket } from "socket.io";
import { verifyToken } from "../lib/jwt";
import { db, messagesTable, usersTable, conversationParticipantsTable } from "@workspace/db";
import { eq, inArray, desc } from "drizzle-orm";

// --- Security Constants ---
const MAX_MESSAGE_LENGTH = 5000;

/**
 * Sanitize a string to prevent stored XSS via WebSocket messages.
 */
function sanitizeContent(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")       // Strip HTML tags
    .replace(/javascript:/gi, "")  // Strip javascript: protocol
    .replace(/on\w+\s*=/gi, "")    // Strip inline event handlers
    .trim();
}

/**
 * Validate that a value is a positive integer (for IDs).
 */
function isValidId(val: unknown): val is number {
  return typeof val === "number" && Number.isInteger(val) && val > 0;
}

export function initializeSockets(io: Server) {
  // --- Authentication Middleware ---
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token || typeof token !== "string") {
      return next(new Error("Authentication error"));
    }
    try {
      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error("Authentication error"));
      }
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user;
    
    // Join personal room for 1-to-1 signaling
    socket.join(`user_${user.userId}`);

    socket.on("join-conversation", async (conversationId: number) => {
      if (!isValidId(conversationId)) return;

      // Security check: is the user a participant?
      const participants = await db.select().from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.conversationId, conversationId));
      
      if (participants.some(p => p.userId === user.userId)) {
        socket.join(`conversation_${conversationId}`);
      }
    });

    socket.on("send-message", async (data: { conversationId: number, content: string, attachmentUrl?: string, attachmentType?: string, replyToMessageId?: number }) => {
      // --- Input Validation ---
      if (!data || typeof data !== "object") return;
      const { conversationId, attachmentUrl, attachmentType, replyToMessageId } = data;
      if (!isValidId(conversationId)) return;

      // Sanitize and validate content
      let content = typeof data.content === "string" ? data.content : "";
      content = sanitizeContent(content);
      if (content.length > MAX_MESSAGE_LENGTH) {
        content = content.slice(0, MAX_MESSAGE_LENGTH);
      }

      // Must have either content or attachment
      if (!content && !attachmentUrl) return;

      // Validate optional fields
      if (replyToMessageId !== undefined && replyToMessageId !== null && !isValidId(replyToMessageId)) return;

      // --- Avg Response Time Logic ---
      const [lastMessage] = await db.select().from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      if (lastMessage && lastMessage.senderId !== user.userId) {
        const now = new Date();
        const diffMins = (now.getTime() - new Date(lastMessage.createdAt).getTime()) / 60000;
        
        const [currentUserStats] = await db.select({
          responseCount: usersTable.responseCount,
          totalResponseTimeMins: usersTable.totalResponseTimeMins
        }).from(usersTable).where(eq(usersTable.id, user.userId));

        if (currentUserStats) {
          const newCount = currentUserStats.responseCount + 1;
          const newTotal = currentUserStats.totalResponseTimeMins + diffMins;
          const newAvg = newTotal / newCount;

          await db.update(usersTable).set({
            responseCount: newCount,
            totalResponseTimeMins: newTotal,
            avgResponseTimeMins: newAvg
          }).where(eq(usersTable.id, user.userId));
        }
      }

      const [message] = await db.insert(messagesTable).values({
        conversationId,
        senderId: user.userId,
        content,
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        replyToMessageId: replyToMessageId || null,
      }).returning();

      const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));

      io.to(`conversation_${conversationId}`).emit("new-message", {
        ...message,
        senderName: sender?.name || "Unknown"
      });
    });

    // --- WebRTC Signaling (with input validation) ---
    socket.on("call-offer", (data: { targetUserId: number, offer: any, conversationId: number }) => {
      if (!data || !isValidId(data.targetUserId) || !isValidId(data.conversationId)) return;
      socket.to(`user_${data.targetUserId}`).emit("call-offer", {
        fromUserId: user.userId,
        offer: data.offer,
        conversationId: data.conversationId,
      });
    });

    socket.on("call-answer", (data: { targetUserId: number, answer: any }) => {
      if (!data || !isValidId(data.targetUserId)) return;
      socket.to(`user_${data.targetUserId}`).emit("call-answer", {
        fromUserId: user.userId,
        answer: data.answer,
      });
    });

    socket.on("ice-candidate", (data: { targetUserId: number, candidate: any }) => {
      if (!data || !isValidId(data.targetUserId)) return;
      socket.to(`user_${data.targetUserId}`).emit("ice-candidate", {
        fromUserId: user.userId,
        candidate: data.candidate,
      });
    });

    socket.on("call-ended", (data: { targetUserId: number }) => {
      if (!data || !isValidId(data.targetUserId)) return;
      socket.to(`user_${data.targetUserId}`).emit("call-ended", {
        fromUserId: user.userId,
      });
    });

    // --- Meeting WebRTC Signaling (Mesh Topology) ---
    socket.on("join-meeting", async (meetingId: number) => {
      if (!isValidId(meetingId)) return;
      const room = `meeting_${meetingId}`;
      socket.join(room);
      
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
      
      socket.to(room).emit("meeting-user-joined", {
        userId: user.userId,
        name: u?.name || "Unknown",
      });
    });

    socket.on("leave-meeting", (meetingId: number) => {
      if (!isValidId(meetingId)) return;
      const room = `meeting_${meetingId}`;
      socket.leave(room);
      socket.to(room).emit("meeting-user-left", {
        userId: user.userId,
      });
    });

    socket.on("meeting-offer", (data: { targetUserId: number, meetingId: number, offer: any }) => {
      if (!data || !isValidId(data.targetUserId) || !isValidId(data.meetingId)) return;
      socket.to(`user_${data.targetUserId}`).emit("meeting-offer", {
        fromUserId: user.userId,
        meetingId: data.meetingId,
        offer: data.offer,
      });
    });

    socket.on("meeting-answer", (data: { targetUserId: number, meetingId: number, answer: any }) => {
      if (!data || !isValidId(data.targetUserId) || !isValidId(data.meetingId)) return;
      socket.to(`user_${data.targetUserId}`).emit("meeting-answer", {
        fromUserId: user.userId,
        meetingId: data.meetingId,
        answer: data.answer,
      });
    });

    socket.on("meeting-ice-candidate", (data: { targetUserId: number, meetingId: number, candidate: any }) => {
      if (!data || !isValidId(data.targetUserId) || !isValidId(data.meetingId)) return;
      socket.to(`user_${data.targetUserId}`).emit("meeting-ice-candidate", {
        fromUserId: user.userId,
        meetingId: data.meetingId,
        candidate: data.candidate,
      });
    });

    socket.on("disconnect", () => {
      // clean up
    });
  });
}
