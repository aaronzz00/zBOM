import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiBOMNode } from '../../shared/apiTypes';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { recordAuditEvent } from '../services/audit';

interface BOMRouteOptions {
  db: DbClient;
}

const importBOMSchema = z.object({
  csvText: z.string(),
});

interface CSVRow {
  level: number;
  partNumber: string;
  name: string;
  description: string;
  revision: string;
  state: string;
  type: string;
  quantity: number;
  cost: number;
  manufacturer: string;
  mpn: string;
}

const parseCSV = (csvText: string): CSVRow[] => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const parseLine = (line: string) => {
    const res = [];
    let inQuote = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuote = !inQuote; continue; }
      if (char === ',' && !inQuote) { res.push(current); current = ''; continue; }
      current += char;
    }
    res.push(current);
    return res;
  };

  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
  
  const levelIdx = headers.findIndex(h => h === 'level' || h === 'bom level' || h === 'indent');
  const pnIdx = headers.findIndex(h => h === 'part number' || h === 'partnumber' || h === 'pn' || h.includes('part number'));
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'item name' || h.includes('name'));
  const descIdx = headers.findIndex(h => h === 'description' || h.includes('desc'));
  const revIdx = headers.findIndex(h => h === 'revision' || h === 'rev');
  const stateIdx = headers.findIndex(h => h === 'state' || h === 'lifecycle state');
  const typeIdx = headers.findIndex(h => h === 'type' || h === 'component type');
  const qtyIdx = headers.findIndex(h => h === 'quantity' || h === 'qty');
  const costIdx = headers.findIndex(h => h === 'unit cost' || h === 'cost' || h === 'price');
  const mfrIdx = headers.findIndex(h => h === 'manufacturer' || h === 'mfr');
  const mpnIdx = headers.findIndex(h => h === 'mpn' || h === 'mfg part number');

  const dataRows = lines.slice(1).map(parseLine);
  const useIndentation = levelIdx === -1;

  return dataRows.map((row, index) => {
    let rawPn = pnIdx !== -1 ? row[pnIdx] || '' : row[1] || '';
    let level = 0;

    if (useIndentation) {
      const match = rawPn.match(/^([.\s]+)/);
      if (match) {
        const prefix = match[1];
        if (prefix.includes('.')) {
          level = prefix.split('.').length - 1;
        } else {
          level = Math.floor(prefix.length / 2);
        }
      }
    } else {
      const rawLevel = levelIdx !== -1 ? row[levelIdx] || '' : '0';
      if (rawLevel.includes('.')) {
        level = rawLevel.split('.').length - 1;
      } else {
        level = parseInt(rawLevel, 10);
      }
    }

    if (isNaN(level)) level = 0;

    const partNumber = rawPn.replace(/^[.\s]+/, '').trim();
    const name = (nameIdx !== -1 ? row[nameIdx] : row[2]) || 'Imported Item';
    const description = (descIdx !== -1 ? row[descIdx] : row[3]) || '';
    const revision = (revIdx !== -1 ? row[revIdx] : row[4]) || 'A';
    const state = (stateIdx !== -1 ? row[stateIdx] : 'Draft');
    const type = (typeIdx !== -1 ? row[typeIdx] : 'Part');
    const quantity = parseFloat(qtyIdx !== -1 ? row[qtyIdx] : row[7]) || 1;
    const cost = parseFloat(costIdx !== -1 ? row[costIdx] : row[8]) || 0;
    const manufacturer = (mfrIdx !== -1 ? row[mfrIdx] : row[9]) || '';
    const mpn = (mpnIdx !== -1 ? row[mpnIdx] : row[10]) || '';

    return {
      level,
      partNumber,
      name,
      description,
      revision,
      state,
      type,
      quantity,
      cost,
      manufacturer,
      mpn
    };
  });
};

const customAttributesSchema = z.record(z.string(), z.unknown()).nullable().optional();

