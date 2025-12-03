import type { FastifyReply, FastifyRequest } from 'fastify';
import { PlansService } from './plans.service.js';

const plansService = new PlansService();

export async function listPlansController(_req: FastifyRequest, reply: FastifyReply) {
  const plans = await plansService.listActivePlans();

  return reply.status(200).send({
    plans,
  });
}
