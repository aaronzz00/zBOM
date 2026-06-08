import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { decryptCredential, encryptCredential, lastFour } from '../services/aiCredentials';
import { randomUUID } from 'node:crypto';

interface AIRouteOptions {
  db: DbClient;
  encryptionKey: string;
}

const providerSchema = z.object({
  enabled: z.boolean(),
  providerType: z.literal('openai-compatible').default('openai-compatible'),
  baseUrl: z.string().trim().url(),
  model: z.string().trim().min(1).max(120),
  temperature: z.number().min(0).max(2),
  apiKey: z.string().trim().min(1).optional(),
  clearApiKey: z.boolean().optional(),
}).strict();

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(20000),
});

const chatSchema = z.object({
  purpose: z.string().trim().min(1).max(80).default('bom-assistant'),
  messages: z.array(chatMessageSchema).min(1).max(40),
  temperature: z.number().min(0).max(2).optional(),
}).strict();

const toProviderResponse = (config: {
  providerType: string;
  baseUrl: string;
  model: string;
  temperature: number;
  enabled: boolean;
  keyLast4: string | null;
}) => ({
  providerType: config.providerType,
  baseUrl: config.baseUrl,
  model: config.model,
  temperature: config.temperature,
  enabled: config.enabled,
  keyLast4: config.keyLast4,
});

const previewPrompt = (messages: Array<{ content: string }>) => {
  return messages
    .map((message) => message.content)
    .join('\n')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
};

export const aiRoutes: FastifyPluginAsync<AIRouteOptions> = async (app, options) => {
  app.get('/provider', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'MANAGE_AI_PROVIDER');

    const config = await options.db.aiProviderConfig.findUnique({
      where: { workspaceId: actor.workspaceId },
    });

    if (!config) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'AI provider config not found.',
        statusCode: 404,
      });
    }

    return { provider: toProviderResponse(config) };
  });

  app.put('/provider', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'MANAGE_AI_PROVIDER');

    const result = providerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid AI provider payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    const encryptedApiKey = result.data.clearApiKey
      ? null
      : result.data.apiKey
        ? encryptCredential(result.data.apiKey, options.encryptionKey)
        : undefined;
    const keyLast4 = result.data.clearApiKey
      ? null
      : result.data.apiKey
        ? lastFour(result.data.apiKey)
        : undefined;

    const provider = await options.db.aiProviderConfig.upsert({
      where: { workspaceId: actor.workspaceId },
      create: {
        id: `ai-provider-${randomUUID()}`,
        workspaceId: actor.workspaceId,
        providerType: 'openai-compatible',
        baseUrl: result.data.baseUrl.replace(/\/+$/, ''),
        model: result.data.model,
        temperature: result.data.temperature,
        enabled: result.data.enabled,
        encryptedApiKey: encryptedApiKey ?? null,
        keyLast4: keyLast4 ?? null,
      },
      update: {
        providerType: 'openai-compatible',
        baseUrl: result.data.baseUrl.replace(/\/+$/, ''),
        model: result.data.model,
        temperature: result.data.temperature,
        enabled: result.data.enabled,
        ...(encryptedApiKey !== undefined ? { encryptedApiKey } : {}),
        ...(keyLast4 !== undefined ? { keyLast4 } : {}),
      },
    });

    return { provider: toProviderResponse(provider) };
  });

  app.post('/chat', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');

    const result = chatSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid AI chat payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    const config = await options.db.aiProviderConfig.findUnique({
      where: { workspaceId: actor.workspaceId },
    });

    if (!config?.enabled || !config.encryptedApiKey) {
      await options.db.aiRequestLog.create({
        data: {
          id: `ai-log-${randomUUID()}`,
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          providerConfigId: config?.id,
          purpose: result.data.purpose,
          status: 'NOT_CONFIGURED',
          redactedPromptPreview: previewPrompt(result.data.messages),
        },
      });

      return reply.status(400).send({
        error: 'AIProviderNotConfigured',
        message: 'AI provider is disabled or missing an API key.',
        statusCode: 400,
      });
    }

    let status = 'FAILED';
    try {
      const apiKey = decryptCredential(config.encryptedApiKey, options.encryptionKey);
      const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: result.data.messages,
          temperature: result.data.temperature ?? config.temperature,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      status = response.ok ? 'SUCCESS' : 'PROVIDER_ERROR';

      await options.db.aiRequestLog.create({
        data: {
          id: `ai-log-${randomUUID()}`,
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          providerConfigId: config.id,
          purpose: result.data.purpose,
          status,
          redactedPromptPreview: previewPrompt(result.data.messages),
        },
      });

      if (!response.ok) {
        return reply.status(502).send({
          error: 'AIProviderError',
          message: payload?.error?.message || `Provider returned HTTP ${response.status}.`,
          statusCode: 502,
        });
      }

      return payload;
    } catch (error) {
      await options.db.aiRequestLog.create({
        data: {
          id: `ai-log-${randomUUID()}`,
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          providerConfigId: config.id,
          purpose: result.data.purpose,
          status,
          redactedPromptPreview: previewPrompt(result.data.messages),
        },
      });

      request.log.error(error);
      return reply.status(502).send({
        error: 'AIProviderError',
        message: 'Failed to reach AI provider.',
        statusCode: 502,
      });
    }
  });
};