const createBOMNodeSchema = z.object({
  parentId: z.string().trim().min(1).nullable().optional(),
  partId: z.string().trim().min(1).nullable().optional(),
  partNumber: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(240).optional(),
  revision: z.string().trim().min(1).max(40).default('A'),
  state: z.string().trim().min(1).max(80).default('Draft'),
  type: z.string().trim().min(1).max(80).default('Part'),
  quantity: z.number().positive().default(1),
  unit: z.string().trim().min(1).max(20).default('EA'),
  cost: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(3).max(3).nullable().optional(),
  customAttributes: customAttributesSchema,
}).strict();

const updateBOMNodeSchema = z.object({
  parentId: z.string().trim().min(1).nullable().optional(),
  partId: z.string().trim().min(1).nullable().optional(),
  partNumber: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(240).optional(),
  revision: z.string().trim().min(1).max(40).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  type: z.string().trim().min(1).max(80).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  cost: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(3).max(3).nullable().optional(),
  customAttributes: customAttributesSchema,
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one BOM node field is required.',
});

const bomCostFields = ['cost', 'currency'] as const;
const bomStructureFields = [
  'parentId',
  'partId',
  'partNumber',
  'name',
  'revision',
  'state',
  'type',
  'quantity',
  'unit',
  'customAttributes',
] as const;

type BOMRecord = {
  id: string;
  parentId: string | null;
  partId: string | null;
  partNumber: string;
  name: string;
  revision: string;
  state: string;
  type: string;
  quantity: number;
  unit: string;
  cost: number | null;
  currency: string | null;
  customAttributesJson: string | null;
};

const parseCustomAttributes = (value: string | null): Record<string, unknown> | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
};

const toApiNode = (record: BOMRecord): ApiBOMNode => ({
  id: record.id,
  partId: record.partId,
  partNumber: record.partNumber,
  name: record.name,
  revision: record.revision,
  state: record.state,
  type: record.type,
  quantity: record.quantity,
  unit: record.unit,
  cost: record.cost,
  currency: record.currency,
  customAttributes: parseCustomAttributes(record.customAttributesJson),
  children: [],
});

const buildTree = (records: BOMRecord[]): ApiBOMNode[] => {
  const nodesById = new Map<string, ApiBOMNode>();
  const roots: ApiBOMNode[] = [];

  for (const record of records) {
    nodesById.set(record.id, toApiNode(record));
  }

  for (const record of records) {
    const node = nodesById.get(record.id)!;
    if (record.parentId && nodesById.has(record.parentId)) {
      nodesById.get(record.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
};

const hasAnyField = (body: object, fields: readonly string[]) => {
  return fields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
};

const assertProjectAccess = async (db: DbClient, workspaceId: string, projectId: string) => {
  return db.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
    },
  });
};

const assertParentAccess = async (
  db: DbClient,
  workspaceId: string,
  projectId: string,
  parentId: string | null | undefined
) => {
  if (!parentId) return null;

  return db.bOMNode.findFirst({
    where: {
      id: parentId,
      workspaceId,
      projectId,
    },
  });
};

const findLinkedPart = async (db: DbClient, workspaceId: string, partId: string | null | undefined) => {
  if (!partId) return null;

  return db.part.findFirst({
    where: {
      id: partId,
      workspaceId,
      archivedAt: null,
    },
  });
};

const wouldCreateCycle = async (
  db: DbClient,
  workspaceId: string,
  projectId: string,
  nodeId: string,
  parentId: string | null | undefined
) => {
  let currentParentId = parentId ?? null;
  while (currentParentId) {
    if (currentParentId === nodeId) return true;
    const current = await db.bOMNode.findFirst({
      where: {
        id: currentParentId,
        workspaceId,
        projectId,
      },
      select: { parentId: true },
    });
    currentParentId = current?.parentId ?? null;
  }
  return false;
};

