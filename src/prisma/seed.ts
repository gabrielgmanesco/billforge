import { BillingInterval } from '@prisma/client';
import { prisma } from './client.js';

async function main() {
  // stripeProductId e stripePriceId serão preenchidos após criar os produtos no Stripe
  const plans = [
    {
      code: 'free',
      name: 'Free',
      description: 'Free tier with limited features',
      priceCents: 0,
      currency: 'USD',
      interval: BillingInterval.MONTH,
      isActive: true,
    },
    {
      code: 'pro',
      name: 'Pro',
      description: 'Pro plan for growing teams',
      priceCents: 999, // $9.99
      currency: 'USD',
      interval: BillingInterval.MONTH,
      isActive: true,
    },
    {
      code: 'premium',
      name: 'Premium',
      description: 'Premium plan with all features',
      priceCents: 1999, // $19.99
      currency: 'USD',
      interval: BillingInterval.MONTH,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  console.log('Database seeded with subscription plans.');
}

main()
  .catch((error) => {
    console.error('Error during seed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
