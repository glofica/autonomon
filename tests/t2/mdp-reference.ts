/**
 * T2 — Known Stationary Markov Decision Process (MDP) Reference
 *
 * Mathematical specification per Paper §14:
 *   "Finite, fully observed inventory/regime state with known transition kernel,
 *    bounded reward, and fixed admissible sets; two-state drift persistence q
 *    may be used as a component. Compute Q* by value iteration to a tighter
 *    reference tolerance. Target error < epsilon and agreement >= 95%."
 *
 * State space S (|S| = 6):
 *   Regimes: { BULL, BEAR }
 *   Inventory: { FLAT, LIGHT, HEAVY } per Paper §3.5
 *   S = { BULL_FLAT, BULL_LIGHT, BULL_HEAVY, BEAR_FLAT, BEAR_LIGHT, BEAR_HEAVY }
 *
 * Action space A (|A| = 3):
 *   A = { HOLD, ACQUIRE_SPOT, DISPOSE_SPOT } per Paper §4
 *
 * Transition Kernel P(s' | s, a):
 *   - Regime persistence q = 0.8:
 *       P(BULL -> BULL) = 0.8, P(BULL -> BEAR) = 0.2
 *       P(BEAR -> BEAR) = 0.8, P(BEAR -> BULL) = 0.2
 *   - Inventory dynamics:
 *       HOLD: retains current inventory
 *       ACQUIRE_SPOT: FLAT -> LIGHT, LIGHT -> HEAVY, HEAVY -> HEAVY
 *       DISPOSE_SPOT: HEAVY -> FLAT, LIGHT -> FLAT, FLAT -> FLAT
 *
 * Bounded Reward R(s, a):
 *   R(s, a) = exposure(i') * drift(m) - cost(a)
 *   where drift(BULL) = +0.08, drift(BEAR) = -0.08, cost = 0.01 for trades, 0 for HOLD.
 *   Bounded in [-0.09, +0.08] subset [-R_max, +R_max] with R_max = 1.0.
 *
 * Discount factor:
 *   gamma = 0.95 per Paper §14
 */

export interface Transition {
  nextState: string;
  probability: number;
}

export interface MDPDefinition {
  name: string;
  states: string[];
  actions: string[];
  gamma: number;
  transitions: Record<string, Record<string, Transition[]>>;
  rewards: Record<string, Record<string, number>>;
  initialDistribution: Record<string, number>;
}

export const T2_STATES = [
  'BULL_FLAT',
  'BULL_LIGHT',
  'BULL_HEAVY',
  'BEAR_FLAT',
  'BEAR_LIGHT',
  'BEAR_HEAVY',
] as const;

export type T2State = typeof T2_STATES[number];

export const T2_ACTIONS = [
  'HOLD',
  'ACQUIRE_SPOT',
  'DISPOSE_SPOT',
] as const;

export type T2Action = typeof T2_ACTIONS[number];

export const T2_GAMMA = 0.95;

export const DRIFT_BULL = 0.08;
export const DRIFT_BEAR = -0.08;
export const TRANSACTION_COST = 0.01;
export const REGIME_PERSISTENCE = 0.8;

function getNextInventory(currInv: string, action: string): string {
  if (action === 'HOLD') {
    return currInv;
  }
  if (action === 'ACQUIRE_SPOT') {
    if (currInv === 'FLAT') return 'LIGHT';
    return 'HEAVY';
  }
  if (action === 'DISPOSE_SPOT') {
    return 'FLAT';
  }
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

function buildMDP(): MDPDefinition {
  const transitions: Record<string, Record<string, Transition[]>> = {};
  const rewards: Record<string, Record<string, number>> = {};

  for (const s of T2_STATES) {
    transitions[s] = {};
    rewards[s] = {};

    const [regime, inv] = s.split('_');
    const isBull = regime === 'BULL';
    const drift = isBull ? DRIFT_BULL : DRIFT_BEAR;
    const pSameRegime = REGIME_PERSISTENCE;
    const pSwitchRegime = 1.0 - REGIME_PERSISTENCE;

    for (const a of T2_ACTIONS) {
      const nextInv = getNextInventory(inv, a);
      const isTrade = a === 'ACQUIRE_SPOT' || a === 'DISPOSE_SPOT';
      const cost = isTrade ? TRANSACTION_COST : 0.0;
      const exposure = getExposure(nextInv);

      // Reward R(s, a)
      rewards[s][a] = exposure * drift - cost;

      // Transitions P(s' | s, a)
      const sameRegimeNextState = `${regime}_${nextInv}`;
      const otherRegime = isBull ? 'BEAR' : 'BULL';
      const switchRegimeNextState = `${otherRegime}_${nextInv}`;

      transitions[s][a] = [
        { nextState: sameRegimeNextState, probability: pSameRegime },
        { nextState: switchRegimeNextState, probability: pSwitchRegime },
      ];
    }
  }

  // Uniform initial distribution across all 6 states
  const initialDistribution: Record<string, number> = {};
  for (const s of T2_STATES) {
    initialDistribution[s] = 1.0 / T2_STATES.length;
  }

  return {
    name: 'T2_Stationary_6State_MDP',
    states: [...T2_STATES],
    actions: [...T2_ACTIONS],
    gamma: T2_GAMMA,
    transitions,
    rewards,
    initialDistribution,
  };
}

export const T2_MDP = buildMDP();
