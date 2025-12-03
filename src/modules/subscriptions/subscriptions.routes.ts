import type { FastifyInstance } from 'fastify';
import {
  createManualSubscriptionController,
  getCurrentSubscriptionController,
} from './subscriptions.controller.js';
import { authGuard } from '../../core/middleware/auth.js';

export async function registerSubscriptionsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/subscriptions/current',
    {
      preHandler: [authGuard],
    },
    getCurrentSubscriptionController,
  );

  app.post(
    '/subscriptions/manual',
    {
      preHandler: [authGuard],
    },
    createManualSubscriptionController,
  );
}
