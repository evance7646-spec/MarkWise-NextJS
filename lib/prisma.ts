import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Ensures the DATABASE_URL always uses the transaction pooler (port 6543)
 * and has pgbouncer=true + connection_limit=1.
 * This guards against Vercel env vars accidentally using the session pooler (port 5432),
 * which causes "MaxClientsInSessionMode: max clients reached".
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
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
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
