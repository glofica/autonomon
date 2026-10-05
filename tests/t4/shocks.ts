/**
 * T4 — Economic Population: Correlated Factor Model & Fat-Tail Shocks
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §7.1, Proposition 10, §14 (T4).
 *
 * Market Factor Model:
 *   r_{m, t} = mu_m * dt + sigma_m * sqrt(dt) * Z_{m, t} + J_t
 *
 * For each agent i:
 *   r_{i, t} = mu_m * dt + sqrt(rho) * sigma_m * sqrt(dt) * Z_{m, t} + sqrt(1 - rho) * sigma_i * sqrt(dt) * Z_{i, t} + J_t
 *
 * Where:
 *   - rho in [0, 1) is the pairwise return correlation (Proposition 10 default: 0.50)
 *   - Z_{m, t}, Z_{i, t} ~ N(0, 1) (drawn via seeded Box-Muller transform)
 *   - J_t is a systemic macro tail jump shock (fat tails)
 *
 * Scenarios:
 *   - Scenario A: Pure Martingale (marketDrift = 0.0)
 *   - Scenario B: Negative Drift (marketDrift = -0.24, i.e. -2% monthly / -24% annualized)
 */

import { type RandomSource } from '../../src/rl/q-learning.js';

export interface ShockModelConfig {
  name?: string;
  marketDrift: number;        // Annualized market drift mu_m (0 for martingale, -0.24 for -2%/mo)
  marketVol: number;          // Annualized market volatility sigma_m (e.g. 0.30)
  idiosyncraticVol: number;   // Annualized idiosyncratic volatility sigma_eps (e.g. 0.25)
  correlationRho: number;     // Pairwise correlation rho in [0, 1) (Proposition 10)
  enableFatTails: boolean;
  tailJumpProb: number;       // Probability of tail event per step (e.g. 0.02)
  tailJumpMean: number;       // Mean impact of tail shock (e.g. -0.12)
  tailJumpVol: number;        // Dispersion of tail shock (e.g. 0.04)
}

/**
 * Scenario A: Pure Martingale (zero drift, baseline market dynamics)
 */
export const T4_SHOCK_SCENARIO_A: ShockModelConfig = {
  name: 'Scenario A (Pure Martingale, drift = 0%)',
  marketDrift: 0.0,           // 0% drift
  marketVol: 0.30,            // 30% annualized volatility
  idiosyncraticVol: 0.25,     // 25% annualized idiosyncratic vol
  correlationRho: 0.50,       // rho = 0.50 per Proposition 10
  enableFatTails: true,       // Fat tails enabled
  tailJumpProb: 0.02,         // 2% daily probability of systemic stress event
  tailJumpMean: -0.12,        // -12% sharp market-wide drawdown
  tailJumpVol: 0.04,          // 4% tail shock dispersion
};

/**
 * Scenario B: Negative Drift (-2% monthly bear market per Paper §14)
 */
export const T4_SHOCK_SCENARIO_B: ShockModelConfig = {
  name: 'Scenario B (Negative Drift, -2%/month bear market)',
  marketDrift: -0.24,         // -2% monthly = -24% annualized drift
  marketVol: 0.30,            // 30% annualized volatility
  idiosyncraticVol: 0.25,     // 25% annualized idiosyncratic vol
  correlationRho: 0.50,       // rho = 0.50 per Proposition 10
  enableFatTails: true,       // Fat tails enabled
  tailJumpProb: 0.02,         // 2% daily probability
  tailJumpMean: -0.12,        // -12% mean tail shock
  tailJumpVol: 0.04,          // 4% tail shock dispersion
};

export const T4_DEFAULT_SHOCK_CONFIG: ShockModelConfig = T4_SHOCK_SCENARIO_A;

/**
 * Standard Normal generator using Box-Muller transform.
 */
export function standardNormal(rng: RandomSource): number {
  let u1 = rng.next();
  while (u1 <= 1e-15) u1 = rng.next();
  const u2 = rng.next();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

export interface StepShockResult {
  marketReturn: number;
  agentReturns: Record<string, number>;
  tailEventOccurred: boolean;
}

/**
 * Generates correlated asset returns for all living agents at a given time step.
 */
export function generateStepShocks(
  agentIds: string[],
  dt: number,
  rng: RandomSource,
  config: ShockModelConfig = T4_DEFAULT_SHOCK_CONFIG,
): StepShockResult {
  const sqrtDt = Math.sqrt(dt);

  // 1. Common market diffusion factor
  const zMarket = standardNormal(rng);
  const commonFactor = config.marketVol * sqrtDt * zMarket;

  // 2. Check for macro tail shock (systemic shock to all correlated agents)
  let macroTailShock = 0.0;
  let tailEventOccurred = false;
  if (config.enableFatTails && rng.next() < config.tailJumpProb) {
    tailEventOccurred = true;
    macroTailShock = config.tailJumpMean + config.tailJumpVol * standardNormal(rng);
  }

  const marketReturn = config.marketDrift * dt + commonFactor + macroTailShock;

  // 3. Asset return for each agent
  const sqrtRho = Math.sqrt(config.correlationRho);
  const sqrtOneMinusRho = Math.sqrt(1.0 - config.correlationRho);
  const agentReturns: Record<string, number> = {};

  for (const id of agentIds) {
    const zIdio = standardNormal(rng);
    const idioComponent = config.idiosyncraticVol * sqrtDt * zIdio;

    const returnI = config.marketDrift * dt + sqrtRho * commonFactor + sqrtOneMinusRho * idioComponent + macroTailShock;
    agentReturns[id] = returnI;
  }

  return {
    marketReturn,
    agentReturns,
    tailEventOccurred,
  };
}
