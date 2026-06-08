import { PrismaClient } from '@prisma/client';

export type DbClient = PrismaClient;

export const createPrismaClient = (databaseUrl?: string): PrismaClient => {
  if (!databaseUrl) return new PrismaClient();

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
};

