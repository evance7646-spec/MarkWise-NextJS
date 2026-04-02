import "dotenv/config";
import { PrismaClient } from "@prisma/client";

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
