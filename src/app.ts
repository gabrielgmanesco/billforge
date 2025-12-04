import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyRawBody from 'fastify-raw-body';

import { env } from './core/env/env.js';
import { registerRoutes } from './core/http/routes.js';
import { errorHandler } from './core/http/error-handler.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info'
    }
  });

  app.register(cookie, {
    secret: env.COOKIE_SECRET,
    hook: 'onRequest',
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production'
    }
  });

  app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'buffer',
    runFirst: true,
  });

  app.register(registerRoutes);

  app.setErrorHandler(errorHandler);

  return app;
}
