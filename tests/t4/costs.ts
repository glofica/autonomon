/**
 * T4 — Economic Population: Operating Costs & Financial Termination
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §12.1, §12.3, §14 (T4).
 *
 * Fixed Operating Costs:
 *   - Hosting: $15 USD / month (c_t^USD per §12.1 illustrative budget)
 *   - Inference: $5 USD / month (TimesFM external service allocation §8)
 *   - Protected gas: $2 USD / month (base ledger polling & keepalive)
 *   Total baseline: $22 USD / month
 *
 * Ruin Condition:
 *   If an agent's capital falls to <= 0, the agent suffers financial termination
 *   (ruin endpoint per §12.3 & §14.1).
 */

import { type AgentRecord } from './population.js';

export interface CostConfig {
  monthlyHostingUsd: number;
  monthlyInferenceUsd: number;
  monthlyGasUsd: number;
  tradeFeeBps: number;
}

export const T4_DEFAULT_COST_CONFIG: CostConfig = {
  monthlyHostingUsd: 25.0,   // $25/mo hosting
  monthlyInferenceUsd: 10.0, // $10/mo prorated TimesFM + Qwen
  monthlyGasUsd: 5.0,        // $5/mo GLOFICA gas
  tradeFeeBps: 10,           // 10 bps per trade execution
};

export interface CostDeductionResult {
  hostingCost: number;
  inferenceCost: number;
  gasCost: number;
  totalDeduction: number;
  survived: boolean;
}

/**
 * Deducts periodic fixed operating expenses and evaluates solvency.
 *
 * dt is in years (e.g. 1/365 for daily resolution).
 */
export function deductOperatingCosts(
  agent: AgentRecord,
  dt: number,
  currentStep: number,
  costConfig: CostConfig = T4_DEFAULT_COST_CONFIG,
): CostDeductionResult {
  if (!agent.alive) {
    return {
      hostingCost: 0,
      inferenceCost: 0,
      gasCost: 0,
      totalDeduction: 0,
      survived: false,
    };
  }

  // Convert monthly costs to step duration dt (12 months/year * dt years)
  const stepMonths = 12 * dt;
  const hostingCost = costConfig.monthlyHostingUsd * stepMonths;
  const inferenceCost = costConfig.monthlyInferenceUsd * stepMonths;
  const gasCost = costConfig.monthlyGasUsd * stepMonths;

  const totalDeduction = hostingCost + inferenceCost + gasCost;

  agent.capital -= totalDeduction;

  // Ruin condition: equity exhaustion (capital <= 0)
  if (agent.capital <= 0) {
    agent.capital = 0;
    agent.alive = false;
    agent.deathStep = currentStep;
    return {
      hostingCost,
      inferenceCost,
      gasCost,
      totalDeduction,
      survived: false,
    };
  }

  return {
    hostingCost,
    inferenceCost,
    gasCost,
    totalDeduction,
    survived: true,
  };
}
