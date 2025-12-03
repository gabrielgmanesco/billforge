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
    const plan = await subscriptionsRepository.findPlanByCode(planCode);

    if (!plan || !plan.isActive) {
      throw new AppError('Plan not found or inactive', 404, 'PLAN_NOT_FOUND');
    }

    const { subscription } = await this.getUserRoleAndSubscription(userId);

    if (subscription) {
      throw new AppError('User already has an active subscription', 400, 'SUBSCRIPTION_EXISTS');
    }

    const newSubscription = await subscriptionsRepository.createManualSubscription({
      userId,
      planId: plan.id,
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
