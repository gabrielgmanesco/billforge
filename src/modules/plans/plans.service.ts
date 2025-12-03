import { PlansRepository } from './plans.repository.js';

const plansRepository = new PlansRepository();

export class PlansService {
  async listActivePlans() {
    const plans = await plansRepository.listActivePlans();

    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      currency: plan.currency,
      interval: plan.interval,
    }));
  }
}
