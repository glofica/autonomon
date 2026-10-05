/**
 * T3 — Regime Change Markov Decision Process Reference
 *
 * Mathematical specification per Paper §14 & §14.1:
 *   "T3: Regime change — T2 with one documented parameter change at tau.
 *    Compare constant-step learning against frozen and diminishing-step baselines.
 *    Measure time to remain within a specified post-change value/regret tolerance
 *    for a fixed duration. Record unrecovered runs as censored; report both
 *    adaptation delay and cumulative cost."
 *
 * Documented Parameter Change at tau = 25,000:
 *   1. Regime persistence q:
 *        Phase 1 (t < tau):  q = 0.80 (persistent trends)
 *        Phase 2 (t >= tau): q = 0.30 (high churn / rapid regime switching)
 *   2. Asset drift (mu_bull, mu_bear):
 *        Phase 1 (t < tau):  mu_bull = +0.08, mu_bear = -0.08 (canonical bull/bear)
 *        Phase 2 (t >= tau): mu_bull = -0.10, mu_bear = +0.10 (macro regime reversal)
 *
 * Impact on Optimal Policy (Paper §14.1 Requirement):
 *   Phase 1 Ground Truth (pi*_1):
 *     BULL_FLAT  -> ACQUIRE_SPOT
 *     BULL_LIGHT -> ACQUIRE_SPOT
 *     BULL_HEAVY -> HOLD
 *     BEAR_FLAT  -> HOLD
 *     BEAR_LIGHT -> DISPOSE_SPOT
 *     BEAR_HEAVY -> DISPOSE_SPOT
 *
 *   Phase 2 Ground Truth (pi*_2):
 *     BULL_FLAT  -> HOLD
 *     BULL_LIGHT -> DISPOSE_SPOT
 *     BULL_HEAVY -> DISPOSE_SPOT
 *     BEAR_FLAT  -> ACQUIRE_SPOT
 *     BEAR_LIGHT -> ACQUIRE_SPOT
 *     BEAR_HEAVY -> HOLD
 *
 *   The shift alters the optimal action across states, guaranteeing that a frozen
 *   baseline policy has strictly positive regret (> 0.05 tolerance), proving the
 *   superiority of constant-step tracking under non-stationarity (Proposition 8).
 */

import {
  type MDPDefinition,
  type Transition,
  T2_MDP,
  T2_STATES,
  T2_ACTIONS,
  T2_GAMMA,
  TRANSACTION_COST,
} from '../t2/mdp-reference.js';

export const TAU_CHANGE_STEP = 25000;
export const TOTAL_TRANSITIONS = 50000;
export const REGRET_TOLERANCE = 0.05;

// Phase 1 parameters (inherited from T2)
export const PHASE1_Q = 0.80;
export const PHASE1_DRIFT_BULL = 0.08;
export const PHASE1_DRIFT_BEAR = -0.08;

// Phase 2 parameters (post-tau change)
export const PHASE2_Q = 0.30;
export const PHASE2_DRIFT_BULL = -0.10;
export const PHASE2_DRIFT_BEAR = +0.10;

function getNextInventory(currInv: string, action: string): string {
  if (action === 'HOLD') return currInv;
  if (action === 'ACQUIRE_SPOT') {
    if (currInv === 'FLAT') return 'LIGHT';
    return 'HEAVY';
  }
  if (action === 'DISPOSE_SPOT') return 'FLAT';
  return currInv;
}

function getExposure(inv: string): number {
  switch (inv) {
    case 'HEAVY': return 1.0;
    case 'LIGHT': return 0.5;
    case 'FLAT':
    default: return 0.0;
  }
}

/**
 * Builds the Post-Change MDP (Phase 2, t >= tau).
 */
export function buildPhase2MDP(): MDPDefinition {
  const transitions: Record<string, Record<string, Transition[]>> = {};
  const rewards: Record<string, Record<string, number>> = {};

  for (const s of T2_STATES) {
    transitions[s] = {};
    rewards[s] = {};

    const [regime, inv] = s.split('_');
    const isBull = regime === 'BULL';
    const drift = isBull ? PHASE2_DRIFT_BULL : PHASE2_DRIFT_BEAR;
    const pSameRegime = PHASE2_Q;
    const pSwitchRegime = 1.0 - PHASE2_Q;

    for (const a of T2_ACTIONS) {
      const nextInv = getNextInventory(inv, a);
      const isTrade = a === 'ACQUIRE_SPOT' || a === 'DISPOSE_SPOT';
      const cost = isTrade ? TRANSACTION_COST : 0.0;
      const exposure = getExposure(nextInv);

      // Reward R_2(s, a)
      rewards[s][a] = exposure * drift - cost;

      // Transitions P_2(s' | s, a)
      const sameRegimeNextState = `${regime}_${nextInv}`;
      const otherRegime = isBull ? 'BEAR' : 'BULL';
      const switchRegimeNextState = `${otherRegime}_${nextInv}`;

      transitions[s][a] = [
        { nextState: sameRegimeNextState, probability: pSameRegime },
        { nextState: switchRegimeNextState, probability: pSwitchRegime },
      ];
    }
  }

  const initialDistribution: Record<string, number> = {};
  for (const s of T2_STATES) {
    initialDistribution[s] = 1.0 / T2_STATES.length;
  }

  return {
    name: 'T3_PostChange_MDP_Phase2',
    states: [...T2_STATES],
    actions: [...T2_ACTIONS],
    gamma: T2_GAMMA,
    transitions,
    rewards,
    initialDistribution,
  };
}

export const T3_MDP_PHASE1 = T2_MDP;
export const T3_MDP_PHASE2 = buildPhase2MDP();
