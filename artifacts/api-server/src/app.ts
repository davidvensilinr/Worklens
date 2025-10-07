import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./middlewares/security";
import { sanitizeInput } from "./middlewares/sanitize";
import { validateEnv } from "./lib/env";
import path from "path";

// Validate environment variables before anything else
validateEnv();

const app: Express = express();

// --- Logging ---
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// --- Security Headers ---
app.use(securityHeaders);

// --- CORS: Strict Origin Whitelist ---
const ALLOWED_ORIGINS = process.env.NODE_ENV === "production"
  ? (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()).filter(Boolean)
  : ["http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:5173"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// --- Request Body Size Limits ---
// Prevent attackers from sending massive payloads to crash server memory
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// --- Input Sanitization (anti-XSS) ---
app.use(sanitizeInput);

// --- Global Rate Limiting ---
// 100 requests per minute per IP address
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use("/api", globalLimiter);

// --- Strict Auth Rate Limiting ---
// 5 login/register attempts per 15 minutes per IP (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again in 15 minutes." },
});
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);

// --- API Routes ---
app.use("/api", router);

// --- Static File Serving (uploads) ---
// Set security headers for uploaded files specifically
app.use("/uploads", (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "attachment"); // Force download instead of inline execution
  next();
}, express.static(path.join(process.cwd(), "uploads")));

export default app;
