import type { FastifyInstance } from 'fastify';
import {
    loginController,
    logoutController,
    refreshController,
    registerController,
} from './auth.controller.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
    app.post('/register', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '15 minutes',
            }
        }
    }, registerController);

    app.post('/login', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '5 minutes',
            }
        }
    }, loginController);
    
    app.post('/refresh', refreshController);
    app.delete('/logout', logoutController);
}