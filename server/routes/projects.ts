import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiProject } from '../../shared/apiTypes';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { recordAuditEvent } from '../services/audit';

interface ProjectRouteOptions {
  db: DbClient;
}

const createProjectSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(240),
  sku: z.string().trim().min(1).max(120),
});

const updateProjectSchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(240).optional(),
  sku: z.string().trim().min(1).max(120).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one project field is required to update.',
});

const signatureSchema = z.object({
  item: z.string().trim().min(1),
  actor: z.string().trim().min(1),
  role: z.string().trim().min(1),
  timestamp: z.string().trim().datetime(),
});

const transitionProjectSchema = z.object({
  newPhase: z.enum(['EVT', 'DVT', 'PVT', 'MP']),
  signatures: z.array(signatureSchema).default([]),
});

const defaultFlows = [
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
];

const toApiProject = (project: {
  id: string;
  code: string;
  name: string;
  sku: string;
  phase: string;
}): ApiProject => ({
  id: project.id,
  code: project.code,
  name: project.name,
  sku: project.sku,
  phase: project.phase,
});

export const projectRoutes: FastifyPluginAsync<ProjectRouteOptions> = async (app, options) => {
  app.get('/', async (request) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');

    const projects = await options.db.project.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: { code: 'asc' },
    });

    return {
      projects: projects.map(toApiProject),
    };
  });

  app.get('/:projectId', async (request, reply) => {
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

    return { project: toApiProject(project) };
  });

  app.post('/', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');

    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid project data.',
        details: parsed.error.format(),
        statusCode: 400,
      });
    }

    const projects = await options.db.project.findMany({
      where: { workspaceId: actor.workspaceId },
    });
    const duplicate = projects.some((p) => p.code.toLowerCase() === parsed.data.code.toLowerCase());
    if (duplicate) {
      return reply.status(409).send({
        error: 'ConflictError',
        message: `Project code ${parsed.data.code} already exists.`,
        statusCode: 409,
      });
    }

    const projectId = `project-${parsed.data.code.toLowerCase()}-${Date.now()}`;
    const project = await options.db.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          id: projectId,
          workspaceId: actor.workspaceId,
          code: parsed.data.code,
          name: parsed.data.name,
          sku: parsed.data.sku,
          phase: 'EVT',
        },
      });

      const rootNodeId = `root-${parsed.data.code.toLowerCase()}`;
      await tx.bOMNode.create({
        data: {
          id: rootNodeId,
          workspaceId: actor.workspaceId,
          projectId: projectId,
          parentId: null,
          partId: null,
          partNumber: `800-${parsed.data.code.toUpperCase()}-001`,
          name: `Top Level Assembly, ${parsed.data.name}`,
          revision: 'A',
          state: 'Draft',
          type: 'Assembly',
          quantity: 1,
          unit: 'PCS',
          cost: 0,
          currency: 'USD',
        },
      });

      return p;
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'project',
      entityId: project.id,
      action: 'create',
      after: project,
    });

    return { project: toApiProject(project) };
  });

  app.patch('/:projectId', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { projectId } = request.params as { projectId: string };

    const parsed = updateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid project update data.',
        details: parsed.error.format(),
        statusCode: 400,
      });
    }

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

    if (parsed.data.code && parsed.data.code.toLowerCase() !== project.code.toLowerCase()) {
      const projects = await options.db.project.findMany({
        where: { workspaceId: actor.workspaceId },
      });
      const duplicate = projects.some((p) => p.id !== projectId && p.code.toLowerCase() === parsed.data.code!.toLowerCase());
      if (duplicate) {
        return reply.status(409).send({
          error: 'ConflictError',
          message: `Project code ${parsed.data.code} already exists.`,
          statusCode: 409,
        });
      }
    }

    const before = {
      code: project.code,
      name: project.name,
      sku: project.sku,
    };

    const updatedProject = await options.db.project.update({
      where: { id: projectId },
      data: parsed.data,
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'project',
      entityId: projectId,
      action: 'update',
      before,
      after: parsed.data,
    });

    return { project: toApiProject(updatedProject) };
  });

  app.post('/:projectId/transition', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'TRANSITION_PROJECT_PHASE');
    const { projectId } = request.params as { projectId: string };

    const parsed = transitionProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid transition data.',
        details: parsed.error.format(),
        statusCode: 400,
      });
    }

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

    const workspace = await options.db.workspace.findUnique({
      where: { id: actor.workspaceId },
    });

    if (!workspace) {
      return reply.status(500).send({
        error: 'InternalError',
        message: 'Workspace not found.',
        statusCode: 500,
      });
    }

    const settings = workspace.settingsJson ? JSON.parse(workspace.settingsJson) : null;
    const flows = settings?.flows || defaultFlows;
    const flowAssociations = settings?.flowAssociations || {};
    const flowId = flowAssociations[projectId] || 'flow-standard';
    const flow = flows.find((f: any) => f.id === flowId) || flows[0];

    const currentPhase = project.phase;
    const transitionConfig = flow.transitions?.[currentPhase];
    if (!transitionConfig) {
      return reply.status(400).send({
        error: 'TransitionError',
        message: `No transition configuration found for current phase ${currentPhase}.`,
        statusCode: 400,
      });
    }

    const { newPhase, signatures } = parsed.data;

    if (!transitionConfig.targetStages.includes(newPhase)) {
      return reply.status(400).send({
        error: 'TransitionError',
        message: `Phase transition from ${currentPhase} to ${newPhase} is not allowed in flow ${flow.name}.`,
        statusCode: 400,
      });
    }

    const checklist = transitionConfig.checklist || [];
    const providedItems = new Set(signatures.map((s: any) => s.item));
    const missingItems = checklist.filter((item: string) => !providedItems.has(item));
    if (missingItems.length > 0) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: `Cannot transition phase. Missing required checklist items: ${missingItems.join(', ')}`,
        statusCode: 400,
      });
    }

    const updatedProject = await options.db.project.update({
      where: { id: projectId },
      data: { phase: newPhase },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'project',
      entityId: projectId,
      action: 'transition-phase',
      before: { phase: currentPhase },
      after: { phase: newPhase, signatures },
    });

    return { project: toApiProject(updatedProject) };
  });
};
