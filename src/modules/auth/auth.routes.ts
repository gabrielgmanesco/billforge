import type { FastifyInstance } from 'fastify';
import {
    loginController,
    logoutController,
    refreshController,
    registerController,
} from './auth.controller.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
    app.post('/register', registerController);
    app.post('/login', loginController);
    app.post('/refresh', refreshController);
    app.delete('/logout', logoutController);
}