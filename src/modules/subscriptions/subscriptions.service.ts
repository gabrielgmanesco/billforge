import type { SubscriptionStatus } from '@prisma/client';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { AppError } from '../../core/errors/app-error.js';

export type AppRole = 'free' | 'pro' | 'premium';

const hierarchy: AppRole[] = ['free', 'pro', 'premium'];

const subscriptionsRepository = new SubscriptionsRepository();

export class SubscriptionsService {
  async getUserRoleAndSubscription(userId: string) {
    const subscription = await subscriptionsRepository.findCurrentSubscriptionForUser(userId);

    let role: AppRole = 'free';

    if (subscription?.plan.code === 'pro') {
      role = 'pro';
    }

    if (subscription?.plan.code === 'premium') {
      role = 'premium';
    }

    return {
      role,
      subscription,
    };
  }

  async getCurrentSubscriptionForUser(userId: string) {
    return this.getUserRoleAndSubscription(userId);
  }

  async createManualSubscription(userId: string, planCode: string) {
    if (planCode === 'free') {
      throw new AppError('Cannot create free subscription manually', 400, 'INVALID_PLAN_CODE');
    }

    const plan = await subscriptionsRepository.findPlanByCode(planCode);

    if (!plan || !plan.isActive) {
      throw new AppError('Plan not found or inactive', 404, 'PLAN_NOT_FOUND');
    }

    const { subscription } = await this.getUserRoleAndSubscription(userId);

    if (subscription) {
      throw new AppError('User already has an active subscription', 400, 'SUBSCRIPTION_EXISTS');
    }

    const { prisma } = await import('../../prisma/client.js');

    const newSubscription = await prisma.$transaction(async (tx) => {
      const activeSubscriptions = await tx.subscription.findMany({
        where: {
          userId,
          status: {
            in: ['TRIALING', 'ACTIVE', 'PAST_DUE'],
          },
        },
      });

      if (activeSubscriptions.length > 0) {
        await tx.subscription.updateMany({
          where: {
            id: { in: activeSubscriptions.map(s => s.id) },
          },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
          },
        });
      }

      const now = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);

      return await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: false,
        },
      });
    });

    return {
      subscription: newSubscription,
      plan,
    };
  }

  hasRequiredRole(userRole: AppRole, requiredRole: AppRole): boolean {
    const userIndex = hierarchy.indexOf(userRole);
    const requiredIndex = hierarchy.indexOf(requiredRole);
    return userIndex >= requiredIndex;
  }
}
