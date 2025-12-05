import { prisma } from '../../prisma/client.js';
import { stripe } from '../../config/stripe.js';
import { env } from '../../core/env/env.js';
import { AppError } from '../../core/errors/app-error.js';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository.js';

const subscriptionsRepository = new SubscriptionsRepository();

type CheckoutParams = {
  userId: string;
  planCode: 'pro' | 'premium';
  successUrl: string;
  cancelUrl: string;
};

type PortalParams = {
  userId: string;
  returnUrl: string;
};

export class BillingService {
  private ensureStripeConfigured() {
    if (!stripe || !env.STRIPE_SECRET_KEY) {
      throw new AppError('Stripe is not configured', 500, 'STRIPE_NOT_CONFIGURED');
    }
  }

  private getPriceIdForPlan(planCode: 'pro' | 'premium'): string {
    if (planCode === 'pro' && env.STRIPE_PRICE_ID_PRO) {
      return env.STRIPE_PRICE_ID_PRO;
    }

    if (planCode === 'premium' && env.STRIPE_PRICE_ID_PREMIUM) {
      return env.STRIPE_PRICE_ID_PREMIUM;
    }

    throw new AppError(
      `Stripe price ID for plan "${planCode}" is not configured`,
      500,
      'STRIPE_PRICE_NOT_CONFIGURED',
    );
  }

  async createCheckoutSession(params: CheckoutParams) {
    this.ensureStripeConfigured();

    const { userId, planCode, successUrl, cancelUrl } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingSubscription) {
      throw new AppError(
        'User already has an active subscription',
        400,
        'SUBSCRIPTION_ALREADY_EXISTS'
      );
    }

    const plan = await subscriptionsRepository.findPlanByCode(planCode);

    if (!plan || !plan.isActive) {
      throw new AppError('Plan not found or inactive', 404, 'PLAN_NOT_FOUND');
    }

    const priceId = this.getPriceIdForPlan(planCode);

    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      try {
        const customer = await stripe!.customers.create({
          email: user.email,
          name: user.name,
        });

        stripeCustomerId = customer.id;

        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId },
        });
      } catch (error) {
        throw new AppError('Failed to create Stripe customer', 500, 'STRIPE_CUSTOMER_CREATION_FAILED');
      }
    }

    const session = await stripe!.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planCode: plan.code,
      },
    });

    if (!session.url) {
      throw new AppError('Failed to create checkout session URL', 500, 'CHECKOUT_SESSION_URL_MISSING');
    }

    return {
      id: session.id,
      url: session.url,
    };
  }

  async createBillingPortalSession(params: PortalParams) {
    this.ensureStripeConfigured();

    const { userId, returnUrl } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      try {
        const customer = await stripe!.customers.create({
          email: user.email,
          name: user.name,
        });

        stripeCustomerId = customer.id;

        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId },
        });
      } catch (error) {
        throw new AppError('Failed to create Stripe customer', 500, 'STRIPE_CUSTOMER_CREATION_FAILED');
      }
    }

    const portalSession = await stripe!.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    if (!portalSession.url) {
      throw new AppError('Failed to create billing portal session URL', 500, 'BILLING_PORTAL_URL_MISSING');
    }

    return {
      url: portalSession.url,
    };
  }
}
