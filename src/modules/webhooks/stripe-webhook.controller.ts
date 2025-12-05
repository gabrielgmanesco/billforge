import type { FastifyReply, FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { stripe } from '../../config/stripe.js';
import { env } from '../../core/env/env.js';
import { prisma } from '../../prisma/client.js';
import { createAuditLog } from '../../core/utils/audit-log.js';

function ensureStripeWebhookConfigured() {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook is not configured');
  }
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  const mapped = status.toUpperCase();
  const validStatuses = ['INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'];
  if (!validStatuses.includes(mapped)) {
    return 'CANCELED';
  }
  return mapped;
}

function mapInvoiceStatus(status: Stripe.Invoice.Status | null) {
  if (!status) return 'DRAFT';
  return status.toUpperCase();
}

function resolvePlanCodeFromPriceId(priceId: string | null | undefined): 'pro' | 'premium' | null {
  if (!priceId) return null;

  if (env.STRIPE_PRICE_ID_PRO && priceId === env.STRIPE_PRICE_ID_PRO) {
    return 'pro';
  }

  if (env.STRIPE_PRICE_ID_PREMIUM && priceId === env.STRIPE_PRICE_ID_PREMIUM) {
    return 'premium';
  }

  return null;
}

async function upsertSubscriptionFromStripeSubscription(
  stripeSub: Stripe.Subscription,
  userId: string,
) {
  if (!stripeSub.items?.data || stripeSub.items.data.length === 0) {
    return null;
  }

  const firstItem = stripeSub.items.data[0];
  const priceId = firstItem?.price?.id;

  if (!priceId) {
    return null;
  }

  const planCode = resolvePlanCodeFromPriceId(priceId);

  if (!planCode) {
    return null;
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code: planCode },
  });

  if (!plan) {
    return null;
  }

  const sub = stripeSub as any;

  const data = {
    userId,
    planId: plan.id,
    stripeSubscriptionId: stripeSub.id,
    status: mapSubscriptionStatus(stripeSub.status) as any,
    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : new Date(),
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date(),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  };

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });

    const isBecomingActive = ['TRIALING', 'ACTIVE', 'PAST_DUE'].includes(data.status);

    if (existing) {
      const updated = await tx.subscription.update({
        where: { id: existing.id },
        data,
      });

      if (isBecomingActive) {
        const activeSubscriptions = await tx.subscription.findMany({
          where: {
            userId,
            status: {
              in: ['TRIALING', 'ACTIVE', 'PAST_DUE'],
            },
            id: { not: existing.id },
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
      }

      return updated;
    } else {
      const activeSubscriptions = await tx.subscription.findMany({
        where: {
          userId,
          status: {
            in: ['TRIALING', 'ACTIVE', 'PAST_DUE'],
          },
          stripeSubscriptionId: { not: stripeSub.id },
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

      return await tx.subscription.create({
        data,
      });
    }
  });
}

async function upsertInvoiceFromStripeInvoice(stripeInvoice: Stripe.Invoice): Promise<{ userId: string } | null> {
  const customerId = typeof stripeInvoice.customer === 'string'
    ? stripeInvoice.customer
    : stripeInvoice.customer?.id;

  if (!customerId) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    return null;
  }

  let subscriptionRecord = null;
  const inv = stripeInvoice as any;

  if (inv.subscription) {
    const subscriptionId =
      typeof inv.subscription === 'string'
        ? inv.subscription
        : inv.subscription?.id;

    subscriptionRecord = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
  }

  const data = {
    userId: user.id,
    subscriptionId: subscriptionRecord ? subscriptionRecord.id : null,
    stripeInvoiceId: stripeInvoice.id,
    stripePaymentIntentId:
      typeof inv.payment_intent === 'string'
        ? inv.payment_intent
        : inv.payment_intent?.id ?? null,
    status: mapInvoiceStatus(stripeInvoice.status) as any,
    amountDueCents: stripeInvoice.amount_due,
    amountPaidCents: stripeInvoice.amount_paid,
    currency: stripeInvoice.currency.toUpperCase(),
    hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? null,
    invoicePdf: stripeInvoice.invoice_pdf ?? null,
    invoiceCreatedAt: new Date(stripeInvoice.created * 1000),
  };

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({
      where: { stripeInvoiceId: stripeInvoice.id },
    });

    if (existing) {
      await tx.invoice.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await tx.invoice.create({
        data,
      });
    }

    return { userId: user.id };
  });
}

