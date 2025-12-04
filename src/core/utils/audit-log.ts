import { prisma } from '../../prisma/client.js';

type CreateAuditLogParams = {
    userId?: string | null;
    action: string;
    resource?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: unknown;
};

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
    const { userId, action, resource, ipAddress, userAgent, metadata } = params;

    await prisma.auditLog.create({
        data: {
            userId: userId ?? null,
            action,
            resource: resource ?? null,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: metadata ? (metadata as any) : null,
        },
    });
}
