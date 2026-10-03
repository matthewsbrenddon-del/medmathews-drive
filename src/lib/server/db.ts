import "server-only";
import { PrismaClient } from "@prisma/client";

/** Contas e sincronização só existem com um banco configurado. Sem
 * DATABASE_URL a plataforma continua funcionando 100% local (modo demonstração). */
export const AUTH_ENABLED = Boolean(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
