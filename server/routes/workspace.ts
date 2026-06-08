import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiWorkspaceSettings } from '../../shared/apiTypes';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { recordAuditEvent } from '../services/audit';

interface WorkspaceRouteOptions {
  db: DbClient;
}

const defaultSettings: ApiWorkspaceSettings = {
  flows: [
    {
      id: 'flow-standard',
      name: 'Standard Hardware Flow',
      stages: ['EVT', 'DVT', 'PVT', 'MP'],
      transitions: {
        EVT: { targetStages: ['DVT'], checklist: ['BOM Cost Review Completed', 'DFM Review Completed', 'Initial EVT Yield Report Attached'] },
        DVT: { targetStages: ['PVT'], checklist: ['Functional Testing Completed', 'Compliance Certificates Obtained', 'Tooling T1 Trials Completed'] },
        PVT: { targetStages: ['MP'], checklist: ['PVT Qualification Complete', 'Operator Training Complete', 'Final Golden Sample Approved'] },
        MP: { targetStages: [], checklist: [] }
      }
    },
    {
      id: 'flow-fast',
      name: 'Fast-Track IoT Flow',
      stages: ['EVT', 'PVT', 'MP'],
      transitions: {
        EVT: { targetStages: ['PVT'], checklist: ['BOM Cost Review Completed', 'Functional Testing Completed', 'DFM Review Completed'] },
        PVT: { targetStages: ['MP'], checklist: ['Operator Training Complete', 'Final Golden Sample Approved'] },
        MP: { targetStages: [], checklist: [] }
      }
    }
  ],
  flowAssociations: {
    'project-zphone-2026': 'flow-standard',
    'project-zphone-lite-2026': 'flow-fast'
  },
  componentTypes: ['Assembly', 'Part', 'Material', 'Software'],
  lifecycleStates: ['Draft', 'In Review', 'Released', 'Obsolete', 'Prototype'],
  warehouseLocations: ['WH-A', 'WH-B', 'WH-C'],
  complianceStandards: ['RoHS', 'REACH', 'UN38.3'],
  attributeDefs: [
    { id: 'attr-1', name: 'Material', key: 'material', type: 'text' },
    { id: 'attr-2', name: 'Finish', key: 'finish', type: 'text' },
    { id: 'attr-3', name: 'Torque Spec', key: 'torque', type: 'text' },
    { id: 'attr-4', name: 'Compliance', key: 'compliance', type: 'select', options: ['RoHS', 'REACH', 'UN38.3'] }
  ],
  componentTypeLabels: {
    Assembly: 'Assembly',
    Part: 'Part',
    Material: 'Material',
    Software: 'Software'
  },
  lifecycleStateLabels: {
    Draft: 'Draft',
    'In Review': 'In Review',
    Released: 'Released',
    Obsolete: 'Obsolete',
    Prototype: 'Prototype'
  }
};

const settingsSchema = z.object({
  flows: z.array(z.any()),
  flowAssociations: z.record(z.string(), z.string()),
  componentTypes: z.array(z.string()),
  lifecycleStates: z.array(z.string()),
  warehouseLocations: z.array(z.string()),
  complianceStandards: z.array(z.string()),
  attributeDefs: z.array(z.any()),
  componentTypeLabels: z.record(z.string(), z.string()),
  lifecycleStateLabels: z.record(z.string(), z.string()),
}).strict();

export const workspaceRoutes: FastifyPluginAsync<WorkspaceRouteOptions> = async (app, options) => {
  app.get('/settings', async (request) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');

    const workspace = await options.db.workspace.findUnique({
      where: { id: actor.workspaceId },
      select: { settingsJson: true },
    });

    let settings = defaultSettings;
    if (workspace?.settingsJson) {
      try {
        settings = JSON.parse(workspace.settingsJson);
      } catch (e) {
        console.error('Failed to parse settingsJson, falling back to defaults', e);
      }
    }

    return { settings };
  });

  app.put('/settings', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');

    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid settings body format.',
        details: parsed.error.format(),
        statusCode: 400,
      });
    }

    const settingsJson = JSON.stringify(parsed.data);

    const beforeWorkspace = await options.db.workspace.findUnique({
      where: { id: actor.workspaceId },
      select: { settingsJson: true },
    });

    await options.db.workspace.update({
      where: { id: actor.workspaceId },
      data: { settingsJson },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'Workspace',
      entityId: actor.workspaceId,
      action: 'UPDATE_SETTINGS',
      before: beforeWorkspace?.settingsJson,
      after: settingsJson,
    });

    return { settings: parsed.data };
  });
};
