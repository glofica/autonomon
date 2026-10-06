/**
 * T4 — Economic Population: Simulation Runner (Two-Regime Persistent Market)
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §7, §12, §14 (T2, T3, T4).
 *
 * Scenarios:
 *   - Scenario A: Symmetric Regimes (+0.08 BULL / -0.08 BEAR)
 *   - Scenario B: Bear Dominant (+0.04 BULL / -0.14 BEAR)
 *   - Scenario C: Bull Dominant (+0.14 BULL / -0.04 BEAR)
 */

import {
  type AgentRecord,
  type PopulationConfig,
  T4_STRESS_POPULATION_CONFIG,
  T4_PRODUCT_POPULATION_CONFIG,
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
  type MarketRegime,
  T4_SHOCK_SCENARIO_A,
  T4_SHOCK_SCENARIO_B,
  T4_SHOCK_SCENARIO_C,
  generateStepShocks,
  sampleNextRegime,
} from './shocks.js';
import { SeededPRNG } from '../t2/runner.js';
import { computeT4Metrics, type T4Metrics, type SeedPopulationResult } from './metrics.js';
import { writeDualSetupReport } from './report.js';
import {
  evaluateReproductionGate,
  DEFAULT_REPRODUCTION_GATE_CONFIG,
} from './reproduction-gate.js';

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

// Stress Setup ($800 capital, $40/month, 24 months)
export const T4_STRESS_CONFIG_A: T4Config = {
  population: T4_STRESS_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_A,
  seedsCount: 30,
};

export const T4_STRESS_CONFIG_B: T4Config = {
  population: T4_STRESS_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_B,
  seedsCount: 30,
};

export const T4_STRESS_CONFIG_C: T4Config = {
  population: T4_STRESS_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_C,
  seedsCount: 30,
};

// Product Setup ($5,000 capital, $40/month, 24 months)
export const T4_PRODUCT_CONFIG_A: T4Config = {
  population: T4_PRODUCT_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_A,
  seedsCount: 30,
};

export const T4_PRODUCT_CONFIG_B: T4Config = {
  population: T4_PRODUCT_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_B,
  seedsCount: 30,
};

export const T4_PRODUCT_CONFIG_C: T4Config = {
  population: T4_PRODUCT_POPULATION_CONFIG,
  costs: T4_DEFAULT_COST_CONFIG,
  shocks: T4_SHOCK_SCENARIO_C,
  seedsCount: 30,
};

// Aliases for backwards compatibility
export const T4_CONFIG_SCENARIO_A = T4_STRESS_CONFIG_A;
export const T4_CONFIG_SCENARIO_B = T4_STRESS_CONFIG_B;
export const T4_CONFIG_SCENARIO_C = T4_STRESS_CONFIG_C;
export const T4_DEFAULT_CONFIG = T4_STRESS_CONFIG_A;

export interface T4ScenarioResult {
  scenarioName: string;
  config: T4Config;
  seedResults: SeedPopulationResult[];
  metrics: T4Metrics;
}

export interface T4SetupResult {
  setupName: string;
  scenarioA: T4ScenarioResult;
  scenarioB: T4ScenarioResult;
  scenarioC: T4ScenarioResult;
}

export interface T4DualSetupReport {
  stressSetup: T4SetupResult;
  productSetup: T4SetupResult;
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

  let currentRegime: MarketRegime = rng.next() >= 0.5 ? 'BULL' : 'BEAR';
  let firstDeathStep: number | null = null;
  let minCapitalAcrossRun = Infinity;

