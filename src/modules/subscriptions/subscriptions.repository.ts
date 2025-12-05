import type { Subscription, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

export class SubscriptionsRepository {
  async findCurrentSubscriptionForUser(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] as SubscriptionStatus[],
        },
        cancelAtPeriodEnd: false,
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findPlanByCode(code: string): Promise<SubscriptionPlan | null> {
    return prisma.subscriptionPlan.findUnique({
      where: { code },
    });
  }

  async createManualSubscription(params: {
    userId: string;
    planId: string;
  }): Promise<Subscription> {
    const { userId, planId } = params;

    const now = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    return prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
      },
    });
  }
}
