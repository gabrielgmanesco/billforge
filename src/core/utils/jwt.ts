import jwt from 'jsonwebtoken';
import { env } from '../env/env.js';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export type JwtUserPayload = {
  sub: string;
  email: string;
};

export function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function signRefreshToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid access token payload');
  }

  return decoded as JwtUserPayload;
}

export function verifyRefreshToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET);

  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid refresh token payload');
  }

  return decoded as JwtUserPayload;
}
