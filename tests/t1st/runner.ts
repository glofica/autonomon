/**
 * T1st — Two-Phase Training and Evaluation with Active Safety Layer.
 *
 * Architecture:
 *   Phase 1 (Training):   5,000 steps with exploration (ε = 0.30 → 0.05), Safety Layer ACTIVE.
 *   Phase 2 (Evaluation): 5,000 steps with exploitation only (ε = 0), Safety Layer ACTIVE.
 *   Preservation:         Q-table preserved between phases via exportQTable / importQTable.
 *   Scope:                Measures evaluation phase performance (Phase 2).
 *
 * Reference: GLOFICA_Langton_Autonomon.md §4, §6, §6.2, §14.
 */

import { generateMartingale } from './martingale-generator.js';
import { SyntheticAssetAdapter } from './synthetic-adapter.js';
import { QLearning, type RandomSource } from '../../src/rl/q-learning.js';
import { observeState, type MarketObservation } from '../../src/rl/state.js';
import { ACTION_IDS, type ActionLabel } from '../../src/rl/actions.js';
import { DEFAULT_GENOME } from '../../src/genome/types.js';
import { SafetyLayer, computeAdmissibleActions, type ExecutionSnapshot } from '../../src/safety/safetyLayer.js';
import { computeT1stMetrics, type T1stMetrics, type T1stResult } from './metrics.js';
import { runSanityChecks, type SanityCheckResult } from './sanity-checks.js';
import { writeReport, type T1stConfig } from './report.js';

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────

