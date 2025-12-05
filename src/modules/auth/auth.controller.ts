import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../core/env/env.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { createAuditLog } from '../../core/utils/audit-log.js';

const authService = new AuthService();

export const REFRESH_TOKEN_COOKIE_NAME = 'billforge_refresh_token';

function setRefreshTokenCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

function clearRefreshTokenCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });
}

export async function registerController(request: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(request.body);

  const result = await authService.register(body);

  const ipAddress = 
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (request.headers['x-real-ip'] as string) ||
    request.ip;

  const userAgent = request.headers['user-agent'] || 'Unknown';

  await createAuditLog({
    userId: result.user.id,
    action: 'auth.register',
    resource: 'user',
    ipAddress,
    userAgent,
    metadata: {
      email: result.user.email,
    },
  });

  setRefreshTokenCookie(reply, result.refreshToken, result.refreshTokenExpiresAt);

  return reply.status(201).send({
    user: result.user,
    accessToken: result.tokens.accessToken,
  });
}

export async function loginController(request: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(request.body);

  const result = await authService.login(body);

  setRefreshTokenCookie(reply, result.refreshToken, result.refreshTokenExpiresAt);

  return reply.status(200).send({
    user: result.user,
    accessToken: result.tokens.accessToken,
  });
}

export async function refreshController(request: FastifyRequest, reply: FastifyReply) {
  const refreshTokenRaw =
    request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ?? (request.body as any)?.refreshToken;

  const result = await authService.refreshSession(refreshTokenRaw);

  setRefreshTokenCookie(reply, result.refreshToken, result.refreshTokenExpiresAt);

  return reply.status(200).send({
    user: result.user,
    accessToken: result.tokens.accessToken,
  });
}

export async function logoutController(request: FastifyRequest, reply: FastifyReply) {
  const refreshTokenRaw = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  await authService.logout(refreshTokenRaw);

  clearRefreshTokenCookie(reply);

  return reply.status(204).send();
}
