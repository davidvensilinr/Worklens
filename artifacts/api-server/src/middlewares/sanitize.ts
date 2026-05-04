import { type Request, type Response, type NextFunction } from "express";

/**
 * Recursively strip HTML/script tags from all string values in an object.
 * Prevents Stored XSS attacks where malicious scripts could be injected
 * into chat messages, meeting titles, team names, etc.
 */
function stripHtml(value: unknown): unknown {
  if (typeof value === "string") {
    // Remove HTML tags and trim whitespace
    return value
      .replace(/<[^>]*>/g, "")  // Strip HTML tags
      .replace(/javascript:/gi, "") // Strip javascript: protocol
      .replace(/on\w+\s*=/gi, "")  // Strip inline event handlers (onclick=, onerror=, etc.)
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(stripHtml);
  }
  if (value !== null && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      cleaned[key] = stripHtml(val);
    }
    return cleaned;
  }
  return value;
}

/**
 * Express middleware that sanitizes all req.body string fields
 * to prevent stored XSS attacks.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = stripHtml(req.body);
  }
  next();
}
