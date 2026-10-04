/**
 * T1 — No-edge null test runner.
 *
 * For each seed:
 *   1. Generate a positive-price martingale (no drift, no edge).
 *   2. Run the tabular Q-learning agent for N steps.
 *   3. The agent observes, classifies, chooses, executes, updates Q.
 *   4. Net return must be indistinguishable from zero after costs.
 *
 * Reference: GLOFICA_Langton_Autonomon.md §14 (T1).
 *
 * Acceptance criteria follow Paper §14:
 *   - noPositiveMaterialEdge: 95% CI upper bound < MATERIAL_EDGE_BOUND
 *   - fprWithinTolerance: false positive rate <= 5%
 */

import { generateMartingale } from './martingale-generator.js';
import { SyntheticAssetAdapter } from './synthetic-adapter.js';
import { QLearning, type RandomSource } from '../../src/rl/q-learning.js';
import { observeState, type MarketObservation } from '../../src/rl/state.js';
import { ACTION_IDS } from '../../src/rl/actions.js';
import { DEFAULT_GENOME } from '../../src/genome/types.js';
import { computeT1Metrics, type T1Metrics } from './metrics.js';
import { runSanityChecks, type SanityCheckResult } from './sanity-checks.js';
import { writeReport, type T1Config } from './report.js';

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

// ─── Config ──────────────────────────────────────────────────────────────

export interface T1Result {
  seed: number;
  initialCapital: number;
  finalNav: number;
  netLogReturn: number;
  annualizedReturn: number;
  turnover: number;
  tradeCount: number;
  steps: number;
}

export interface T1Report {
  results: T1Result[];
  metrics: T1Metrics;
  sanityChecks: { allPassed: boolean; checks: SanityCheckResult[] };
  passed: boolean;
  reportPath: string;
}

export const T1_DEFAULT_CONFIG: T1Config = {
  seedsCount: 30,
  stepsPerSeed: 10000,
  initialCapital: 10000,
  sigma: 0.30,
  dt: 5 / (60 * 24 * 365),
  feeBps: 10,
  slippageBps: 5,
};

const RSI_PERIOD = 14;
const RETURN_LOOKBACK = 14;
const R_MAX = 1.0;

// ─── Market feature helpers ──────────────────────────────────────────────

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

/**
 * Generate a forecast that is uncorrelated with the future price.
 * Deterministic per (seed, step), so the test is reproducible.
 */
function syntheticForecast(seed: number, step: number, price: number) {
  const mix = ((seed * 73856093) ^ (step * 19349663)) >>> 0;
  const prng = new SeededPRNG(mix);
  const drift = (prng.next() - 0.5) * 0.04;   // [-0.02, +0.02]
  const width = 0.01 + prng.next() * 0.06;     // [0.01, 0.07]
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

// ─── Single seed ─────────────────────────────────────────────────────────

export async function runOneSeed(seed: number): Promise<T1Result> {
  const { stepsPerSeed: n, initialCapital, sigma, dt } = T1_DEFAULT_CONFIG;

  const prices = generateMartingale({
    seed,
    p0: 100,
    sigma,
    dt,
    n,
  });

  const adapter = new SyntheticAssetAdapter({
    initialCash: initialCapital,
    currentPrice: prices[0],
  });

  const agentId = `t1-agent-${seed}`;
  const genome = DEFAULT_GENOME;

  const ql = new QLearning(
    ACTION_IDS,
    {
      alpha: genome.g_alpha,
      gamma: 0.95,
      epsilon: genome.g_epsilon,
      epsilonDecay: 0.995,
      epsilonMin: 0.05,
    },
    new SeededPRNG(seed * 7919),
  );

  // History of observed prices (capped).
  const history: number[] = [prices[0]];

  let prevNav = initialCapital;

  for (let t = 0; t < n; t++) {
    const price = prices[t];
    const previousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
    const agentState = await adapter.getState(agentId);

    const obs = buildObservation(
      price,
      previousPrice,
      history,
      agentState.exposureRatio,
      seed,
      t,
    );
    const stateKey = observeState(obs);

    // Epsilon-greedy action selection (uses seeded RNG).
    const action = ql.selectAction(stateKey);

    // Execute action against the synthetic adapter.
    await adapter.execute({
      type: action as any,
      agentId,
      instrumentId: 'WR-CU-001',
    });

    // Advance the market.
    const nextPrice = prices[t + 1];
    adapter.setPrice('WR-CU-001', nextPrice);
    history.push(nextPrice);
    if (history.length > 128) history.shift();

    // Reward = flow-adjusted log return of NAV (no external flows in T1).
    const nextAgentState = await adapter.getState(agentId);
    const newNav = nextAgentState.nav;
    const rawReward =
      newNav > 0 && prevNav > 0 ? Math.log(newNav / prevNav) : 0;
    const reward = Math.max(-R_MAX, Math.min(R_MAX, rawReward));

    // Next-state key for the bootstrap.
    const nextPreviousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
    const nextObs = buildObservation(
      nextPrice,
      nextPreviousPrice,
      history,
      nextAgentState.exposureRatio,
      seed,
      t + 1,
    );
    const nextStateKey = observeState(nextObs);

    ql.update(stateKey, action, reward, nextStateKey);

    prevNav = newNav;
  }

  const finalState = await adapter.getState(agentId);
  const finalNav = finalState.nav;
  const netLogReturn = Math.log(finalNav / initialCapital);
  const horizonYears = n * dt;
  const annualizedReturn = horizonYears > 0 ? netLogReturn / horizonYears : 0;

  return {
    seed,
    initialCapital,
    finalNav,
    netLogReturn,
    annualizedReturn,
    turnover: adapter.getTotalTurnover() / initialCapital,
    tradeCount: adapter.getTradeCount(),
    steps: n,
  };
}

// ─── Full test ───────────────────────────────────────────────────────────

export async function runT1(): Promise<T1Report> {
  const sanity = await runSanityChecks();
  if (!sanity.allPassed) {
    const failed = sanity.checks.filter((c) => !c.passed).map((c) => c.name).join(', ');
    throw new Error(`Sanity checks failed before main test: ${failed}`);
  }

  const results: T1Result[] = [];
  for (let seed = 1; seed <= T1_DEFAULT_CONFIG.seedsCount; seed++) {
    const r = await runOneSeed(seed);
    results.push(r);
  }

  const metrics = computeT1Metrics(results);

  // Acceptance criteria follow Paper §14.
  const passed = metrics.noPositiveMaterialEdge && metrics.fprWithinTolerance;

  const reportPath = await writeReport(
    metrics,
    T1_DEFAULT_CONFIG,
    results,
    'results/t1/report.md',
  );

  return {
    results,
    metrics,
    sanityChecks: sanity,
    passed,
    reportPath,
  };
}