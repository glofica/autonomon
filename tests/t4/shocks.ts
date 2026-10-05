/**
 * T4 — Economic Population: Two-Regime Market Model with Persistence & Correlated Shocks
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §7.1, §14 (T2, T3, T4).
 *
 * Two-Regime Persistence Kernel:
 *   - Latent State: BULL or BEAR
 *   - Persistence: P(BULL -> BULL) = q, P(BEAR -> BEAR) = q (default q = 0.80)
 *   - Transition: P(BULL -> BEAR) = 1 - q, P(BEAR -> BULL) = 1 - q (default 0.20)
 *
 * Within each regime, asset returns follow an equicorrelated factor model:
 *   r_{m, t} = mu_regime * dt + sigma_m * sqrt(dt) * Z_{m, t} + J_t
 *   r_{i, t} = mu_regime * dt + sqrt(rho) * sigma_m * sqrt(dt) * Z_{m, t} + sqrt(1 - rho) * sigma_i * sqrt(dt) * Z_{i, t} + J_t
 *
 * Where:
 *   - mu_regime = driftBull (in BULL) or driftBear (in BEAR)
 *   - rho in [0, 1) is the pairwise return correlation (default 0.50 per Proposition 10)
 *   - J_t is a systemic macro tail jump shock (fat tails)
 *
 * Scenarios:
 *   - Scenario A: Symmetric Regimes (driftBull = +0.08/mo, driftBear = -0.08/mo)
 *   - Scenario B: Bear Dominant (driftBull = +0.04/mo, driftBear = -0.14/mo)
 *   - Scenario C: Bull Dominant (driftBull = +0.14/mo, driftBear = -0.04/mo)
 */

import { type RandomSource } from '../../src/rl/q-learning.js';

export type MarketRegime = 'BULL' | 'BEAR';

export interface ShockModelConfig {
  name?: string;
  regimePersistence: number;  // q = 0.80
  driftBullMonthly: number;   // Monthly drift in BULL
  driftBearMonthly: number;   // Monthly drift in BEAR
  marketVol: number;          // Annualized market vol (0.30)
  idiosyncraticVol: number;   // Annualized idiosyncratic vol (0.25)
  correlationRho: number;     // Pairwise correlation (0.50 per Proposition 10)
  enableFatTails: boolean;
  tailJumpProb: number;       // Probability of tail shock per day (0.02)
  tailJumpMean: number;       // Mean impact of tail shock (-0.12)
  tailJumpVol: number;        // Dispersion of tail shock (0.04)
}

/**
 * Scenario A: Symmetric Regimes (+0.08 monthly BULL / -0.08 monthly BEAR)
 */
export const T4_SHOCK_SCENARIO_A: ShockModelConfig = {
  name: 'Scenario A (Symmetric Regimes, +8% BULL / -8% BEAR)',
  regimePersistence: 0.80,
  driftBullMonthly: 0.08,
  driftBearMonthly: -0.08,
  marketVol: 0.30,
  idiosyncraticVol: 0.25,
  correlationRho: 0.50,
  enableFatTails: true,
  tailJumpProb: 0.02,
  tailJumpMean: -0.12,
  tailJumpVol: 0.04,
};

/**
 * Scenario B: Bear Dominant (+0.04 monthly BULL / -0.14 monthly BEAR)
 */
export const T4_SHOCK_SCENARIO_B: ShockModelConfig = {
  name: 'Scenario B (Bear Dominant, +4% BULL / -14% BEAR)',
  regimePersistence: 0.80,
  driftBullMonthly: 0.04,
  driftBearMonthly: -0.14,
  marketVol: 0.30,
  idiosyncraticVol: 0.25,
  correlationRho: 0.50,
  enableFatTails: true,
  tailJumpProb: 0.02,
  tailJumpMean: -0.12,
  tailJumpVol: 0.04,
};

/**
 * Scenario C: Bull Dominant (+0.14 monthly BULL / -0.04 monthly BEAR)
 */
export const T4_SHOCK_SCENARIO_C: ShockModelConfig = {
  name: 'Scenario C (Bull Dominant, +14% BULL / -4% BEAR)',
  regimePersistence: 0.80,
  driftBullMonthly: 0.14,
  driftBearMonthly: -0.04,
  marketVol: 0.30,
  idiosyncraticVol: 0.25,
  correlationRho: 0.50,
  enableFatTails: true,
  tailJumpProb: 0.02,
  tailJumpMean: -0.12,
  tailJumpVol: 0.04,
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

/**
 * Samples the next regime according to persistence kernel P(s' | s).
 */
export function sampleNextRegime(
  currentRegime: MarketRegime,
  persistenceQ: number,
  rng: RandomSource,
): MarketRegime {
  if (rng.next() < persistenceQ) {
    return currentRegime;
  }
  return currentRegime === 'BULL' ? 'BEAR' : 'BULL';
}

export interface StepShockResult {
  regime: MarketRegime;
  marketReturn: number;
  agentReturns: Record<string, number>;
  tailEventOccurred: boolean;
}

/**
 * Generates correlated asset returns under the active market regime.
 */
export function generateStepShocks(
  agentIds: string[],
  dt: number,
  currentRegime: MarketRegime,
  rng: RandomSource,
  config: ShockModelConfig = T4_DEFAULT_SHOCK_CONFIG,
): StepShockResult {
  const sqrtDt = Math.sqrt(dt);

  // Convert monthly drift to step drift: monthly * (12 * dt)
  const monthlyDrift = currentRegime === 'BULL' ? config.driftBullMonthly : config.driftBearMonthly;
  const stepDrift = monthlyDrift * 12 * dt;

  // 1. Common market diffusion factor
  const zMarket = standardNormal(rng);
  const commonFactor = config.marketVol * sqrtDt * zMarket;

  // 2. Check for macro tail shock (systemic shock across all correlated agents)
  let macroTailShock = 0.0;
  let tailEventOccurred = false;
  if (config.enableFatTails && rng.next() < config.tailJumpProb) {
    tailEventOccurred = true;
    macroTailShock = config.tailJumpMean + config.tailJumpVol * standardNormal(rng);
  }

  const marketReturn = stepDrift + commonFactor + macroTailShock;

  // 3. Asset return for each agent
  const sqrtRho = Math.sqrt(config.correlationRho);
  const sqrtOneMinusRho = Math.sqrt(1.0 - config.correlationRho);
  const agentReturns: Record<string, number> = {};

  for (const id of agentIds) {
    const zIdio = standardNormal(rng);
    const idioComponent = config.idiosyncraticVol * sqrtDt * zIdio;

    const returnI = stepDrift + sqrtRho * commonFactor + sqrtOneMinusRho * idioComponent + macroTailShock;
    agentReturns[id] = returnI;
  }

  return {
    regime: currentRegime,
    marketReturn,
    agentReturns,
    tailEventOccurred,
  };
}
