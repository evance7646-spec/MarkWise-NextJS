import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Ensures the DATABASE_URL always uses the transaction pooler (port 6543),
 * pgbouncer=true, a reasonable connection_limit, and a generous pool_timeout.
 *
 * - Switches port 5432 → 6543 on the pooler host (prevents MaxClientsInSessionMode)
 * - connection_limit=5 per instance allows concurrent requests without exhausting the DB
 * - pool_timeout=30 gives enough headroom for cold starts / slow queries (default was 10s)
 * - connect_timeout=60 gives Supabase free-tier enough time to wake from pause (default ~5s)
 * - pgbouncer=true disables Prisma advisory locks incompatible with PgBouncer transaction mode
 */
function getPoolerUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  try {
    const parsed = new URL(url);
    // Auto-switch from session pooler (5432) to transaction pooler (6543)
    if (parsed.hostname.includes("pooler.supabase.com") && parsed.port === "5432") {
      parsed.port = "6543";
    }
    parsed.searchParams.set("pgbouncer", "true");
    // Allow 5 concurrent connections per instance (not 1) to handle concurrent requests
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "5");
    }
    // Increase pool acquisition timeout from 10s default to 30s
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "30");
    }
    // Increase TCP connect timeout from ~5s default to 60s — critical for Supabase
    // free-tier projects that pause after inactivity (wake-up takes 5-15s)
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "60");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: { db: { url: getPoolerUrl() } },
  });

// Always cache on globalThis to prevent multiple instances
// (handles HMR in dev AND module re-evaluation edge cases in serverless)
globalForPrisma.prisma ??= prisma;

/**
 * Wraps a Prisma operation with automatic retry for transient connectivity errors
 * (P1001 = can't reach server, P1008 = operations timeout, P1017 = server closed connection).
 * Useful for routes that hit Supabase immediately after a cold start.
 *
 * @example
 *   const data = await withRetry(() => prisma.user.findMany());
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000,
): Promise<T> {
  const RETRYABLE = new Set(["P1001", "P1008", "P1017"]);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = err instanceof Prisma.PrismaClientKnownRequestError ? err.code : null;
      if (code && RETRYABLE.has(code) && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
  // TypeScript unreachable — retries exhausted above throws
  throw new Error("withRetry: exhausted retries");
}