  for (let t = 0; t < totalSteps; t++) {
    const livingAgents = agents.filter((a) => a.alive);
    if (livingAgents.length === 0) {
      for (let rest = t; rest < totalSteps; rest++) {
        livingCounts[rest + 1] = 0;
      }
      break;
    }

    const livingIds = livingAgents.map((a) => a.id);

    // 1. Each agent acts based on currently observed market regime and its inventory state
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
      const stateKey = `${currentRegime}_${agent.inventoryState}`;
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

    // 2. Realize asset returns under current regime
    const shockResult = generateStepShocks(livingIds, dt, currentRegime, rng, config.shocks);

    // 3. Evolve regime for the next period according to persistence kernel
    const nextRegime = sampleNextRegime(currentRegime, config.shocks.regimePersistence, rng);

    // 4. Resolve PnL, deduct operating costs, and update Q-learning
    for (const d of decisions) {
      const { agent, prevCapital, stateKey, action, nextInv, tradeFee } = d;

      const assetRet = shockResult.agentReturns[agent.id] ?? shockResult.marketReturn;
      const exposure = getExposure(nextInv);
      const tradingPnl = exposure * assetRet * agent.capital - tradeFee;
      agent.capital += tradingPnl;
      agent.inventoryState = nextInv;

      // Deduct operating costs ($40/mo proportional to dt)
      const costResult = deductOperatingCosts(agent, dt, t, config.costs);

      // Track daily net return
      const dailyReturn = prevCapital > 0 ? (agent.capital - prevCapital) / prevCapital : 0;
      agent.dailyReturns.push(dailyReturn);

      if (agent.capital < minCapitalAcrossRun) {
        minCapitalAcrossRun = agent.capital;
      }

      if (!costResult.survived) {
        if (firstDeathStep === null && agent.generation === 0) {
          firstDeathStep = t;
        }
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

        // Q-learning update: nextStateKey uses nextRegime and nextInv
        const nextStateKey = `${nextRegime}_${agent.inventoryState}`;
        const rawReward = prevCapital > 0 && agent.capital > 0
          ? Math.log(agent.capital / prevCapital)
          : 0;
        const reward = Math.max(-1.0, Math.min(1.0, rawReward));
        agent.ql.update(stateKey, action, reward, nextStateKey);
      }
    }

    currentRegime = nextRegime;

    // 5. Reproduction check: Phase 2 Statistical Gate (§7.1, §7.3)
    // Monthly evaluation frequency with capital pre-filter >= 1.5x initialCapital,
    // calendar age >= 365 days, and cooldown >= 180 days.
    if (t > 0 && t % 30 === 0) {
      const multiplier = config.population.reproductionThresholdMultiplier ?? 1.5;
      const candidates = agents.filter(
        (a) =>
          a.alive &&
          (t - a.birthStep) >= DEFAULT_REPRODUCTION_GATE_CONFIG.minCalendarDays &&
          a.capital >= multiplier * a.initialCapital &&
          (a.lastReproductionStep === null || (t - a.lastReproductionStep) >= DEFAULT_REPRODUCTION_GATE_CONFIG.cooldownDays),
      );

      if (candidates.length > 0) {
        const livingCurrent = agents.filter((a) => a.alive);
        for (const parent of candidates) {
          if (!parent.alive || parent.capital < multiplier * parent.initialCapital) continue;

          const gateDecision = evaluateReproductionGate(
            parent,
            t,
            livingCurrent,
            DEFAULT_REPRODUCTION_GATE_CONFIG,
            seed * 10000 + t,
          );

          if (gateDecision.admitted) {
            const childId = `agent-${nextAgentId++}`;
            const { child, transferAmount } = reproduceAgent(parent, childId, t);
            agents.push(child);

            events.push({
              step: t,
              type: 'REPRODUCTION',
              agentId: parent.id,
              details: {
                childId,
                transferAmount,
                parentCapitalAfter: parent.capital,
                dsr: gateDecision.dsr,
                bootstrapLowerBound: gateDecision.bootstrapLowerBound,
                meanExcessReturn: gateDecision.moments.mean,
                sharpeAnnualized: gateDecision.moments.sharpeAnnualized,
              },
            });
            events.push({
              step: t,
              type: 'BIRTH',
              agentId: child.id,
              details: { parentId: parent.id, generation: child.generation, capital: child.capital },
            });
          }
        }
      }
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
    minCapital: minCapitalAcrossRun === Infinity ? 0 : minCapitalAcrossRun,
    firstDeathMonth: firstDeathStep !== null ? Math.round(((firstDeathStep / 365) * 12) * 10) / 10 : null,
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
 * Runs the full T4 test suite across both Stress Setup ($800) and Product Setup ($5,000)
 * over all 3 market scenarios (A, B, C) with 30 seeds each (180 total population runs).
 */
export async function runT4(): Promise<T4DualSetupReport> {
  const stressA = await runScenario('Scenario A (Symmetric)', T4_STRESS_CONFIG_A);
  const stressB = await runScenario('Scenario B (Bear Dominant)', T4_STRESS_CONFIG_B);
  const stressC = await runScenario('Scenario C (Bull Dominant)', T4_STRESS_CONFIG_C);
  const stressSetup: T4SetupResult = {
    setupName: 'Stress Setup ($800 capital, $40/month)',
    scenarioA: stressA,
    scenarioB: stressB,
    scenarioC: stressC,
  };

  const prodA = await runScenario('Scenario A (Symmetric)', T4_PRODUCT_CONFIG_A);
  const prodB = await runScenario('Scenario B (Bear Dominant)', T4_PRODUCT_CONFIG_B);
  const prodC = await runScenario('Scenario C (Bull Dominant)', T4_PRODUCT_CONFIG_C);
  const productSetup: T4SetupResult = {
    setupName: 'Product Setup ($5,000 capital, $40/month)',
    scenarioA: prodA,
    scenarioB: prodB,
    scenarioC: prodC,
  };

  const passed =
    stressA.metrics.simulatorPassed &&
    stressB.metrics.simulatorPassed &&
    stressC.metrics.simulatorPassed &&
    prodA.metrics.simulatorPassed &&
    prodB.metrics.simulatorPassed &&
    prodC.metrics.simulatorPassed;

  const reportPath = await writeDualSetupReport(
    stressSetup,
    productSetup,
    'results/t4/report.md',
  );

  return {
    stressSetup,
    productSetup,
    passed,
    reportPath,
  };
}
