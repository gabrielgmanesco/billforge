import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../core/errors/app-error.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';

const subscriptionsService = new SubscriptionsService();

export async function meController(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  const user = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const { role, subscription } = await subscriptionsService.getUserRoleAndSubscription(user.id);

  return reply.status(200).send({
    user,
    role,
    subscription,
  });
}
