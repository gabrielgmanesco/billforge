import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from '../../modules/auth/auth.routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(registerAuthRoutes, {
    prefix: '/auth',
  });
}

