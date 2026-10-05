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

export const T4_DEFAULT_POPULATION_CONFIG: PopulationConfig = {
  founderCount: 10,
  initialCapitalPerFounder: 2000, // $2,000 USD baseline capital per calibration request
  reproductionThresholdMultiplier: 1.5, // Phase 1: 1.5x initial capital threshold ($3,000)
  horizonYears: 2,               // 2-year simulation horizon
  stepsPerYear: 365,             // Daily decision intervals (dt = 1/365 year)
  dt: 1 / 365,
  seed: 42,
};

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
  };
}

/**
 * Spawns a child agent via surplus transfer per Paper §7.3 & Proposition 6:
 *   L_surplus = max(0, capital - initialCapital)
 *   Transfer T = 0.5 * L_surplus
 *
 * Child receives capital = T. Parent retains capital - T.
 * Aggregate capital is strictly conserved across the division event.
 */
export function reproduceAgent(
  parent: AgentRecord,
  childId: string,
  step: number,
  qlConfig: Partial<QLearningConfig> = {},
): { child: AgentRecord; transferAmount: number } {
  const surplus = Math.max(0, parent.capital - parent.initialCapital);
  const transfer = 0.5 * surplus;

  // Deduct transfer from parent capital (conservation of capital)
  parent.capital -= transfer;
  parent.reproductionCount++;

  // Child inherits parent genome and starts with transfer capital
  const childQl = new QLearning(ACTION_IDS, {
    alpha: parent.genome.g_alpha,
    gamma: 0.95,
    epsilon: parent.genome.g_epsilon,
    epsilonDecay: 0.9995,
    epsilonMin: 0.05,
    ...qlConfig,
  });

  // Inherit parent Q-table knowledge (bounded policy inheritance §7)
  const parentQData = parent.ql.exportQTable();
  childQl.importQTable(parentQData);

  const child: AgentRecord = {
    id: childId,
    parentId: parent.id,
    generation: parent.generation + 1,
    capital: transfer,
    initialCapital: transfer,
    peakCapital: transfer,
    genome: { ...parent.genome },
    alive: true,
    tradesCount: 0,
    birthStep: step,
    deathStep: null,
    reproductionCount: 0,
    ql: childQl,
    inventoryState: 'FLAT',
  };

  return { child, transferAmount: transfer };
}
