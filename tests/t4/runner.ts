/**
 * T4 — Economic Population: Simulation Runner (Phase 1 Skeleton - Three Scenarios)
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §7, §12, §14 (T4).
 *
 * Scenarios:
 *   - Scenario A: Pure Martingale (drift = 0%)
 *   - Scenario B: Negative Drift (-2%/month bear market)
 *   - Scenario C: Positive Drift (+1%/month bull market)
 */

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
  T4_SHOCK_SCENARIO_A,
  T4_SHOCK_SCENARIO_B,
  T4_SHOCK_SCENARIO_C,
  generateStepShocks,
} from './shocks.js';
import { SeededPRNG } from '../t2/runner.js';
import { computeT4Metrics, type T4Metrics, type SeedPopulationResult } from './metrics.js';
import { writeTriScenarioReport } from './report.js';

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

export const T4_CONFIG_SCENARIO_A: T4Config = {
  population: T4_DEFAULT_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_A,
  seedsCount: 30,
};

export const T4_CONFIG_SCENARIO_B: T4Config = {
  population: T4_DEFAULT_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_B,
  seedsCount: 30,
};

export const T4_CONFIG_SCENARIO_C: T4Config = {
  population: T4_DEFAULT_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_C,
  seedsCount: 30,
};

export const T4_DEFAULT_CONFIG: T4Config = T4_CONFIG_SCENARIO_A;

export interface T4ScenarioResult {
  scenarioName: string;
  config: T4Config;
  seedResults: SeedPopulationResult[];
  metrics: T4Metrics;
}

export interface T4TriReport {
  scenarioA: T4ScenarioResult;
  scenarioB: T4ScenarioResult;
  scenarioC: T4ScenarioResult;
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
  if (action === 'REDUCE_INVENTORY') {
    if (currInv === 'HEAVY') return 'LIGHT';
    return 'FLAT';
  }
  if (action === 'PROVIDE_LIQUIDITY') {
    return 'LIGHT';
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
  config: T4Config = T4_CONFIG_SCENARIO_A,
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

  let observedMarketSignal: 'BULL' | 'BEAR' = 'BULL';

  for (let t = 0; t < totalSteps; t++) {
    const livingAgents = agents.filter((a) => a.alive);
    if (livingAgents.length === 0) {
      for (let rest = t; rest < totalSteps; rest++) {
        livingCounts[rest + 1] = 0;
      }
      break;
    }

    const livingIds = livingAgents.map((a) => a.id);

    // 1. Each agent acts based on currently observed market signal and its inventory
    const decisions: Array<{
      agent: AgentRecord;
      prevCapital: number;
      stateKey: string;
      action: string;
      nextInv: 'FLAT' | 'LIGHT' | 'HEAVY';
      tradeFee: number;
    }> = [];

    for (const agent of livingAgents) {
      const prevCapital = agent.capital;
      const stateKey = `${observedMarketSignal}_${agent.inventoryState}`;
      const action = agent.ql.selectAction(stateKey);
      const nextInv = getNextInventory(agent.inventoryState, action);
      const isTrade = action === 'ACQUIRE_SPOT' || action === 'DISPOSE_SPOT' || action === 'REDUCE_INVENTORY';
      const tradeFee = isTrade ? agent.capital * (config.costs.tradeFeeBps / 10000) : 0.0;
      if (isTrade) agent.tradesCount++;

      decisions.push({
        agent,
        prevCapital,
        stateKey,
        action,
        nextInv,
        tradeFee,
      });
    }

    // 2. Realize correlated asset price shocks for step t
    const shockResult = generateStepShocks(livingIds, dt, rng, config.shocks);
    const realizedMarketSignal: 'BULL' | 'BEAR' = shockResult.marketReturn >= 0 ? 'BULL' : 'BEAR';

    // 3. Resolve execution, PnL, operating costs, and Q-learning updates
    for (const d of decisions) {
      const { agent, prevCapital, stateKey, action, nextInv, tradeFee } = d;

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
        const nextStateKey = `${realizedMarketSignal}_${agent.inventoryState}`;
        const rawReward = prevCapital > 0 && agent.capital > 0
          ? Math.log(agent.capital / prevCapital)
          : 0;
        const reward = Math.max(-1.0, Math.min(1.0, rawReward));
        agent.ql.update(stateKey, action, reward, nextStateKey);
      }
    }

    observedMarketSignal = realizedMarketSignal;

    // 4. Reproduction check: capital >= 1.5 * initialCapital ($3,000 for founders)
    const multiplier = config.population.reproductionThresholdMultiplier ?? 1.5;
    const candidates = agents.filter((a) => a.alive && a.capital >= multiplier * a.initialCapital);
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
  const growthRate = finalLiving > 0
    ? Math.pow(finalLiving / config.population.founderCount, 1 / config.population.horizonYears) - 1
    : -1.0;

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
    maxCapital: Math.max(...agents.map((a) => a.peakCapital)),
    livingCounts,
    founderSurvivalCurve,
    eventsCount: events.length,
  };
}

/**
 * Runs a population scenario across 30 seeds.
 */
export async function runScenario(
  scenarioName: string,
  config: T4Config,
): Promise<T4ScenarioResult> {
  const seedResults: SeedPopulationResult[] = [];

  for (let seed = 1; seed <= config.seedsCount; seed++) {
    const res = await runOnePopulationSeed(seed, config);
    seedResults.push(res);
  }

  const metrics = computeT4Metrics(seedResults);
  return {
    scenarioName,
    config,
    seedResults,
    metrics,
  };
}

/**
 * Runs the full T4 test suite across Scenario A, Scenario B, and Scenario C.
 */
export async function runT4(): Promise<T4TriReport> {
  const scenarioA = await runScenario('Scenario A (Martingale, drift = 0%)', T4_CONFIG_SCENARIO_A);
  const scenarioB = await runScenario('Scenario B (Negative Drift, -2%/month)', T4_CONFIG_SCENARIO_B);
  const scenarioC = await runScenario('Scenario C (Positive Drift, +1%/month)', T4_CONFIG_SCENARIO_C);

  const passed = scenarioA.metrics.simulatorPassed && scenarioB.metrics.simulatorPassed && scenarioC.metrics.simulatorPassed;

  const reportPath = await writeTriScenarioReport(
    scenarioA,
    scenarioB,
    scenarioC,
    'results/t4/report.md',
  );

  return {
    scenarioA,
    scenarioB,
    scenarioC,
    passed,
    reportPath,
  };
}
