import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma CLI resolves a relative SQLite URL ("file:./dev.db") against the
 * prisma/ folder. Inside Next's Turbopack bundle the generated client can't
 * do that reliably, so resolve it to an absolute path the same way.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:./") && !url?.startsWith("file:../")) return url;
  return `file:${path.resolve(process.cwd(), "prisma", url.slice("file:".length))}`;
}

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
