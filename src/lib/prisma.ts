import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:./dev.db';
  // Strip any whitespace/newlines that may surround the URL
  const dbUrl = rawUrl.trim();
  const libsql = createClient({ url: dbUrl });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();