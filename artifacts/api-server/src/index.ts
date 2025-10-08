import app from "./app";
import trainingsRouter from "./routes/trainings";
import teamsRouter from "./routes/teams";
import { logger } from "./lib/logger";
import { createServer } from "http";
import { Server } from "socket.io";
import { initializeSockets } from "./sockets/chatHandler";

const port = Number(process.env["PORT"] || "5000");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

const httpServer = createServer(app);

// --- Socket.IO with CORS lockdown (mirrors Express CORS) ---
const ALLOWED_ORIGINS = process.env.NODE_ENV === "production"
  ? (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()).filter(Boolean)
  : ["http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:5173"];

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
  // Limit max payload size to 1MB for socket messages
  maxHttpBufferSize: 1e6,
  // Connection timeout
  connectTimeout: 10000,
});

initializeSockets(io);

app.use("/api", trainingsRouter);
app.use("/api", teamsRouter);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Background job for HR Warnings (> 24h unverified attendance photos)
  setInterval(async () => {
    try {
      const { db } = await import("@workspace/db");
      const { attendanceTable } = await import("@workspace/db");
      const { and, eq, lte } = await import("drizzle-orm");
      const { notifyHR } = await import("./lib/notifications");

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const records = await db.select().from(attendanceTable).where(
        and(
          eq(attendanceTable.isPhotoVerified, false),
          eq(attendanceTable.warningSent, false),
          lte(attendanceTable.clockIn, twentyFourHoursAgo)
        )
      );

      for (const record of records) {
        if (!record.photoUrl) continue;
        await notifyHR(record.orgId, record.userId, `An attendance photo from ${new Date(record.clockIn).toLocaleDateString()} has been unverified for over 24 hours.`, "attendance_warning");
        await db.update(attendanceTable).set({ warningSent: true }).where(eq(attendanceTable.id, record.id));
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to run background attendance warning job");
    }
  }, 10 * 60 * 1000); // Check every 10 minutes
});