export async function stripeWebhookController(request: FastifyRequest, reply: FastifyReply) {
  try {
    ensureStripeWebhookConfigured();
  } catch (error) {
    request.log.error(error);
    return reply.status(204).send();
  }

  const sig = request.headers['stripe-signature'];

  if (!sig || Array.isArray(sig)) {
    request.log.error('Missing Stripe signature header');
    return reply.status(400).send({ message: 'Missing Stripe signature header' });
  }

  const rawBody = request.rawBody;

  if (!rawBody) {
    request.log.error('Missing raw body for Stripe webhook');
    return reply.status(400).send({ message: 'Missing raw body' });
  }

  let event: Stripe.Event;

  try {
    event = stripe!.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    request.log.error({ err }, 'Error verifying Stripe webhook signature');
    return reply.status(400).send({ message: 'Invalid signature' });
  }

  const existingEvent = await prisma.auditLog.findFirst({
    where: {
      metadata: { path: ['stripeEventId'], equals: event.id },
    },
  });

  if (existingEvent) {
    request.log.debug({ eventId: event.id }, 'Webhook event already processed');
    return reply.status(200).send({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId =
          (session.client_reference_id as string | null) ??
          ((session.metadata?.userId as string | undefined) ?? null);

        if (!userId || !session.subscription) {
          break;
        }

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

        let stripeSub: Stripe.Subscription;
        try {
          stripeSub = await stripe!.subscriptions.retrieve(subscriptionId);
        } catch (error) {
          request.log.error({ error, subscriptionId }, 'Failed to retrieve Stripe subscription');
          break;
        }

        const subscription = await upsertSubscriptionFromStripeSubscription(stripeSub, userId);

        if (subscription) {
          await createAuditLog({
            userId,
            action: 'stripe.checkout.session.completed',
            resource: 'subscription',
            metadata: {
              stripeEventId: event.id,
              sessionId: session.id,
              subscriptionId: stripeSub.id,
              planCode: session.metadata?.planCode ?? null,
            },
          });
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;

        const customerId =
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : stripeSub.customer?.id;

        if (!customerId) break;

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (!user) {
          request.log.warn({ customerId }, 'User not found for subscription customer');
          break;
        }

        const subscription = await upsertSubscriptionFromStripeSubscription(stripeSub, user.id);

        if (subscription) {
        const actionType = event.type.split('.').pop() || event.type;
        await createAuditLog({
          userId: user.id,
          action: `stripe.subscription.${actionType}`,
          resource: 'subscription',
          metadata: {
            stripeEventId: event.id,
            stripeSubscriptionId: stripeSub.id,
            status: stripeSub.status,
          },
        });
        }

        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.marked_uncollectible':
      case 'invoice.voided': {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const result = await upsertInvoiceFromStripeInvoice(stripeInvoice);

        if (result) {
          const actionType = event.type.split('.').pop() || event.type;
          await createAuditLog({
            userId: result.userId,
            action: `stripe.invoice.${actionType}`,
            resource: 'invoice',
            metadata: {
              stripeEventId: event.id,
              stripeInvoiceId: stripeInvoice.id,
              status: stripeInvoice.status,
            },
          });
        }

        break;
      }

      default:
        request.log.debug({ type: event.type }, 'Unhandled Stripe event type');
    }
  } catch (error) {
    request.log.error({ error, type: event.type }, 'Error handling Stripe webhook');
    return reply.status(500).send({ received: true });
  }

  return reply.status(200).send({ received: true });
}
