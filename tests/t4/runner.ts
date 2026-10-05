/**
 * T4 — Economic Population: Simulation Runner (Phase 1 Skeleton)
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §7, §12, §14 (T4).
 *
 * Temporal Execution Loop:
 *   For each time step t = 0 ... N - 1:
 *     1. Generate correlated asset returns (common factor + idiosyncratic + tail jumps)
 *     2. For each living agent:
 *        a. Observe state (market signal + inventory)
 *        b. Select action (HOLD, ACQUIRE_SPOT, DISPOSE_SPOT)
 *        c. Execute trade & compute PnL
 *        d. Deduct fixed operating costs (hosting, inference, gas)
 *        e. Evaluate solvency: if capital <= 0 -> death / financial termination
 *        f. Update tabular Q-learning
 *     3. Reproduction gate (Phase 1):
 *        If capital > 2.0 * initialCapital:
 *          Spawn child with 50% surplus transfer (Proposition 6 capital conservation)
 *     4. Record population metrics & event logs (birth, death, reproduction)
 */

import { type RandomSource } from '../../src/rl/q-learning.js';
import {
  type AgentRecord,
  type PopulationConfig,
  T4_DEFAULT_POPULATION_CONFIG,
  createFounder,
  reproduceAgent,
} from './population.js';
import {
  type CostConfig,
  T4_DEFAULT_COST_CONFIG,
  deductOperatingCosts,
} from './costs.js';
import {
  type ShockModelConfig,
  T4_DEFAULT_SHOCK_CONFIG,
  generateStepShocks,
} from './shocks.js';
import { SeededPRNG } from '../t2/runner.js';
import { computeT4Metrics, type T4Metrics, type SeedPopulationResult } from './metrics.js';
import { writeReport } from './report.js';

export interface PopulationEvent {
  step: number;
  type: 'BIRTH' | 'DEATH' | 'REPRODUCTION';
  agentId: string;
  details?: Record<string, any>;
}

export interface T4Config {
  population: PopulationConfig;
  costs: CostConfig;
  shocks: ShockModelConfig;
  seedsCount: number;
}

export const T4_DEFAULT_CONFIG: T4Config = {
  population: T4_DEFAULT_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_DEFAULT_SHOCK_CONFIG,
  seedsCount: 30,
};

export interface T4Report {
  seedResults: SeedPopulationResult[];
  metrics: T4Metrics;
  passed: boolean;
  reportPath: string;
}

function getNextInventory(currInv: 'FLAT' | 'LIGHT' | 'HEAVY', action: string): 'FLAT' | 'LIGHT' | 'HEAVY' {
  if (action === 'ACQUIRE_SPOT') {
    if (currInv === 'FLAT') return 'LIGHT';
    return 'HEAVY';
  }
  if (action === 'DISPOSE_SPOT') {
    return 'FLAT';
  }
  return currInv;
}

function getExposure(inv: 'FLAT' | 'LIGHT' | 'HEAVY'): number {
  switch (inv) {
    case 'HEAVY': return 1.0;
    case 'LIGHT': return 0.5;
    case 'FLAT':
    default: return 0.0;
  }
}

/**
 * Runs a single population simulation for one seed over the configured horizon.
 */
