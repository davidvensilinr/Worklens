import { logger } from "./logger";

/**
 * Validates that all required environment variables are set at startup.
 * If any are missing, the server refuses to start rather than silently
 * falling back to insecure defaults.
 */
export function validateEnv(): void {
  const errors: string[] = [];

  // DATABASE_URL is absolutely required
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is not set. The server cannot connect to the database.");
  }

  // SESSION_SECRET must be explicitly set in production
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) {
      errors.push("SESSION_SECRET is not set. JWT tokens will be signed with an insecure default.");
    }
    if (process.env.SESSION_SECRET === "worklens-dev-secret") {
      errors.push("SESSION_SECRET is set to the default development value. Use a strong random secret in production.");
    }
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
      errors.push("SESSION_SECRET is too short. Use at least 32 characters.");
    }
  }

  if (errors.length > 0) {
    logger.error({ errors }, "Environment validation failed");
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  } else {
    logger.info("Environment validation passed");
  }
}
