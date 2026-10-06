/**
 * T4 — Economic Population: Agent Structure & Population Lifecycle
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §7, §12, §14 (T4).
 *
 * Each agent represents an autonomous financial organism with:
 *   - Dedicated capital / USD equity (A_t^USD)
 *   - Tabular Q-learning policy with its own Q-table
 *   - Operational lifecycle (birth, trading, costs, reproduction, death)
 *   - Lineage tracking (generation, parentId, children)
 */

import { QLearning, type QLearningConfig } from '../../src/rl/q-learning.js';
import { type Genome, DEFAULT_GENOME } from '../../src/genome/types.js';
import { ACTION_IDS } from '../../src/rl/actions.js';

export interface AgentRecord {
  id: string;
  parentId: string | null;
  generation: number;
  capital: number;
  initialCapital: number;
  peakCapital: number;
  genome: Genome;
  alive: boolean;
  tradesCount: number;
  birthStep: number;
  deathStep: number | null;
  reproductionCount: number;
  ql: QLearning;
  inventoryState: 'FLAT' | 'LIGHT' | 'HEAVY';
  dailyReturns: number[];
  lastReproductionStep: number | null;
}

export interface PopulationConfig {
  founderCount: number;
  initialCapitalPerFounder: number;
  reproductionThresholdMultiplier: number;
  horizonYears: number;
  stepsPerYear: number;
  dt: number;
  seed: number;
}

export const T4_STRESS_POPULATION_CONFIG: PopulationConfig = {
  founderCount: 10,
  initialCapitalPerFounder: 800, // $800 USD Stress Setup (20-month passive runway at $40/mo)
  reproductionThresholdMultiplier: 1.5, // 1.5x initial capital threshold ($1,200)
  horizonYears: 2,
  stepsPerYear: 365,
  dt: 1 / 365,
  seed: 42,
};

export const T4_PRODUCT_POPULATION_CONFIG: PopulationConfig = {
  founderCount: 10,
  initialCapitalPerFounder: 5000, // $5,000 USD Product Setup (125-month passive runway at $40/mo)
  reproductionThresholdMultiplier: 1.5, // 1.5x initial capital threshold ($7,500)
  horizonYears: 2,
  stepsPerYear: 365,
  dt: 1 / 365,
  seed: 42,
};

export const T4_DEFAULT_POPULATION_CONFIG: PopulationConfig = T4_STRESS_POPULATION_CONFIG;

/**
 * Creates a founder agent (Generation 0).
 */
export function createFounder(
  id: string,
  initialCapital: number,
  genome: Genome = DEFAULT_GENOME,
  qlConfig: Partial<QLearningConfig> = {},
): AgentRecord {
  const ql = new QLearning(ACTION_IDS, {
    alpha: genome.g_alpha,
    gamma: 0.95,
    epsilon: genome.g_epsilon,
    epsilonDecay: 0.9995,
    epsilonMin: 0.05,
    ...qlConfig,
  });

  return {
    id,
    parentId: null,
    generation: 0,
    capital: initialCapital,
    initialCapital,
    peakCapital: initialCapital,
    genome: { ...genome },
    alive: true,
    tradesCount: 0,
    birthStep: 0,
    deathStep: null,
    reproductionCount: 0,
    ql,
    inventoryState: 'FLAT',
    dailyReturns: [],
    lastReproductionStep: null,
  };
}

/**
 * Bound for Q-table values per Paper §7 Proposition 2:
 * B_Q >= R_max / (1 - gamma) = 1.0 / (1 - 0.95) = 20.0
 */
export const B_Q = 20.0;

function sampleGaussian(rng?: { next: () => number }): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng ? rng.next() : Math.random();
  while (v === 0) v = rng ? rng.next() : Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function sampleFiniteGaussian(stdev = 0.05, rng?: { next: () => number }): number {
  let val: number;
  do {
    const z = sampleGaussian(rng);
    val = z * stdev;
  } while (!Number.isFinite(val));
  return val;
}

/**
 * Mutates all 7 loci of parent genome per Paper §7 & Proposition 5:
 *   g_i^child = clip(g_i^parent * (1 + xi_i), l_i, u_i)
 *   xi_i ~ N(0, 0.05^2)
 *
 * Guarantees g^child in Omega strictly.
 */
