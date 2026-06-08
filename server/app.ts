import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { ZodError } from 'zod';
import { getServerConfig, ServerConfig } from './config';
import { aiRoutes } from './routes/ai';
import { authRoutes } from './routes/auth';
import { bomRoutes } from './routes/bom';
import { healthRoutes } from './routes/health';
import { partRoutes } from './routes/parts';
import { projectRoutes } from './routes/projects';
import { toolingRoutes } from './routes/tooling';
import { workspaceRoutes } from './routes/workspace';
import { ecoRoutes } from './routes/ecos';
import { auditRoutes } from './routes/audit';
import { attachmentsRoutes } from './routes/attachments';
import { createPrismaClient, DbClient } from './db/client';


interface AppDependencies {
  db?: DbClient;
}

export const buildApp = async (
  config: ServerConfig = getServerConfig(),
  dependencies: AppDependencies = {}
): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });
  const db = dependencies.db ?? createPrismaClient(config.DATABASE_URL);

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  await app.register(multipart);

  await app.register(fastifyStatic, {
    root: path.resolve('uploads'),
    prefix: '/uploads/',
  });

  await app.register(healthRoutes, {
    prefix: '/api',
    environment: config.NODE_ENV,
  });

  await app.register(authRoutes, {
    prefix: '/api/auth',
    db,
  });

  await app.register(aiRoutes, {
    prefix: '/api/ai',
    db,
    encryptionKey: config.AI_CREDENTIAL_ENCRYPTION_KEY,
  });

  await app.register(projectRoutes, {
    prefix: '/api/projects',
    db,
  });

  await app.register(bomRoutes, {
    prefix: '/api/projects',
    db,
  });

  await app.register(partRoutes, {
    prefix: '/api/parts',
    db,
  });

  await app.register(toolingRoutes, {
    prefix: '/api/tooling',
    db,
  });

  await app.register(workspaceRoutes, {
    prefix: '/api/workspace',
    db,
  });

  await app.register(ecoRoutes, {
    prefix: '/api/ecos',
    db,
  });

  await app.register(auditRoutes, {
    prefix: '/api/audit',
    db,
  });

  await app.register(attachmentsRoutes, {
    prefix: '/api/attachments',
    db,
  });


  app.addHook('onClose', async () => {
    if (!dependencies.db) {
      await db.$disconnect();
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    if (process.env.NODE_ENV === 'test') {
      console.error('SERVER ERROR STACK:', error);
    }
    const isValidationError = error instanceof ZodError ||
      error.name === 'ZodError' ||
      Array.isArray((error as { issues?: unknown }).issues);
    const statusCode = isValidationError
      ? 400
      : error.statusCode && error.statusCode >= 400
        ? error.statusCode
        : 500;

    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Internal Server Error' : error.name,
      message: statusCode === 500 ? error.message : error.message, // show real error message in tests
      statusCode,
    });
  });

  return app;
};
