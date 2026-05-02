import { type Request, type Response, type NextFunction } from "express";

/**
 * Security headers middleware.
 * Sets HTTP headers that instruct browsers to enable built-in protections.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent browsers from MIME-type sniffing (stops XSS via uploaded files)
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent the app from being embedded in iframes (stops clickjacking)
  res.setHeader("X-Frame-Options", "DENY");

  // Enable browser's built-in XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Force HTTPS for 1 year (browsers will refuse HTTP connections)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Control what referrer info is sent to external sites
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Disable unnecessary browser features from being accessed by iframes
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Prevent caching of sensitive API responses
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
  }

  next();
}
