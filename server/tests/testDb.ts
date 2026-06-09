import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '../db/client';

const migrationPath = path.resolve(
  'server/db/migrations/20260607223000_init/migration.sql'
);

export interface TestDatabase {
  db: PrismaClient;
  databaseUrl: string;
  cleanup: () => Promise<void>;
}

const applyMigration = async (db: PrismaClient) => {
  const sql = readFileSync(migrationPath, 'utf8').replace('"cavityCount" INTEGER', '"cavityCount" TEXT');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  statements.push(`
    ALTER TABLE "ToolingRecord" ADD COLUMN "toolingNumber" TEXT NOT NULL DEFAULT ''
  `);
  statements.push(`
    ALTER TABLE "ToolingRecord" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'injection-mold'
  `);
  statements.push(`
    ALTER TABLE "ToolingRecord" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending'
  `);
  statements.push(`
    ALTER TABLE "ToolingRecord" ADD COLUMN "leadTimeDays" INTEGER
  `);
  statements.push(`
    CREATE TABLE IF NOT EXISTS "Attachment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "workspaceId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "size" TEXT,
        "uploadDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "partId" TEXT,
        "bomNodeId" TEXT,
        CONSTRAINT "Attachment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Attachment_bomNodeId_fkey" FOREIGN KEY ("bomNodeId") REFERENCES "BOMNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  for (const statement of statements) {
    await db.$executeRawUnsafe(statement);
  }
};

const seedIdentity = async (db: PrismaClient) => {
  await db.workspace.create({
    data: {
      id: 'workspace-test',
      name: 'Test Workspace',
    },
  });

  const users = [
    ['user-admin', 'admin@test.local', 'Admin User', 'ADMIN'],
    ['user-engineer', 'engineer@test.local', 'Engineer User', 'ENG_LEAD'],
    ['user-sourcing', 'sourcing@test.local', 'Sourcing User', 'SOURCING'],
    ['user-viewer', 'viewer@test.local', 'Viewer User', 'VIEWER'],
  ] as const;

  for (const [id, email, name, role] of users) {
    await db.user.create({
      data: {
        id,
        email,
        name,
        memberships: {
          create: {
            id: `membership-${role.toLowerCase()}`,
            workspaceId: 'workspace-test',
            role,
          },
        },
      },
    });
  }

  await db.workspace.create({
    data: {
      id: 'workspace-other',
      name: 'Other Workspace',
      projects: {
        create: {
          id: 'project-other',
          code: 'OTHER',
          name: 'Other Project',
          sku: 'Other SKU',
          phase: 'EVT',
        },
      },
    },
  });
};

const seedCoreData = async (db: PrismaClient) => {
  await db.project.create({
    data: {
      id: 'project-test',
      workspaceId: 'workspace-test',
      code: 'ZPM-T',
      name: 'zPhone Test Project',
      sku: 'Test SKU',
      phase: 'DVT',
    },
  });

  await db.part.createMany({
    data: [
      {
        id: 'part-soc',
        workspaceId: 'workspace-test',
        partNumber: '100-55512-A',
        name: 'SoC Snapdragon',
        description: 'SoC, Snapdragon 8 Gen 3',
        type: 'Part',
        lifecycleState: 'Released',
        manufacturer: 'Qualcomm',
        mpn: 'SM8650',
        cost: 35,
        currency: 'USD',
        leadTimeWeeks: 16,
        moq: 1000,
        spq: 250,
      },
      {
        id: 'part-cover',
        workspaceId: 'workspace-test',
        partNumber: 'ZP-A-STD-COVER-BLK',
        name: 'Black Enclosure Cover',
        description: 'Concrete enclosure cover',
        type: 'Part',
        lifecycleState: 'Draft',
        manufacturer: 'Internal',
        mpn: 'ZP-A-STD-COVER-BLK',
        cost: 0,
        currency: 'USD',
      },
      {
        id: 'part-other',
        workspaceId: 'workspace-other',
        partNumber: 'OTHER-PART',
        name: 'Other Workspace Part',
        type: 'Part',
        lifecycleState: 'Released',
      },
    ],
  });

  await db.bOMNode.create({
    data: {
      id: 'bom-root',
      workspaceId: 'workspace-test',
      projectId: 'project-test',
      partNumber: '800-TEST',
      name: 'Test Top Assembly',
      revision: 'A',
      state: 'Prototype',
      type: 'Assembly',
      quantity: 1,
      unit: 'EA',
      cost: 0,
      currency: 'USD',
      customAttributesJson: JSON.stringify({ platform: 'test' }),
    },
  });

  await db.bOMNode.create({
    data: {
      id: 'bom-child-soc',
      workspaceId: 'workspace-test',
      projectId: 'project-test',
      parentId: 'bom-root',
      partId: 'part-soc',
      partNumber: '100-55512-A',
      name: 'SoC Snapdragon',
      revision: 'A',
      state: 'Released',
      type: 'Part',
      quantity: 1,
      unit: 'EA',
      cost: 35,
      currency: 'USD',
    },
  });

  await db.toolingDesignMaster.create({
    data: {
      id: 'dmp-cover',
      workspaceId: 'workspace-test',
      projectId: 'project-test',
      code: 'DMP-COVER',
      name: 'Enclosure Cover',
      mappings: {
        create: {
          id: 'mapping-cover-black',
          workspaceId: 'workspace-test',
          partId: 'part-cover',
        },
      },
    },
  });

  await db.toolingRecord.create({
    data: {
      id: 'tooling-cover',
      workspaceId: 'workspace-test',
      projectId: 'project-test',
      designMasterId: 'dmp-cover',
      toolingNumber: 'TL-INJ-001',
      name: 'Cover Injection Mold',
      type: 'injection-mold',
      status: 'in-progress',
      supplier: 'Precision Mold Co.',
      owner: 'Tooling PM',
      cavityCount: '2',
      leadTimeDays: 28,
      milestones: {
        create: [
          {
            id: 'tooling-cover-kickoff',
            workspaceId: 'workspace-test',
            key: 'kickoff',
            status: 'DONE',
            plannedDate: new Date('2026-02-01T00:00:00.000Z'),
            actualDate: new Date('2026-02-02T00:00:00.000Z'),
          },
          {
            id: 'tooling-cover-t1',
            workspaceId: 'workspace-test',
            key: 't1',
            status: 'IN_PROGRESS',
            plannedDate: new Date('2026-03-01T00:00:00.000Z'),
          },
        ],
      },
    },
  });
};

export const createTestDatabase = async (): Promise<TestDatabase> => {
  const directory = mkdtempSync(path.join(tmpdir(), 'zbom-api-test-'));
  const databaseUrl = `file:${path.join(directory, 'test.db')}`;
  const db = createPrismaClient(databaseUrl);

  await applyMigration(db);
  await seedIdentity(db);
  await seedCoreData(db);

  return {
    db,
    databaseUrl,
    cleanup: async () => {
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    },
  };
};
