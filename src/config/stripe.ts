import Stripe from 'stripe';
import { env } from '../core/env/env.js';

export const stripe =
  env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY.trim().length > 0
    ? new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-11-17.clover',
      })
    : null;
