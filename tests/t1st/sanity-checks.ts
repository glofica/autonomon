import { generateMartingale } from './martingale-generator.js';
import { SyntheticAssetAdapter } from './synthetic-adapter.js';
import { SafetyLayer, computeAdmissibleActions, type ExecutionSnapshot } from '../../src/safety/safetyLayer.js';
import { DEFAULT_GENOME } from '../../src/genome/types.js';

export interface SanityCheckResult {
  name: string;
  passed: boolean;
  message: string;
  value?: number;
  expected?: string;
  details?: Record<string, any>;
}

/**
 * 1. Generator check: draw 10,000 series x 100 steps.
 * Mean of P_{t+1}/P_t - 1 must be statistically indistinguishable from 0.
 */
export function checkGenerator(): SanityCheckResult {
  const numSeries = 10000;
  const steps = 100;
  const sigma = 0.30;
  const dt = 5 / (60 * 24 * 365);

  let sumReturns = 0;
  let sumSqReturns = 0;
  const totalSteps = numSeries * steps;

  for (let s = 1; s <= numSeries; s++) {
    const prices = generateMartingale({
      seed: s,
      p0: 100,
      sigma,
      dt,
      n: steps,
    });

    for (let t = 0; t < steps; t++) {
      const ret = prices[t + 1] / prices[t] - 1;
      sumReturns += ret;
      sumSqReturns += ret * ret;
    }
  }

  const mean = sumReturns / totalSteps;
  const variance = (sumSqReturns - totalSteps * mean * mean) / (totalSteps - 1);
  const se = Math.sqrt(variance / totalSteps);
  const tStat = mean / se;

  const passed = Math.abs(tStat) < 2.576;

  return {
    name: 'Generator Check',
    passed,
    value: mean,
    expected: 'Statistically indistinguishable from 0 (|t| < 2.576)',
    message: passed
      ? `Passed: Mean step return is ${mean.toExponential(4)} (t-stat = ${tStat.toFixed(3)}, |t| < 2.576)`
      : `Failed: Mean step return is ${mean.toExponential(4)} (t-stat = ${tStat.toFixed(3)})`,
    details: { totalSteps, mean, variance, se, tStat },
  };
}

/**
 * 2. HOLD check: force HOLD for all steps. Net return must be exactly 0.
 */
export async function checkHold(steps: number = 10000): Promise<SanityCheckResult> {
  const initialCapital = 10000;
  const sigma = 0.30;
  const dt = 5 / (60 * 24 * 365);
  const prices = generateMartingale({
    seed: 42,
    p0: 100,
    sigma,
    dt,
    n: steps,
  });

  const adapter = new SyntheticAssetAdapter({
    initialCash: initialCapital,
    currentPrice: prices[0],
  });

  for (let t = 0; t < steps; t++) {
    await adapter.execute({ type: 'HOLD', agentId: 'sanity-hold' });
    adapter.setPrice('WR-CU-001', prices[t + 1]);
  }

  const state = await adapter.getState('sanity-hold');
  const netReturn = state.nav - initialCapital;
  const passed = Math.abs(netReturn) < 1e-9;

  return {
    name: 'HOLD Check',
    passed,
    value: netReturn,
    expected: 'Exactly 0.0',
    message: passed
      ? `Passed: Net return is exactly 0 ($${netReturn.toFixed(4)}) when holding for ${steps} steps`
      : `Failed: Net return is ${netReturn.toFixed(4)} (expected 0)`,
    details: { initialCapital, finalNav: state.nav, netReturn, steps },
  };
}

/**
 * 3. Round-trip check: force ACQUIRE then DISPOSE with no price movement.
 * NAV must decrease by ~30 bps.
 */
export async function checkRoundTrip(): Promise<SanityCheckResult> {
  const initialCapital = 10000;
  const price = 100;

  const adapter = new SyntheticAssetAdapter({
    initialCash: initialCapital,
    currentPrice: price,
  });

  await adapter.execute({ type: 'ACQUIRE_SPOT', agentId: 'sanity-roundtrip' });
  await adapter.execute({ type: 'DISPOSE_SPOT', agentId: 'sanity-roundtrip' });

  const state = await adapter.getState('sanity-roundtrip');
  const decrease = initialCapital - state.nav;
  const decreaseBps = (decrease / initialCapital) * 10000;

  const passed = Math.abs(decreaseBps - 30) < 1.0;

  return {
    name: 'Round-Trip Check',
    passed,
    value: decreaseBps,
    expected: '~30 bps decrease',
    message: passed
      ? `Passed: NAV decreased by ${decreaseBps.toFixed(2)} bps (~30 bps expected) with zero price movement`
      : `Failed: NAV decreased by ${decreaseBps.toFixed(2)} bps (expected ~30 bps)`,
    details: { initialCapital, finalNav: state.nav, decreaseUsd: decrease, decreaseBps },
  };
}

/**
 * 4. Circuit Breaker Check: trailing drawdown >= 15% triggers 4h lockout and removes risk-increasing actions.
 */
