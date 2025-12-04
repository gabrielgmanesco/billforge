import type { FastifyInstance } from 'fastify';
import {
    createBillingPortalSessionController,
    createCheckoutSessionController,
} from './billing.controller.js';
import { authGuard } from '../../core/middleware/auth.js';

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
}