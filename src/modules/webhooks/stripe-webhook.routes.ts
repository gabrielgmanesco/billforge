import type { FastifyInstance } from 'fastify';
import { stripeWebhookController } from './stripe-webhook.controller.js';

export async function registerStripeWebhookRoutes(app: FastifyInstance): Promise<void> {
    app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
        done(null, body);
    });

    app.post('/webhooks/stripe', async (request, reply) => {
        if (!request.rawBody && request.body) {
            (request as any).rawBody = request.body;
        }

        return stripeWebhookController(request, reply);
    });
}