export async function runOnePopulationSeed(
  seed: number,
  config: T4Config = T4_DEFAULT_CONFIG,
): Promise<SeedPopulationResult> {
  const rng = new SeededPRNG(seed * 7919 + 104729);
  const totalSteps = config.population.horizonYears * config.population.stepsPerYear;
  const dt = config.population.dt;

  const agents: AgentRecord[] = [];
  const events: PopulationEvent[] = [];
  let nextAgentId = 1;

  // Initialize founders
  for (let i = 0; i < config.population.founderCount; i++) {
    const founder = createFounder(
      `founder-${nextAgentId++}`,
      config.population.initialCapitalPerFounder,
    );
    agents.push(founder);
    events.push({
      step: 0,
      type: 'BIRTH',
      agentId: founder.id,
      details: { generation: 0, capital: founder.capital },
    });
  }

  // Time-series tracking: living count per period (daily)
  const livingCounts: number[] = new Array(totalSteps + 1);
  livingCounts[0] = agents.filter((a) => a.alive).length;

  for (let t = 0; t < totalSteps; t++) {
    const livingAgents = agents.filter((a) => a.alive);
    const livingIds = livingAgents.map((a) => a.id);

    // 1. Generate correlated asset shocks
    const shockResult = generateStepShocks(livingIds, dt, rng, config.shocks);
    const marketSignal = shockResult.marketReturn >= 0 ? 'BULL' : 'BEAR';

    // 2. Iterate each living agent
    for (const agent of livingAgents) {
      const prevCapital = agent.capital;
      const stateKey = `${marketSignal}_${agent.inventoryState}`;

      // Select action
      const action = agent.ql.selectAction(stateKey);

      // Execute inventory transition
      const nextInv = getNextInventory(agent.inventoryState, action);
      const isTrade = action === 'ACQUIRE_SPOT' || action === 'DISPOSE_SPOT';
      const tradeFee = isTrade ? agent.capital * (config.costs.tradeFeeBps / 10000) : 0.0;
      if (isTrade) agent.tradesCount++;

      // Trading PnL
      const assetRet = shockResult.agentReturns[agent.id] ?? shockResult.marketReturn;
      const exposure = getExposure(nextInv);
      const tradingPnl = exposure * assetRet * agent.capital - tradeFee;
      agent.capital += tradingPnl;
      agent.inventoryState = nextInv;

      // Deduct operating costs (hosting, inference, gas)
      const costResult = deductOperatingCosts(agent, dt, t, config.costs);

      if (!costResult.survived) {
        events.push({
          step: t,
          type: 'DEATH',
          agentId: agent.id,
          details: { generation: agent.generation, finalCapital: 0 },
        });
      } else {
        if (agent.capital > agent.peakCapital) {
          agent.peakCapital = agent.capital;
        }

        // Q-learning update
        const nextMarketSignal = shockResult.marketReturn >= 0 ? 'BULL' : 'BEAR';
        const nextStateKey = `${nextMarketSignal}_${agent.inventoryState}`;
        const rawReward = prevCapital > 0 && agent.capital > 0
          ? Math.log(agent.capital / prevCapital)
          : 0;
        const reward = Math.max(-1.0, Math.min(1.0, rawReward));
        agent.ql.update(stateKey, action, reward, nextStateKey);
      }
    }

    // 3. Reproduction gate check (Phase 1 simplified: capital >= 2x initial)
    const candidates = agents.filter((a) => a.alive && a.capital >= 2.0 * a.initialCapital);
    for (const parent of candidates) {
      const childId = `agent-${nextAgentId++}`;
      const { child, transferAmount } = reproduceAgent(parent, childId, t);
      agents.push(child);

      events.push({
        step: t,
        type: 'REPRODUCTION',
        agentId: parent.id,
        details: { childId, transferAmount, parentCapitalAfter: parent.capital },
      });
      events.push({
        step: t,
        type: 'BIRTH',
        agentId: child.id,
        details: { parentId: parent.id, generation: child.generation, capital: child.capital },
      });
    }

    livingCounts[t + 1] = agents.filter((a) => a.alive).length;
  }

  // Compute seed metrics
  const founders = agents.filter((a) => a.generation === 0);
  const totalAgents = agents.length;
  const deadAgents = agents.filter((a) => !a.alive);
  const deadFounders = founders.filter((a) => !a.alive);

  const ruinProbability = totalAgents > 0 ? deadAgents.length / totalAgents : 0;
  const founderRuinProbability = founders.length > 0 ? deadFounders.length / founders.length : 0;
  const totalChildren = agents.filter((a) => a.generation > 0).length;
  const finalLiving = livingCounts[totalSteps];

  // Survival curve: fraction of founders alive at each step
  const founderSurvivalCurve = new Array(totalSteps + 1);
  for (let t = 0; t <= totalSteps; t++) {
    const aliveFoundersAtT = founders.filter(
      (f) => f.birthStep <= t && (f.deathStep === null || f.deathStep > t),
    ).length;
    founderSurvivalCurve[t] = founders.length > 0 ? aliveFoundersAtT / founders.length : 0;
  }

  // Population growth rate: (final / initial)^(1 / years) - 1
  const growthRate = Math.pow(finalLiving / config.population.founderCount, 1 / config.population.horizonYears) - 1;

  // Reproduction frequency: children born / (founderCount * years)
  const reproductionFrequency = totalChildren / (config.population.founderCount * config.population.horizonYears);

  return {
    seed,
    founderCount: config.population.founderCount,
    totalAgents,
    finalLiving,
    deadCount: deadAgents.length,
    childrenBorn: totalChildren,
    ruinProbability,
    founderRuinProbability,
    reproductionFrequency,
    populationGrowthRate: growthRate,
    livingCounts,
    founderSurvivalCurve,
    eventsCount: events.length,
  };
}

/**
 * Runs the full T4 test suite across 30 independent population seeds.
 */
export async function runT4(config: T4Config = T4_DEFAULT_CONFIG): Promise<T4Report> {
  const seedResults: SeedPopulationResult[] = [];

  for (let seed = 1; seed <= config.seedsCount; seed++) {
    const res = await runOnePopulationSeed(seed, config);
    seedResults.push(res);
  }

  const metrics = computeT4Metrics(seedResults);
  const passed = metrics.simulatorPassed;

  const reportPath = await writeReport(
    metrics,
    config,
    seedResults,
    'results/t4/report.md',
  );

  return {
    seedResults,
    metrics,
    passed,
    reportPath,
  };
}
