import { buildApp } from './app.js';
import { env } from './core/env/env.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

async function start() {
  const app = buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0'
    });

    app.log.info(`HTTP server listening on port ${env.PORT}`);

    const shutdown = async (signal: string) => {
      app.log.info(`${signal} received, shutting down gracefully`);
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    app.log.error(error, 'Error while starting server');
    process.exit(1);
  }
}

start();