export function checkBreakerLockout(): SanityCheckResult {
  const safety = new SafetyLayer({ drawdownBreakerThreshold: 0.15, breakerLockoutMs: 4 * 3600 * 1000 });
  const now = 1700000000000;

  const snapshot: ExecutionSnapshot = {
    balanceGasXgo: 500,
    navUsd: 10000,
    runwayMonths: 12,
    trailingDrawdownPct: 0.16, // 16% >= 15%
    oracleTimestampMs: now,
    currentTimestampMs: now,
  };

  const admissible = computeAdmissibleActions({ balance: 10000, inventory: 0, nav: 10000, exposureRatio: 0 }, snapshot, DEFAULT_GENOME, safety);

  const acquiresBlocked = !admissible.includes('ACQUIRE_SPOT');
  const liquidityBlocked = !admissible.includes('PROVIDE_LIQUIDITY');
  const holdAllowed = admissible.includes('HOLD');
  const passed = acquiresBlocked && liquidityBlocked && holdAllowed;

  return {
    name: 'Circuit Breaker Lockout Check',
    passed,
    expected: 'ACQUIRE_SPOT & PROVIDE_LIQUIDITY blocked, HOLD admitted',
    message: passed
      ? 'Passed: Drawdown >= 15% successfully triggered 4h lockout and removed risk-increasing actions'
      : 'Failed: Risk-increasing actions were admitted during active breaker lockout',
    details: { admissible, trailingDrawdownPct: snapshot.trailingDrawdownPct },
  };
}

/**
 * 5. Concentration Cap Check: exposure ratio >= g_omega blocks further ACQUIRE_SPOT.
 */
export function checkConcentrationCap(): SanityCheckResult {
  const safety = new SafetyLayer();
  const now = 1700000000000;

  const snapshot: ExecutionSnapshot = {
    balanceGasXgo: 500,
    navUsd: 10000,
    instrumentExposuresUsd: { 'WR-CU-001': 2000 },
    runwayMonths: 12,
    trailingDrawdownPct: 0.02,
    oracleTimestampMs: now,
    currentTimestampMs: now,
  };

  const admissible = computeAdmissibleActions({ balance: 8000, inventory: 20, nav: 10000, exposureRatio: 0.20 }, snapshot, DEFAULT_GENOME, safety);

  const acquiresBlocked = !admissible.includes('ACQUIRE_SPOT');
  const holdAllowed = admissible.includes('HOLD');
  const disposeAllowed = admissible.includes('DISPOSE_SPOT');
  const passed = acquiresBlocked && holdAllowed && disposeAllowed;

  return {
    name: 'Concentration Cap Check',
    passed,
    expected: 'ACQUIRE_SPOT blocked at g_omega (20%), de-risking actions allowed',
    message: passed
      ? 'Passed: Concentration at g_omega blocked further acquisitions while preserving de-risking'
      : 'Failed: ACQUIRE_SPOT was admitted despite exposure ratio >= g_omega',
    details: { admissible, exposureRatio: 0.20, g_omega: DEFAULT_GENOME.g_omega },
  };
}

/**
 * 6. Gas Reserve Floor Check: B - L - C < g_gas blocks risk-increasing actions.
 */
export function checkGasReserveFloor(): SanityCheckResult {
  const safety = new SafetyLayer();
  const now = 1700000000000;

  const snapshot: ExecutionSnapshot = {
    balanceGasXgo: 240,
    navUsd: 10000,
    runwayMonths: 12,
    trailingDrawdownPct: 0.02,
    oracleTimestampMs: now,
    currentTimestampMs: now,
  };

  const admissible = computeAdmissibleActions({ balance: 10000, inventory: 0, nav: 10000, exposureRatio: 0 }, snapshot, DEFAULT_GENOME, safety);

  const acquiresBlocked = !admissible.includes('ACQUIRE_SPOT');
  const holdAllowed = admissible.includes('HOLD');
  const passed = acquiresBlocked && holdAllowed;

  return {
    name: 'Gas Reserve Floor Check',
    passed,
    expected: 'ACQUIRE_SPOT blocked when B < g_gas',
    message: passed
      ? 'Passed: Gas reserve floor (B - L - C >= g_gas) successfully blocked risk-increasing actions'
      : 'Failed: ACQUIRE_SPOT was admitted with gas balance below g_gas',
    details: { admissible, balanceGasXgo: 240, g_gas: DEFAULT_GENOME.g_gas },
  };
}

export async function runSanityChecks(): Promise<{
  allPassed: boolean;
  checks: SanityCheckResult[];
}> {
  const generator = checkGenerator();
  const hold = await checkHold();
  const roundTrip = await checkRoundTrip();
  const breaker = checkBreakerLockout();
  const concentration = checkConcentrationCap();
  const gas = checkGasReserveFloor();

  const checks = [generator, hold, roundTrip, breaker, concentration, gas];
  const allPassed = checks.every(c => c.passed);

  return { allPassed, checks };
}
