import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../core/errors/app-error.js';

export async function listUserInvoicesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) {
    throw new AppError('Unauthenticated', 401, 'UNAUTHENTICATED');
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      userId: request.user.id,
    },
    orderBy: {
      invoiceCreatedAt: 'desc',
    },
    take: 50,
    select: {
      id: true,
      stripeInvoiceId: true,
      status: true,
      amountDueCents: true,
      amountPaidCents: true,
      currency: true,
      hostedInvoiceUrl: true,
      invoicePdf: true,
      invoiceCreatedAt: true,
    },
  });

  return reply.status(200).send({
    invoices,
  });
}
