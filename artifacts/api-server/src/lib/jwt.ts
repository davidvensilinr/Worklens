import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import bcrypt from "bcrypt";

const SECRET = process.env.SESSION_SECRET ?? "worklens-dev-secret";

// Bcrypt salt rounds — 12 is the industry-standard balance of security vs speed.
// At 12 rounds, a single hash takes ~250ms, making brute-force attacks infeasible.
const BCRYPT_SALT_ROUNDS = 12;

// JWT token lifetime: 24 hours (in seconds)
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

export interface JwtPayload {
  userId: number;
  orgId: number;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function decodeBase64url(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

export function signToken(payload: JwtPayload): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  }));
  const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;

    // Timing-safe signature comparison to prevent timing attacks
    const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
    const sigBuf = Buffer.from(sig, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(decodeBase64url(body)) as JwtPayload;

    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// --- Password Hashing (bcrypt) ---
// bcrypt is deliberately slow and includes a per-password salt,
// making rainbow table attacks and brute-force attacks infeasible.

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password: string, stored: string): boolean {
  // Support legacy HMAC hashes (salt:hash format) for backward compatibility
  if (stored.includes(":") && !stored.startsWith("$2")) {
    const [salt, hash] = stored.split(":");
    const expected = createHmac("sha256", SECRET + salt).update(password).digest("hex");
    return expected === hash;
  }
  // bcrypt comparison (timing-safe internally)
  return bcrypt.compareSync(password, stored);
}
