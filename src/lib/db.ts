import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isStaleClient(client: PrismaClient | undefined): boolean {
  if (!client) return true;
  // After `prisma db push` / generate, HMR may keep an old client without new models.
  const delegate = (client as unknown as Record<string, { findMany?: unknown } | undefined>).systemSetting;
  return typeof delegate?.findMany !== "function";
}

export const prisma = (() => {
  if (!isStaleClient(globalForPrisma.prisma)) {
    return globalForPrisma.prisma!;
  }
  void globalForPrisma.prisma?.$disconnect().catch(() => undefined);
  const client = createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
})();
