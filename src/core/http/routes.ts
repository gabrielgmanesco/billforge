import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from '../../modules/auth/auth.routes.js';
import { registerPlansRoutes } from '../../modules/plans/plans.routes.js';
import { registerSubscriptionsRoutes } from '../../modules/subscriptions/subscriptions.routes.js';
import { registerUsersRoutes } from '../../modules/users/users.routes.js';
import { registerBillingRoutes } from '../../modules/payments/billing.routes.js';
import { registerStripeWebhookRoutes } from '../../modules/webhooks/stripe-webhook.routes.js';
import { registerReportsRoutes } from '../../modules/reports/reports.routes.js';
import { prisma } from '../../prisma/client.js';
import { stripe } from '../../config/stripe.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return reply.status(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        stripe: stripe ? 'configured' : 'not configured',
      });
    } catch (error) {
      request.log.error(error, 'Health check failed');
      return reply.status(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    }
  });

  app.register(registerAuthRoutes, {
    prefix: '/auth',
  });

  app.register(registerPlansRoutes);

  app.register(registerSubscriptionsRoutes);

  app.register(registerUsersRoutes);

  app.register(registerBillingRoutes);

  app.register(registerReportsRoutes);

  app.register(registerStripeWebhookRoutes);
}
