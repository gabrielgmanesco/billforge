import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../prisma/client.js';

export async function summaryReportController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const [usersCount, subscriptionsCount, invoicesCount] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count(),
    prisma.invoice.count(),
  ]);

  return reply.status(200).send({
    usersCount,
    subscriptionsCount,
    invoicesCount,
  });
}
