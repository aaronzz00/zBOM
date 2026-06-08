import { FastifyPluginAsync } from 'fastify';
import { HealthResponse } from '../../shared/apiTypes';

interface HealthRouteOptions {
  environment: string;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (app, options) => {
  app.get('/health', async (): Promise<HealthResponse> => ({
    ok: true,
    service: 'zbom-api',
    environment: options.environment,
  }));
};

