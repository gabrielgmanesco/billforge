import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { BillingService } from './billing.service.js';
import { AppError } from '../../core/errors/app-error.js';

const billingService = new BillingService();

const checkoutSchema = z.object({
  planCode: z.enum(['pro', 'premium']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const portalSchema = z.object({
  returnUrl: z.string().url(),
});

export async function createCheckoutSessionController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  const body = checkoutSchema.parse(request.body);

  const session = await billingService.createCheckoutSession({
    userId: request.user.id,
    planCode: body.planCode,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });

  return reply.status(201).send({
    checkoutSessionId: session.id,
    url: session.url,
  });
}

export async function createBillingPortalSessionController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  const body = portalSchema.parse(request.body);

  const session = await billingService.createBillingPortalSession({
    userId: request.user.id,
    returnUrl: body.returnUrl,
  });

  return reply.status(201).send({
    url: session.url,
  });
}
