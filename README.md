# BillForge

Backend platform for subscription and billing management, focused on Stripe integrations.

## Stack

- Node.js (ESM)
- TypeScript
- Fastify
- Prisma + PostgreSQL
- Stripe (Checkout + Billing Portal + Webhooks)
- JWT + Refresh Token in httpOnly cookie
- ESLint + Prettier
- Docker (PostgreSQL)

## Requirements

- Node.js 20+
- Docker + Docker Compose
- Stripe account (test mode)

## Development Setup

### 1. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `COOKIE_SECRET` (min 32 characters each)

**Stripe:**
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLIC_KEY`
- `STRIPE_WEBHOOK_SECRET` (optional, for webhooks)
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_PREMIUM`

### 2. Start the database:

```bash
docker compose up -d
```

### 3. Run migrations and seed:

```bash
npm run prisma:migrate -- --name init
npm run prisma:generate
npm run prisma:seed
```

### 4. Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3333`.

### 5. (Optional) Test Stripe Webhooks locally:

Install Stripe CLI and run:

```bash
stripe listen --forward-to localhost:3333/webhooks/stripe
```

Copy the webhook signing secret (`whsec_...`) and add it to your `.env` as `STRIPE_WEBHOOK_SECRET`.

## Available Scripts

- `npm run dev` → development mode
- `npm run build` → compile TypeScript to dist
- `npm run start` → run compiled version
- `npm run prisma:migrate` → run migrations
- `npm run prisma:generate` → generate Prisma client
- `npm run prisma:seed` → seed subscription plans
- `npm run prisma:studio` → open Prisma Studio (database UI)
- `npm run lint` / `npm run lint:fix` → ESLint
- `npm run format` → Prettier

## API Routes

### Health

- `GET /health` → `{ "status": "ok" }`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `DELETE /auth/logout`

**Tokens:**
- Access token (JWT) in response body (`accessToken`)
- Refresh token via httpOnly cookie (`billforge_refresh_token`)

### Plans

- `GET /plans` → lists free, pro, premium plans

### Subscriptions

- `GET /subscriptions/current` (auth)
- `POST /subscriptions/manual` (auth, dev only)

### Billing (Stripe)

- `POST /billing/checkout` (auth)
- `POST /billing/portal` (auth)
- `GET /billing/invoices` (auth)

### User

- `GET /me` (auth)

### Reports (Premium)

- `GET /reports/summary` (auth + pro/premium role)

### Webhooks

- `POST /webhooks/stripe` (used by Stripe)

## Authentication

Protected routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Get the access token from `/auth/login` or `/auth/register` response.

## Role-Based Access Control

- `free` - Default role for all users
- `pro` - Users with Pro subscription
- `premium` - Users with Premium subscription

Role hierarchy: `free < pro < premium`

## Stripe Integration

### Checkout Flow

1. User calls `POST /billing/checkout` with `planCode`
2. Backend creates Stripe Checkout Session
3. User completes payment on Stripe Checkout page
4. Stripe sends webhooks to backend
5. Subscription is created/updated in database
6. User role is updated

### Billing Portal

Users can manage their subscriptions through Stripe's Billing Portal:
- Cancel subscription
- Update payment method
- View invoices

Access via `POST /billing/portal`.

## Project Structure

```
src/
├── app.ts                     # Fastify app setup
├── server.ts                  # Server entry point
├── core/
│   ├── env/                   # Environment validation
│   ├── errors/                # Custom errors
│   ├── http/                  # HTTP utilities, routes, error handler
│   ├── middleware/            # Auth guards
│   └── utils/                 # JWT, password, audit log
├── modules/
│   ├── auth/                  # Authentication
│   ├── users/                 # User endpoints
│   ├── plans/                 # Subscription plans
│   ├── subscriptions/         # Subscription management
│   ├── payments/              # Billing, invoices
│   ├── webhooks/              # Stripe webhooks
│   └── reports/               # Reports and analytics
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── client.ts              # Prisma client
│   ├── seed.ts                # Database seeding
│   └── migrations/            # Database migrations
└── config/
    └── stripe.ts              # Stripe configuration

```

## 🚀 Deployment

### Railway

This project is configured for deployment on [Railway](https://railway.app).

**Live Demo:** [https://billforge-production.up.railway.app](https://billforge-production.up.railway.app)

#### Setup Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Login with GitHub
   - Authorize Railway to access your repositories

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `billforge` repository

3. **Add PostgreSQL Database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically creates and injects `DATABASE_URL`

4. **Configure Environment Variables**
   - Go to your service → "Variables"
   - Add the following:
     ```
     NODE_ENV=production
     JWT_SECRET=<generate 32+ character string>
     REFRESH_TOKEN_SECRET=<generate 32+ character string>
     COOKIE_SECRET=<generate 32+ character string>
     STRIPE_SECRET_KEY=<your Stripe secret key>
     STRIPE_PUBLIC_KEY=<your Stripe public key>
     STRIPE_PRICE_ID_PRO=<your Stripe Pro price ID>
     STRIPE_PRICE_ID_PREMIUM=<your Stripe Premium price ID>
     STRIPE_WEBHOOK_SECRET=<configure after webhook setup>
     ```

5. **Deploy**
   - Railway automatically detects Node.js and runs build
   - After first deploy, run migrations:
     ```bash
     railway run npm run prisma:deploy
     railway run npm run prisma:seed
     ```
   - Or use the `postdeploy` script (runs automatically)

6. **Configure Stripe Webhook**
   - Get your Railway URL: `https://your-app.up.railway.app`
   - Go to Stripe Dashboard → Webhooks → Add endpoint
   - URL: `https://your-app.up.railway.app/webhooks/stripe`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.*`
     - `invoice.*`
   - Copy the signing secret and add to Railway as `STRIPE_WEBHOOK_SECRET`

#### Railway CLI (Optional):

```bash
npm i -g @railway/cli
railway login
railway link
railway up
```

## License

MIT

