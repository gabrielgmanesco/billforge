import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SubscriptionsService } from './subscriptions.service.js';
import { AppError } from '../../core/errors/app-error.js';

const subscriptionsService = new SubscriptionsService();

export async function getCurrentSubscriptionController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  const { role, subscription } = await subscriptionsService.getCurrentSubscriptionForUser(
    request.user.id,
  );

  return reply.status(200).send({
    role,
    subscription,
  });
}

const manualSubscriptionSchema = z.object({
  planCode: z.enum(['pro', 'premium']),
});

export async function createManualSubscriptionController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  const body = manualSubscriptionSchema.parse(request.body);

  const { subscription, plan } = await subscriptionsService.createManualSubscription(
    request.user.id,
    body.planCode,
  );

  return reply.status(201).send({
    subscription,
    plan,
  });
}
