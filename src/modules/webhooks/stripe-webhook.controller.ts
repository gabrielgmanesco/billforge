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

function mapSubscriptionStatus(status: Stripe.Subscription.Status) {
  return status.toUpperCase();
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
  const firstItem = stripeSub.items.data[0];
  const priceId = firstItem?.price?.id;

  const planCode = resolvePlanCodeFromPriceId(priceId);

  if (!planCode) {
    console.warn('[StripeWebhook] Could not resolve plan code from priceId', priceId);
    return;
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code: planCode },
  });

  if (!plan) {
    console.warn('[StripeWebhook] Plan not found for code', planCode);
    return;
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

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.subscription.create({
      data,
    });
  }
}

async function upsertInvoiceFromStripeInvoice(stripeInvoice: Stripe.Invoice): Promise<{ userId: string } | null> {
  const customerId = typeof stripeInvoice.customer === 'string'
    ? stripeInvoice.customer
    : stripeInvoice.customer?.id;

  if (!customerId) {
    console.warn('[StripeWebhook] Invoice without customer');
    return null;
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.warn('[StripeWebhook] User not found for customer', customerId);
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

  const existing = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
  });

  if (existing) {
    await prisma.invoice.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.invoice.create({
      data,
    });
  }

  return { userId: user.id };
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

        const stripeSub = await stripe!.subscriptions.retrieve(subscriptionId);

        await upsertSubscriptionFromStripeSubscription(stripeSub, userId);

        await createAuditLog({
          userId,
          action: 'stripe.checkout.session.completed',
          resource: 'subscription',
          metadata: {
            sessionId: session.id,
            subscriptionId: stripeSub.id,
            planCode: session.metadata?.planCode ?? null,
          },
        });

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
          console.warn('[StripeWebhook] User not found for subscription customer', customerId);
          break;
        }

        await upsertSubscriptionFromStripeSubscription(stripeSub, user.id);

        await createAuditLog({
          userId: user.id,
          action: `stripe.subscription.${event.type.split('.').pop()}`,
          resource: 'subscription',
          metadata: {
            stripeSubscriptionId: stripeSub.id,
            status: stripeSub.status,
          },
        });

        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.marked_uncollectible':
      case 'invoice.voided': {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        const result = await upsertInvoiceFromStripeInvoice(stripeInvoice);

        if (result) {
          await createAuditLog({
            userId: result.userId,
            action: `stripe.invoice.${event.type.split('.').pop()}`,
            resource: 'invoice',
            metadata: {
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
