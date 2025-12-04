import type { FastifyInstance } from 'fastify';
import { summaryReportController } from './reports.controller.js';
import { authGuard, roleGuard } from '../../core/middleware/auth.js';

export async function registerReportsRoutes(app: FastifyInstance): Promise<void> {
    app.get(
        '/reports/summary',
        {
            preHandler: [authGuard, roleGuard('pro')],
        },
        summaryReportController,
    );
}
