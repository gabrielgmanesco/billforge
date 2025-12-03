import type { FastifyInstance } from 'fastify';
import { listPlansController } from './plans.controller.js';

export async function registerPlansRoutes(app: FastifyInstance): Promise<void> {
    app.get('/plans', listPlansController);
}
