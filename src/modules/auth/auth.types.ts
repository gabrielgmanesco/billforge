import type { User } from '@prisma/client';

export type AuthTokens = {
    accessToken: string;
}

export type AuthenticatedUser = {
    id: string;
    email: string;
    name: string;
};

export function toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
    };
}