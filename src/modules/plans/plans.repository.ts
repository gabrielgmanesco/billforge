import type { SubscriptionPlan } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

export class PlansRepository {
    async listActivePlans(): Promise<SubscriptionPlan[]> {
        return prisma.subscriptionPlan.findMany({
            where : { isActive: true },
            orderBy: {
                priceCents: 'asc'
            },
        });
    }
}
