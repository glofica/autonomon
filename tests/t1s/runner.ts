/**
 * T1s — Execution Safety Layer Null Test Runner.
 *
 * Implements the full Paper §6 execution safety layer constraints:
 *   1. Safety layer evaluation via computeAdmissibleActions(state, snapshot)
 *   2. Inadmissible actions fail-safe to HOLD (§4)
 *   3. 4-hour circuit breaker lockout triggered when trailing drawdown >= 15% (§6.2)
 *   4. Gas reserve floor invariant: B - L - C >= g_gas (§6)
 *   5. Concentration cap: E_i / V <= g_omega (§6)
 *   6. Evaluates across 30 independent seeds under the standard martingale process
 *
 * Reference: GLOFICA_Langton_Autonomon.md §4, §6, §6.1, §6.2, §7, §14.
 */

import { generateMartingale } from './martingale-generator.js';
import { SyntheticAssetAdapter } from './synthetic-adapter.js';
import { QLearning, type RandomSource } from '../../src/rl/q-learning.js';
import { observeState, type MarketObservation } from '../../src/rl/state.js';
import { ACTION_IDS, type ActionLabel } from '../../src/rl/actions.js';
import { DEFAULT_GENOME } from '../../src/genome/types.js';
import { SafetyLayer, computeAdmissibleActions, type ExecutionSnapshot } from '../../src/safety/safetyLayer.js';
import { computeT1sMetrics, type T1sMetrics, type SeedResult } from './metrics.js';
import { runSanityChecks, type SanityCheckResult } from './sanity-checks.js';
import { writeReport, type T1sConfig } from './report.js';

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

export interface T1sReport {
  results: SeedResult[];
  metrics: T1sMetrics;
  sanityChecks: { allPassed: boolean; checks: SanityCheckResult[] };
  passed: boolean;
  reportPath: string;
}

export const DEFAULT_T1S_CONFIG: T1sConfig = {
  seedsCount: 30,
  stepsPerSeed: 10000,
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

// ─── Single Seed Runner ──────────────────────────────────────────────────

export async function runOneSeed(
  seed: number,
  config: T1sConfig = DEFAULT_T1S_CONFIG,
): Promise<SeedResult> {
  const {
    stepsPerSeed: n,
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

  const prices = generateMartingale({ seed, p0: 100, sigma, dt, n });
  const adapter = new SyntheticAssetAdapter({
    initialCash: initialCapital,
    currentPrice: prices[0],
  });

  const agentId = `t1s-agent-${seed}`;
  const genome = DEFAULT_GENOME;

  // Dedicated SafetyLayer instance per seed to maintain breaker state
  const safety = new SafetyLayer({
    drawdownBreakerThreshold,
    breakerLockoutMs,
  });

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

  const history: number[] = [prices[0]];
  let prevNav = initialCapital;
  let peakNav = initialCapital;
  let peakAssetPrice = prices[0];
  let maxDrawdown = 0;
  let breakerTrips = 0;
  let gasBalance = initialGasBalance;

  let now = 1700000000000;
  const stepMs = 5 * 60 * 1000; // 5 minutes in ms

  for (let t = 0; t < n; t++) {
    now += stepMs;
    const price = prices[t];
    const previousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
    const agentState = await adapter.getState(agentId);

    // Track portfolio NAV peak & drawdown
    if (agentState.nav > peakNav) peakNav = agentState.nav;
    const navDrawdown = peakNav > 0 ? (peakNav - agentState.nav) / peakNav : 0;
    if (navDrawdown > maxDrawdown) maxDrawdown = navDrawdown;

    // Track unitized asset index peak & drawdown per Paper §6.2
    if (price > peakAssetPrice) peakAssetPrice = price;
    const assetDrawdown = peakAssetPrice > 0 ? (peakAssetPrice - price) / peakAssetPrice : 0;

    // Paper §6.2: trailing drawdown combines NAV drawdown and unitized trading asset drawdown
    const trailingDrawdownPct = Math.max(navDrawdown, assetDrawdown);

    // 1. Build observation & select raw candidate action via Q-learning
    const obs = buildObservation(
      price,
      previousPrice,
      history,
      agentState.exposureRatio,
      seed,
      t,
    );
    const stateKey = observeState(obs);
    const candidateAction = ql.selectAction(stateKey);

    // 2. Build full execution snapshot for Safety Layer (§6)
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

    // 3. Consult Safety Layer admissible actions A_safe(z_t)
    const admissibleActions = computeAdmissibleActions(
      agentState,
      snapshot,
      genome,
      safety,
    );

    // Track circuit breaker active state
    const evalResult = safety.evaluate(snapshot, genome, { action: candidateAction as ActionLabel });
    if (evalResult.isBreakerActive) {
      breakerTrips++;
    }

    // 4. If proposed candidate action is inadmissible, force HOLD fail-safe
    let executedAction: ActionLabel = admissibleActions.includes(candidateAction as ActionLabel)
      ? (candidateAction as ActionLabel)
      : 'HOLD';

    // 5. Execute action with strict concentration bounds (§6)
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

    // Advance market
    const nextPrice = prices[t + 1];
    adapter.setPrice('WR-CU-001', nextPrice);
    history.push(nextPrice);
    if (history.length > 128) history.shift();

    // Reward computation
    const nextAgentState = await adapter.getState(agentId);
    const newNav = nextAgentState.nav;
    const rawReward = newNav > 0 && prevNav > 0 ? Math.log(newNav / prevNav) : 0;
    const reward = Math.max(-R_MAX, Math.min(R_MAX, rawReward));

    // Next-state bootstrap
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

    ql.update(stateKey, executedAction, reward, nextStateKey);
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
    maxDrawdown,
    breakerTrips,
    steps: n,
  };
}

// ─── Full Test Runner ────────────────────────────────────────────────────

export async function runT1s(
  config: T1sConfig = DEFAULT_T1S_CONFIG,
): Promise<T1sReport> {
  const sanity = await runSanityChecks();
  if (!sanity.allPassed) {
    const failed = sanity.checks.filter(c => !c.passed).map(c => c.name).join(', ');
    throw new Error(`Sanity checks failed before T1s test: ${failed}`);
  }

  const results: SeedResult[] = [];
  for (let seed = 1; seed <= config.seedsCount; seed++) {
    const r = await runOneSeed(seed, config);
    results.push(r);
  }

  const metrics = computeT1sMetrics(results);

  const passed =
    metrics.maxDrawdownUnderThreshold &&
    metrics.breakerTrippedAtLeastOnce &&
    metrics.annualizedReturnBounded;

  const reportPath = await writeReport(
    metrics,
    config,
    results,
    'results/t1s/report.md',
    'T1s — Execution Safety Layer Active',
  );

  return {
    results,
    metrics,
    sanityChecks: sanity,
    passed,
    reportPath,
  };
}