class SeededPRNG implements RandomSource {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x12345678;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export interface T1stReport {
  results: T1stResult[];
  metrics: T1stMetrics;
  sanityChecks: { allPassed: boolean; checks: SanityCheckResult[] };
  passed: boolean;
  reportPath: string;
}

export const DEFAULT_T1ST_CONFIG: T1stConfig = {
  seedsCount: 30,
  trainSteps: 5000,
  evalSteps: 5000,
  trainEpsilon: 0.30,
  initialCapital: 10000,
  sigma: 0.30,
  dt: 5 / (60 * 24 * 365),
  feeBps: 10,
  slippageBps: 5,
  g_gas: DEFAULT_GENOME.g_gas,              // 250 XGO
  g_omega: DEFAULT_GENOME.g_omega,          // 0.20 (20% concentration cap)
  drawdownBreakerThreshold: 0.15,           // 15% trailing drawdown threshold (§6.2)
  breakerLockoutMs: 4 * 60 * 60 * 1000,    // 4 hours lockout (§6.2)
  initialGasBalance: 500,                  // Initial liquid XGO gas balance
  gasFeePerTx: 0.01,                       // Estimated gas fee per transaction in XGO
};

const RSI_PERIOD = 14;
const RETURN_LOOKBACK = 14;
const R_MAX = 1.0;

// ─── Observation Helpers ─────────────────────────────────────────────────

function computeReturns(prices: number[], lookback: number): number[] {
  const out: number[] = [];
  const start = Math.max(1, prices.length - lookback);
  for (let i = start; i < prices.length; i++) {
    out.push(Math.log(prices[i] / prices[i - 1]));
  }
  return out;
}

function computeRSI(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta > 0) gains += delta;
    else losses += -delta;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function syntheticForecast(seed: number, step: number, price: number) {
  const mix = ((seed * 73856093) ^ (step * 19349663)) >>> 0;
  const prng = new SeededPRNG(mix);
  const drift = (prng.next() - 0.5) * 0.04;
  const width = 0.01 + prng.next() * 0.06;
  const q50 = price * (1 + drift);
  const half = (q50 * width) / 2;
  return { q10: q50 - half, q50, q90: q50 + half };
}

function buildObservation(
  price: number,
  previousPrice: number | undefined,
  history: number[],
  agentExposure: number,
  seed: number,
  step: number,
): MarketObservation {
  const returns = computeReturns(history, RETURN_LOOKBACK);
  const rsi = computeRSI(history, RSI_PERIOD);
  const fc = syntheticForecast(seed, step, price);
  return {
    price,
    previousPrice,
    returns,
    rsi,
    q10: fc.q10,
    q50: fc.q50,
    q90: fc.q90,
    exposureRatio: agentExposure,
    runwayMonths: 12,
    diskUtilization: 0.20,
  };
}

// ─── Single Seed Two-Phase Runner ────────────────────────────────────────

export async function runOneSeedT1st(
  seed: number,
  config: T1stConfig = DEFAULT_T1ST_CONFIG,
): Promise<T1stResult> {
  const {
    trainSteps,
    evalSteps,
    trainEpsilon,
    initialCapital,
    sigma,
    dt,
    g_gas,
    g_omega,
    drawdownBreakerThreshold,
    breakerLockoutMs,
    initialGasBalance,
    gasFeePerTx,
  } = config;

  const totalSteps = trainSteps + evalSteps;
  const prices = generateMartingale({ seed, p0: 100, sigma, dt, n: totalSteps });
  const adapter = new SyntheticAssetAdapter({
    initialCash: initialCapital,
    currentPrice: prices[0],
  });

  const agentId = `t1st-agent-${seed}`;
  const genome = DEFAULT_GENOME;

  // Persistent SafetyLayer across both phases
  const safety = new SafetyLayer({
    drawdownBreakerThreshold,
    breakerLockoutMs,
  });

  // Phase 1: Q-Learning with active exploration
  const ql = new QLearning(
    ACTION_IDS,
    {
      alpha: genome.g_alpha,
      gamma: 0.95,
      epsilon: trainEpsilon,
      epsilonDecay: 0.995,
      epsilonMin: 0.05,
    },
    new SeededPRNG(seed * 7919),
  );

  const history: number[] = [prices[0]];
  let prevNav = initialCapital;
  let peakNavOverall = initialCapital;
  let peakAssetPrice = prices[0];
  let maxDrawdownOverall = 0;
  let breakerTripsTrain = 0;
  let breakerTripsEval = 0;
  let gasBalance = initialGasBalance;

  let now = 1700000000000;
  const stepMs = 5 * 60 * 1000;

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 1: Training (5,000 steps with exploration, safety active)
  // ═══════════════════════════════════════════════════════════════════════
  for (let t = 0; t < trainSteps; t++) {
    now += stepMs;
    const price = prices[t];
    const previousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
    const agentState = await adapter.getState(agentId);

    // Track overall peak & drawdown
    if (agentState.nav > peakNavOverall) peakNavOverall = agentState.nav;
    const navDrawdown = peakNavOverall > 0 ? (peakNavOverall - agentState.nav) / peakNavOverall : 0;
    if (navDrawdown > maxDrawdownOverall) maxDrawdownOverall = navDrawdown;

    // Track unitized asset drawdown per Paper §6.2
    if (price > peakAssetPrice) peakAssetPrice = price;
    const assetDrawdown = peakAssetPrice > 0 ? (peakAssetPrice - price) / peakAssetPrice : 0;
    const trailingDrawdownPct = Math.max(navDrawdown, assetDrawdown);

    const obs = buildObservation(price, previousPrice, history, agentState.exposureRatio, seed, t);
    const stateKey = observeState(obs);
    const candidateAction = ql.selectAction(stateKey);

    const snapshot: ExecutionSnapshot = {
      balanceGasXgo: gasBalance,
      navUsd: agentState.nav,
      instrumentExposuresUsd: { 'WR-CU-001': agentState.inventory * price },
      runwayMonths: 12,
      trailingDrawdownPct,
      oracleTimestampMs: now,
      currentTimestampMs: now,
      marketDepthUsd: 100000,
    };

    const admissibleActions = computeAdmissibleActions(agentState, snapshot, genome, safety);
    const evalResult = safety.evaluate(snapshot, genome, { action: candidateAction as ActionLabel });
    if (evalResult.isBreakerActive) {
      breakerTripsTrain++;
    }

    let executedAction: ActionLabel = admissibleActions.includes(candidateAction as ActionLabel)
      ? (candidateAction as ActionLabel)
      : 'HOLD';

    if (executedAction === 'ACQUIRE_SPOT') {
      const maxAllowedExposure = g_omega * agentState.nav;
      const currentExposure = agentState.inventory * price;
      const canSpendUsd = maxAllowedExposure - currentExposure;

      if (canSpendUsd > 10) {
        const units = canSpendUsd / price;
        await adapter.execute({
          type: 'ACQUIRE_SPOT',
          agentId,
          instrumentId: 'WR-CU-001',
          amount: units,
        });
        gasBalance = Math.max(0, gasBalance - gasFeePerTx);
      } else {
        executedAction = 'HOLD';
        await adapter.execute({ type: 'HOLD', agentId });
      }
    } else if (executedAction === 'DISPOSE_SPOT' || executedAction === 'REDUCE_INVENTORY') {
      if (agentState.inventory > 0) {
        await adapter.execute({
          type: executedAction,
          agentId,
          instrumentId: 'WR-CU-001',
        });
        gasBalance = Math.max(0, gasBalance - gasFeePerTx);
      } else {
        executedAction = 'HOLD';
        await adapter.execute({ type: 'HOLD', agentId });
      }
    } else {
      executedAction = 'HOLD';
      await adapter.execute({ type: 'HOLD', agentId });
    }

    const nextPrice = prices[t + 1];
    adapter.setPrice('WR-CU-001', nextPrice);
    history.push(nextPrice);
    if (history.length > 128) history.shift();

    const nextAgentState = await adapter.getState(agentId);
    const newNav = nextAgentState.nav;
    const rawReward = newNav > 0 && prevNav > 0 ? Math.log(newNav / prevNav) : 0;
    const reward = Math.max(-R_MAX, Math.min(R_MAX, rawReward));

    const nextPreviousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
    const nextObs = buildObservation(nextPrice, nextPreviousPrice, history, nextAgentState.exposureRatio, seed, t + 1);
    const nextStateKey = observeState(nextObs);

    ql.update(stateKey, executedAction, reward, nextStateKey);
    prevNav = newNav;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 1 -> Phase 2 Transition (Preserve Q-table, Reset counters)
  // ═══════════════════════════════════════════════════════════════════════
  const navAfterTraining = prevNav;
  const trainTradeCount = adapter.getTradeCount();
  const tradesAtStart = trainTradeCount;
  const turnoverAtStart = adapter.getTotalTurnover();

  // Fresh exploitation instance reusing the trained Q-table
  const qlEval = new QLearning(
    ACTION_IDS,
    {
      alpha: genome.g_alpha,
      gamma: 0.95,
      epsilon: 0, // Exploitation only (§4)
      epsilonDecay: 1.0,
      epsilonMin: 0,
    },
    new SeededPRNG(seed * 7919 + 1),
  );
  qlEval.importQTable(ql.exportQTable());

  let peakNavEval = navAfterTraining;
  let maxDrawdownEval = 0;

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 2: Evaluation (5,000 steps with ε = 0, safety active)
  // ═══════════════════════════════════════════════════════════════════════
  for (let t = trainSteps; t < totalSteps; t++) {
    now += stepMs;
    const price = prices[t];
    const previousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
    const agentState = await adapter.getState(agentId);

    // Track overall peak & drawdown
    if (agentState.nav > peakNavOverall) peakNavOverall = agentState.nav;
    const navDrawdownOverall = peakNavOverall > 0 ? (peakNavOverall - agentState.nav) / peakNavOverall : 0;
    if (navDrawdownOverall > maxDrawdownOverall) maxDrawdownOverall = navDrawdownOverall;

    // Track evaluation phase specific peak & drawdown
    if (agentState.nav > peakNavEval) peakNavEval = agentState.nav;
    const navDrawdownEval = peakNavEval > 0 ? (peakNavEval - agentState.nav) / peakNavEval : 0;
    if (navDrawdownEval > maxDrawdownEval) maxDrawdownEval = navDrawdownEval;

    // Unitized asset drawdown
    if (price > peakAssetPrice) peakAssetPrice = price;
    const assetDrawdown = peakAssetPrice > 0 ? (peakAssetPrice - price) / peakAssetPrice : 0;
    const trailingDrawdownPct = Math.max(navDrawdownOverall, assetDrawdown);

    const obs = buildObservation(price, previousPrice, history, agentState.exposureRatio, seed, t);
    const stateKey = observeState(obs);
    const candidateAction = qlEval.selectAction(stateKey);

    const snapshot: ExecutionSnapshot = {
      balanceGasXgo: gasBalance,
      navUsd: agentState.nav,
      instrumentExposuresUsd: { 'WR-CU-001': agentState.inventory * price },
      runwayMonths: 12,
      trailingDrawdownPct,
      oracleTimestampMs: now,
      currentTimestampMs: now,
      marketDepthUsd: 100000,
    };

    const admissibleActions = computeAdmissibleActions(agentState, snapshot, genome, safety);
    const evalResult = safety.evaluate(snapshot, genome, { action: candidateAction as ActionLabel });
    if (evalResult.isBreakerActive) {
      breakerTripsEval++;
    }

    let executedAction: ActionLabel = admissibleActions.includes(candidateAction as ActionLabel)
      ? (candidateAction as ActionLabel)
      : 'HOLD';

    if (executedAction === 'ACQUIRE_SPOT') {
      const maxAllowedExposure = g_omega * agentState.nav;
      const currentExposure = agentState.inventory * price;
      const canSpendUsd = maxAllowedExposure - currentExposure;

      if (canSpendUsd > 10) {
        const units = canSpendUsd / price;
        await adapter.execute({
          type: 'ACQUIRE_SPOT',
          agentId,
          instrumentId: 'WR-CU-001',
          amount: units,
        });
        gasBalance = Math.max(0, gasBalance - gasFeePerTx);
      } else {
        executedAction = 'HOLD';
        await adapter.execute({ type: 'HOLD', agentId });
      }
    } else if (executedAction === 'DISPOSE_SPOT' || executedAction === 'REDUCE_INVENTORY') {
      if (agentState.inventory > 0) {
        await adapter.execute({
          type: executedAction,
          agentId,
          instrumentId: 'WR-CU-001',
        });
        gasBalance = Math.max(0, gasBalance - gasFeePerTx);
      } else {
        executedAction = 'HOLD';
        await adapter.execute({ type: 'HOLD', agentId });
      }
    } else {
      executedAction = 'HOLD';
      await adapter.execute({ type: 'HOLD', agentId });
    }

    const nextPrice = prices[t + 1];
    adapter.setPrice('WR-CU-001', nextPrice);
    history.push(nextPrice);
    if (history.length > 128) history.shift();

    const nextAgentState = await adapter.getState(agentId);
    const newNav = nextAgentState.nav;
    const rawReward = newNav > 0 && prevNav > 0 ? Math.log(newNav / prevNav) : 0;
    const reward = Math.max(-R_MAX, Math.min(R_MAX, rawReward));

    const nextPreviousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
    const nextObs = buildObservation(nextPrice, nextPreviousPrice, history, nextAgentState.exposureRatio, seed, t + 1);
    const nextStateKey = observeState(nextObs);

    qlEval.update(stateKey, executedAction, reward, nextStateKey);
    prevNav = newNav;
  }

  const navAfterEvaluation = prevNav;
  const evalTradeCount = adapter.getTradeCount() - tradesAtStart;
  const evalTurnover = (adapter.getTotalTurnover() - turnoverAtStart) / navAfterTraining;
  const evalNetLogReturn = Math.log(navAfterEvaluation / navAfterTraining);
  const horizonYears = evalSteps * dt;
  const evalAnnualizedReturn = horizonYears > 0 ? evalNetLogReturn / horizonYears : 0;

  return {
    seed,
    initialCapital,
    navAfterTraining,
    navAfterEvaluation,
    evalNetLogReturn,
    evalAnnualizedReturn,
    evalTurnover,
    evalTradeCount,
    trainTradeCount,
    maxDrawdownOverall,
    maxDrawdownEval,
    breakerTripsTrain,
    breakerTripsEval,
    trainSteps,
    evalSteps,
  };
}

// ─── Full Test Runner ────────────────────────────────────────────────────

export async function runT1st(
  config: T1stConfig = DEFAULT_T1ST_CONFIG,
): Promise<T1stReport> {
  const sanity = await runSanityChecks();
  if (!sanity.allPassed) {
    const failed = sanity.checks.filter(c => !c.passed).map(c => c.name).join(', ');
    throw new Error(`Sanity checks failed before T1st test: ${failed}`);
  }

  const results: T1stResult[] = [];
  for (let seed = 1; seed <= config.seedsCount; seed++) {
    const r = await runOneSeedT1st(seed, config);
    results.push(r);
  }

  const metrics = computeT1stMetrics(results);

  const passed =
    metrics.maxDrawdownUnderThreshold &&
    metrics.tradesUnderThreshold &&
    metrics.annualizedReturnBounded;

  const reportPath = await writeReport(
    metrics,
    config,
    results,
    'results/t1st/report.md',
    'T1st — Two-Phase Training + Evaluation with Safety Layer',
  );

  return {
    results,
    metrics,
    sanityChecks: sanity,
    passed,
    reportPath,
  };
}