export function mutateGenome(
  parentGenome: Genome,
  rng?: { next: () => number },
): Genome {
  const mutateFloat = (val: number, min: number, max: number): number => {
    const xi = sampleFiniteGaussian(0.05, rng);
    const raw = val * (1 + xi);
    const clamped = Math.max(min, Math.min(max, raw));
    return Number(clamped.toFixed(4));
  };

  const mutateInt = (val: number, min: number, max: number): number => {
    const xi = sampleFiniteGaussian(0.05, rng);
    const raw = val * (1 + xi);
    const clamped = Math.max(min, Math.min(max, raw));
    return Math.round(clamped);
  };

  return {
    g_risk: mutateFloat(parentGenome.g_risk, 0.10, 5.00),
    g_tau: mutateInt(parentGenome.g_tau, 5, 60),
    g_epsilon: mutateFloat(parentGenome.g_epsilon, 0.05, 0.50),
    g_alpha: mutateFloat(parentGenome.g_alpha, 0.01, 0.25),
    g_gas: mutateInt(parentGenome.g_gas, 100, 1000),
    g_omega: mutateFloat(parentGenome.g_omega, 0.05, 0.40),
    g_mitosis: mutateFloat(parentGenome.g_mitosis, 1.50, 3.00),
  };
}

/**
 * Inherits and perturbs parent Q-table per Paper §7 Proposition 2:
 *   Q_child(s,a) = clip(Q_parent(s,a) + zeta_{s,a}, -B_Q, B_Q)
 *   B_Q >= R_max / (1 - gamma) = 20.0
 */
export function inheritQTableWithPerturbation(
  parentQTable: Record<string, Record<string, number>>,
  sigmaQ: number = 0.02,
  bQ: number = B_Q,
  rng?: { next: () => number },
): Record<string, Record<string, number>> {
  const childTable: Record<string, Record<string, number>> = {};
  for (const [state, actions] of Object.entries(parentQTable)) {
    childTable[state] = {};
    for (const [action, qVal] of Object.entries(actions)) {
      const zeta = sampleFiniteGaussian(sigmaQ, rng);
      const perturbed = Math.max(-bQ, Math.min(bQ, qVal + zeta));
      childTable[state][action] = perturbed;
    }
  }
  return childTable;
}

export interface ReproductionOptions {
  mutate?: boolean;
  rng?: { next: () => number };
  sigmaQ?: number;
  bQ?: number;
}

/**
 * Spawns a child agent via surplus transfer per Paper §7.3 & Proposition 6:
 *   L_surplus = max(0, capital - initialCapital)
 *   Transfer T = 0.5 * L_surplus
 *
 * Implements biological inheritance per Paper §7:
 *   - Mutated genome: g_child in Omega (Proposition 5)
 *   - Perturbed Q-table: Q_child in [-B_Q, B_Q] (Proposition 2)
 *
 * Child receives capital = T. Parent retains capital - T.
 * Aggregate capital is strictly conserved across the division event.
 */
export function reproduceAgent(
  parent: AgentRecord,
  childId: string,
  step: number,
  qlConfig: Partial<QLearningConfig> = {},
  options?: ReproductionOptions,
): { child: AgentRecord; transferAmount: number } {
  const surplus = Math.max(0, parent.capital - parent.initialCapital);
  const transfer = 0.5 * surplus;

  // Deduct transfer from parent capital (conservation of capital)
  parent.capital -= transfer;
  parent.reproductionCount++;
  parent.lastReproductionStep = step;

  // Phase 3: Genome mutation (or identity if mutate === false)
  const shouldMutate = options?.mutate ?? true;
  const childGenome = shouldMutate
    ? mutateGenome(parent.genome, options?.rng)
    : { ...parent.genome };

  // Child inherits mutated learning rate and exploration from mutated genome
  const childQl = new QLearning(ACTION_IDS, {
    alpha: childGenome.g_alpha,
    gamma: 0.95,
    epsilon: childGenome.g_epsilon,
    epsilonDecay: 0.9995,
    epsilonMin: 0.05,
    ...qlConfig,
  });

  // Phase 3: Inherit parent Q-table knowledge with bounded perturbation
  const parentQData = parent.ql.exportQTable();
  const childQData = shouldMutate
    ? inheritQTableWithPerturbation(parentQData, options?.sigmaQ ?? 0.02, options?.bQ ?? B_Q, options?.rng)
    : parentQData;
  childQl.importQTable(childQData);

  const child: AgentRecord = {
    id: childId,
    parentId: parent.id,
    generation: parent.generation + 1,
    capital: transfer,
    initialCapital: transfer,
    peakCapital: transfer,
    genome: childGenome,
    alive: true,
    tradesCount: 0,
    birthStep: step,
    deathStep: null,
    reproductionCount: 0,
    ql: childQl,
    inventoryState: 'FLAT',
    dailyReturns: [],
    lastReproductionStep: null,
  };

  return { child, transferAmount: transfer };
}

