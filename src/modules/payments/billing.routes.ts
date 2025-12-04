import type { FastifyInstance } from 'fastify';
import {
  createBillingPortalSessionController,
  createCheckoutSessionController,
} from './billing.controller.js';
import { authGuard } from '../../core/middleware/auth.js';
import { listUserInvoicesController } from './invoices.controller.js';

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/billing/checkout',
    {
      preHandler: [authGuard],
    },
    createCheckoutSessionController,
  );

  app.post(
    '/billing/portal',
    {
      preHandler: [authGuard],
    },
    createBillingPortalSessionController,
  );

  app.get(
    '/billing/invoices',
    {
      preHandler: [authGuard],
    },
    listUserInvoicesController,
  );
}