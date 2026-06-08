import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  SESSION_SECRET: z.string().min(16).default('dev-session-secret-change-me'),
  AI_CREDENTIAL_ENCRYPTION_KEY: z.string().min(16).default('dev-ai-credential-key-change-me'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
});

export type ServerConfig = z.infer<typeof configSchema>;

export const getServerConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  return configSchema.parse(env);
};

