import type { User } from '@prisma/client';
import { AuthRepository } from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { AppError } from '../../core/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../core/utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type JwtUserPayload,
} from '../../core/utils/jwt.js';
import {
  type AuthenticatedUser,
  type AuthTokens,
  toAuthenticatedUser,
} from './auth.types.js';
import { stripe } from '../../config/stripe.js';

export type AuthSessionResult = {
  user: AuthenticatedUser;
  tokens: AuthTokens;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

const REFRESH_TOKEN_DAYS = 7;

function calculateRefreshTokenExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return expiresAt;
}

export class AuthService {
  private readonly authRepository = new AuthRepository();

  private buildTokens(user: User) {
    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const refreshTokenExpiresAt = calculateRefreshTokenExpiry();

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async register(input: RegisterInput): Promise<AuthSessionResult> {
    const existingUser = await this.authRepository.findUserByEmail(input.email);

    if (existingUser) {
      throw new AppError('Email is already in use', 409, 'EMAIL_ALREADY_IN_USE');
    }

    const passwordHash = await hashPassword(input.password);

    let stripeCustomerId: string | null = null;

    if (stripe) {
      try {
        const customer = await stripe.customers.create({
          email: input.email,
          name: input.name,
        });

        stripeCustomerId = customer.id;
      } catch (error) {
        throw new AppError('Failed to create Stripe customer', 500, 'STRIPE_CUSTOMER_CREATION_FAILED');
      }
    }

    const user = await this.authRepository.createUser({
      email: input.email,
      name: input.name,
      passwordHash,
      stripeCustomerId,
    });

    const { accessToken, refreshToken, refreshTokenExpiresAt } = this.buildTokens(user);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      user: toAuthenticatedUser(user),
      tokens: { accessToken },
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, input.password);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    await this.authRepository.revokeUserRefreshTokens(user.id);

    const { accessToken, refreshToken, refreshTokenExpiresAt } = this.buildTokens(user);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      user: toAuthenticatedUser(user),
      tokens: { accessToken },
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async refreshSession(refreshTokenRaw: string | undefined | null): Promise<AuthSessionResult> {
    if (!refreshTokenRaw) {
      throw new AppError('Missing refresh token', 401, 'MISSING_REFRESH_TOKEN');
    }

    let payload: JwtUserPayload;

    try {
      payload = verifyRefreshToken(refreshTokenRaw);
    } catch {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const existingToken = await this.authRepository.findRefreshToken(refreshTokenRaw);

    if (!existingToken || existingToken.isRevoked) {
      throw new AppError('Refresh token is not valid', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (existingToken.expiresAt.getTime() < Date.now()) {
      throw new AppError('Refresh token has expired', 401, 'EXPIRED_REFRESH_TOKEN');
    }

    const user = await this.authRepository.findUserById(payload.sub);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await this.authRepository.revokeRefreshToken(existingToken.id);

    const { accessToken, refreshToken, refreshTokenExpiresAt } = this.buildTokens(user);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      user: toAuthenticatedUser(user),
      tokens: { accessToken },
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async logout(refreshTokenRaw: string | undefined | null): Promise<void> {
    if (!refreshTokenRaw) {
      return;
    }

    const existingToken = await this.authRepository.findRefreshToken(refreshTokenRaw);

    if (!existingToken || existingToken.isRevoked) {
      return;
    }

    await this.authRepository.revokeRefreshToken(existingToken.id);
  }
}
