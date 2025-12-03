import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from '../../modules/auth/auth.routes.js';
import { registerPlansRoutes } from '../../modules/plans/plans.routes.js';
import { registerSubscriptionsRoutes } from '../../modules/subscriptions/subscriptions.routes.js';
import { registerUsersRoutes } from '../../modules/users/users.routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(registerAuthRoutes, {
    prefix: '/auth',
  });

  app.register(registerPlansRoutes);

  app.register(registerSubscriptionsRoutes);

  app.register(registerUsersRoutes);
}

