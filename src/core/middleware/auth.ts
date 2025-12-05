import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SubscriptionStatus } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../../prisma/client.js';

export type AppRole = 'free' | 'pro' | 'premium';

export async function authGuard(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Missing or invalid Authorization header', 401, 'UNAUTHENTICATED');
  }

  const token = authHeader.substring('Bearer '.length);

  const payload = verifyAccessToken(token);

  request.user = {
    id: payload.sub,
    email: payload.email,
  };
}

export function roleGuard(requiredRole: AppRole) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
    }

    const userId = request.user.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] as SubscriptionStatus[],
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let userRole: AppRole = 'free';

    if (subscription?.plan.code === 'pro') {
      userRole = 'pro';
    }

    if (subscription?.plan.code === 'premium') {
      userRole = 'premium';
    }

    const hierarchy: AppRole[] = ['free', 'pro', 'premium'];

    const userIndex = hierarchy.indexOf(userRole);
    const requiredIndex = hierarchy.indexOf(requiredRole);

    if (userIndex < requiredIndex) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }
  };
}
