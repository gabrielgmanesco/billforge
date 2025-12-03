import type { FastifyInstance } from 'fastify';
import { meController } from './users.controller.js';
import { authGuard } from '../../core/middleware/auth.js';

export async function registerUsersRoutes(app: FastifyInstance): Promise<void> {
    app.get(
        '/me',
        {
            preHandler: [authGuard],
        },
        meController,
    );
}