export const bomRoutes: FastifyPluginAsync<BOMRouteOptions> = async (app, options) => {
  app.get('/:projectId/bom', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');
    const { projectId } = request.params as { projectId: string };

    const project = await options.db.project.findFirst({
      where: {
        id: projectId,
        workspaceId: actor.workspaceId,
      },
    });

    if (!project) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Project not found.',
        statusCode: 404,
      });
    }

    const records = await options.db.bOMNode.findMany({
      where: {
        workspaceId: actor.workspaceId,
        projectId,
      },
      orderBy: { id: 'asc' },
    });

    return {
      projectId,
      roots: buildTree(records),
    };
  });

  app.post('/:projectId/bom', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { projectId } = request.params as { projectId: string };

    const project = await assertProjectAccess(options.db, actor.workspaceId, projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Project not found.',
        statusCode: 404,
      });
    }

    const result = createBOMNodeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid BOM node payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    if (hasAnyField(result.data, bomCostFields)) {
      assertPermission(actor, 'EDIT_COST');
    }

    const parent = await assertParentAccess(
      options.db,
      actor.workspaceId,
      projectId,
      result.data.parentId
    );
    if (result.data.parentId && !parent) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Parent BOM node not found.',
        statusCode: 404,
      });
    }

    const linkedPart = await findLinkedPart(options.db, actor.workspaceId, result.data.partId);
    if (result.data.partId && !linkedPart) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Linked part not found.',
        statusCode: 404,
      });
    }

    const partNumber = result.data.partNumber ?? linkedPart?.partNumber;
    const name = result.data.name ?? linkedPart?.name;
    if (!partNumber || !name) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'partNumber and name are required when partId is not provided.',
        statusCode: 400,
      });
    }

    const node = await options.db.bOMNode.create({
      data: {
        id: `bom-${randomUUID()}`,
        workspaceId: actor.workspaceId,
        projectId,
        parentId: result.data.parentId ?? null,
        partId: result.data.partId ?? null,
        partNumber,
        name,
        revision: result.data.revision,
        state: result.data.state,
        type: result.data.type,
        quantity: result.data.quantity,
        unit: result.data.unit,
        cost: result.data.cost ?? null,
        currency: result.data.currency ?? null,
        customAttributesJson: result.data.customAttributes
          ? JSON.stringify(result.data.customAttributes)
          : null,
      },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'BOMNode',
      entityId: node.id,
      action: 'create',
      after: node,
    });

    return reply.status(201).send({ node: toApiNode(node) });
  });

  app.patch('/:projectId/bom/:nodeId', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    const { projectId, nodeId } = request.params as { projectId: string; nodeId: string };

    const existing = await options.db.bOMNode.findFirst({
      where: {
        id: nodeId,
        projectId,
        workspaceId: actor.workspaceId,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'BOM node not found.',
        statusCode: 404,
      });
    }

    const result = updateBOMNodeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid BOM node payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    if (hasAnyField(result.data, bomStructureFields)) {
      assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    }
    if (hasAnyField(result.data, bomCostFields)) {
      assertPermission(actor, 'EDIT_COST');
    }

    const parent = await assertParentAccess(
      options.db,
      actor.workspaceId,
      projectId,
      result.data.parentId
    );
    if (result.data.parentId && !parent) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Parent BOM node not found.',
        statusCode: 404,
      });
    }
    if (await wouldCreateCycle(options.db, actor.workspaceId, projectId, nodeId, result.data.parentId)) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'BOM node cannot be moved under itself or its descendants.',
        statusCode: 409,
      });
    }

    const linkedPart = await findLinkedPart(options.db, actor.workspaceId, result.data.partId);
    if (result.data.partId && !linkedPart) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Linked part not found.',
        statusCode: 404,
      });
    }

    const updateData = {
      parentId: result.data.parentId,
      partId: result.data.partId,
      partNumber: result.data.partNumber ?? linkedPart?.partNumber,
      name: result.data.name ?? linkedPart?.name,
      revision: result.data.revision,
      state: result.data.state,
      type: result.data.type,
      quantity: result.data.quantity,
      unit: result.data.unit,
      cost: result.data.cost,
      currency: result.data.currency,
      customAttributesJson: Object.prototype.hasOwnProperty.call(result.data, 'customAttributes')
        ? result.data.customAttributes
          ? JSON.stringify(result.data.customAttributes)
          : null
        : undefined,
    };

    const node = await options.db.bOMNode.update({
      where: { id: existing.id },
      data: updateData,
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'BOMNode',
      entityId: node.id,
      action: 'update',
      before: existing,
      after: node,
    });

    return { node: toApiNode(node) };
  });

  app.delete('/:projectId/bom/:nodeId', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { projectId, nodeId } = request.params as { projectId: string; nodeId: string };

    const existing = await options.db.bOMNode.findFirst({
      where: {
        id: nodeId,
        projectId,
        workspaceId: actor.workspaceId,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'BOM node not found.',
        statusCode: 404,
      });
    }

    const childCount = await options.db.bOMNode.count({
      where: {
        parentId: nodeId,
        projectId,
        workspaceId: actor.workspaceId,
      },
    });
    if (childCount > 0) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'Cannot delete a BOM node that still has children.',
        statusCode: 409,
      });
    }

    await options.db.bOMNode.delete({
      where: { id: existing.id },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'BOMNode',
      entityId: existing.id,
      action: 'delete',
      before: existing,
    });

    return reply.status(204).send();
  });

  app.post('/:projectId/bom/import-preview', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');
    const { projectId } = request.params as { projectId: string };

    const project = await assertProjectAccess(options.db, actor.workspaceId, projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Project not found.',
        statusCode: 404,
      });
    }

    const parsedBody = importBOMSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid payload. csvText is required.',
        statusCode: 400,
      });
    }

    const rows = parseCSV(parsedBody.data.csvText);
    if (rows.length === 0) {
      return {
        rowCount: 0,
        errors: ['CSV must contain a header row and at least one data row.'],
        tree: null,
      };
    }

    const libraryParts = await options.db.part.findMany({
      where: {
        workspaceId: actor.workspaceId,
        archivedAt: null,
      }
    });
    const partsMap = new Map(libraryParts.map(p => [p.partNumber.toLowerCase(), p]));

    interface PreviewNode {
      level: number;
      partNumber: string;
      name: string;
      description: string;
      revision: string;
      state: string;
      type: string;
      quantity: number;
      cost: number;
      manufacturer: string;
      mpn: string;
      status: 'NEW' | 'EXISTING' | 'CONFLICT';
      libraryName?: string;
      libraryCost?: number;
      children: PreviewNode[];
    }

    const rootStack: PreviewNode[] = [];
    let rootNode: PreviewNode | null = null;
    const errors: string[] = [];

    rows.forEach((row, index) => {
      if (index > 0 && row.level > (rootStack[row.level - 1]?.level ?? 0) + 1) {
        errors.push(`Row ${index + 2}: Indentation level jumps from ${rootStack[row.level - 1]?.level ?? 0} to ${row.level}`);
      }

      const dbPart = partsMap.get(row.partNumber.toLowerCase());
      let status: 'NEW' | 'EXISTING' | 'CONFLICT' = 'NEW';
      let libraryName = '';
      let libraryCost = 0;

      if (dbPart) {
        if (dbPart.name.toLowerCase() !== row.name.toLowerCase()) {
          status = 'CONFLICT';
          libraryName = dbPart.name;
          libraryCost = dbPart.cost ?? 0;
        } else {
          status = 'EXISTING';
        }
      }

      const node: PreviewNode = {
        level: row.level,
        partNumber: row.partNumber,
        name: row.name,
        description: row.description,
        revision: row.revision,
        state: row.state,
        type: row.type,
        quantity: row.quantity,
        cost: row.cost,
        manufacturer: row.manufacturer,
        mpn: row.mpn,
        status,
        libraryName,
        libraryCost,
        children: []
      };

      if (row.level === 0 || !rootNode) {
        if (!rootNode) {
          rootNode = node;
          rootStack[0] = node;
        } else {
          errors.push(`Row ${index + 2}: Multiple root level nodes found.`);
        }
      } else {
        const parent = rootStack[row.level - 1];
        if (parent) {
          parent.children.push(node);
          rootStack[row.level] = node;
        } else {
          errors.push(`Row ${index + 2}: Missing parent container for level ${row.level}`);
        }
      }
    });

    return {
      rowCount: rows.length,
      errors,
      tree: rootNode,
    };
  });

  app.post('/:projectId/bom/import-commit', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { projectId } = request.params as { projectId: string };

    const project = await assertProjectAccess(options.db, actor.workspaceId, projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Project not found.',
        statusCode: 404,
      });
    }

    const parsedBody = importBOMSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid payload. csvText is required.',
        statusCode: 400,
      });
    }

    const rows = parseCSV(parsedBody.data.csvText);
    if (rows.length === 0) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'CSV is empty.',
        statusCode: 400,
      });
    }

    // Verify no structural errors before committing
    const rootStack: any[] = [];
    let rootNode: any = null;
    const errors: string[] = [];
    rows.forEach((row, index) => {
      if (index > 0 && row.level > (rootStack[row.level - 1]?.level ?? 0) + 1) {
        errors.push(`Row ${index + 2}: Indentation level jumps.`);
      }
      if (row.level === 0 || !rootNode) {
        if (!rootNode) {
          rootNode = row;
          rootStack[0] = row;
        } else {
          errors.push(`Row ${index + 2}: Multiple roots.`);
        }
      } else {
        const parent = rootStack[row.level - 1];
        if (parent) {
          rootStack[row.level] = row;
        } else {
          errors.push(`Row ${index + 2}: Missing parent.`);
        }
      }
    });

    if (errors.length > 0) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Cannot commit CSV with structural errors.',
        statusCode: 400,
        errors,
      });
    }

    await options.db.$transaction(async (tx) => {
      // 1. Purge existing BOM nodes for the project
      await tx.bOMNode.deleteMany({
        where: {
          projectId,
          workspaceId: actor.workspaceId,
        },
      });

      // 2. Fetch existing Parts
      const libraryParts = await tx.part.findMany({
        where: {
          workspaceId: actor.workspaceId,
          archivedAt: null,
        },
      });
      const partsMap = new Map(libraryParts.map(p => [p.partNumber.toLowerCase(), p]));

      // 3. Insert any NEW parts to Part Library
      for (const row of rows) {
        if (!partsMap.has(row.partNumber.toLowerCase())) {
          const newPartId = `part-${row.partNumber.toLowerCase()}-${randomUUID()}`;
          const newPart = await tx.part.create({
            data: {
              id: newPartId,
              workspaceId: actor.workspaceId,
              partNumber: row.partNumber,
              name: row.name,
              description: row.description,
              type: row.type,
              lifecycleState: row.state,
              cost: row.cost,
              currency: 'USD',
              manufacturer: row.manufacturer,
              mpn: row.mpn,
            },
          });
          partsMap.set(row.partNumber.toLowerCase(), newPart);
        }
      }

      // 4. Build node insertion array
      const idStack: string[] = [];
      const nodesToInsert: any[] = [];

      for (const row of rows) {
        const nodeId = `bom-${randomUUID()}`;
        const parentId = row.level > 0 ? idStack[row.level - 1] : null;
        idStack[row.level] = nodeId;

        const dbPart = partsMap.get(row.partNumber.toLowerCase())!;

        nodesToInsert.push({
          id: nodeId,
          workspaceId: actor.workspaceId,
          projectId,
          parentId,
          partId: dbPart.id,
          partNumber: row.partNumber,
          name: row.name,
          revision: row.revision,
          state: row.state,
          type: row.type,
          quantity: row.quantity,
          unit: 'EA',
          cost: row.cost,
          currency: 'USD',
          level: row.level,
        });
      }

      // Sort by level ascending to avoid foreign key parentId violations on self-referencing nodes
      nodesToInsert.sort((a, b) => a.level - b.level);

      for (const node of nodesToInsert) {
        const { level, ...prismaData } = node;
        await tx.bOMNode.create({
          data: prismaData,
        });
      }

      await recordAuditEvent(tx, actor, {
        entityType: 'bom',
        entityId: projectId,
        action: 'import-bom',
        after: { rowCount: rows.length },
      });
    });

    return reply.status(200).send({ success: true, rowCount: rows.length });
  });
};
