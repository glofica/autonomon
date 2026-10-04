import { generateMartingale } from './martingale-generator.js';
import { SyntheticAssetAdapter } from './synthetic-adapter.js';

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

  // Statistically indistinguishable from 0 at alpha = 0.01 (|t| < 2.576)
  const passed = Math.abs(tStat) < 2.576;

  return {
    name: 'Generator Check',
    passed,
    value: mean,
    expected: 'Statistically indistinguishable from 0 (|t| < 2.576)',
    message: passed
      ? `Passed: Mean step return is ${mean.toExponential(4)} (t-stat = ${tStat.toFixed(3)}, |t| < 2.576)`
      : `Failed: Mean step return is ${mean.toExponential(4)} (t-stat = ${tStat.toFixed(3)})`,
    details: {
      totalSteps,
      mean,
      variance,
      se,
      tStat,
    },
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
    details: {
      initialCapital,
      finalNav: state.nav,
      netReturn,
      steps,
    },
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

  // Step 1: Force ACQUIRE (10 bps fee + 5 bps slippage = 15 bps drag)
  await adapter.execute({ type: 'ACQUIRE_SPOT', agentId: 'sanity-roundtrip' });

  // Step 2: Force DISPOSE at identical price (10 bps fee + 5 bps slippage = 15 bps drag)
  await adapter.execute({ type: 'DISPOSE_SPOT', agentId: 'sanity-roundtrip' });

  const state = await adapter.getState('sanity-roundtrip');
  const decrease = initialCapital - state.nav;
  const decreaseBps = (decrease / initialCapital) * 10000;

  // Expected round-trip decrease: 1 - (1 - 0.0015)^2 = 0.00299775 ~= 29.98 bps (~30 bps)
  const passed = Math.abs(decreaseBps - 30) < 1.0;

  return {
    name: 'Round-Trip Check',
    passed,
    value: decreaseBps,
    expected: '~30 bps decrease',
    message: passed
      ? `Passed: NAV decreased by ${decreaseBps.toFixed(2)} bps (~30 bps expected) with zero price movement`
      : `Failed: NAV decreased by ${decreaseBps.toFixed(2)} bps (expected ~30 bps)`,
    details: {
      initialCapital,
      finalNav: state.nav,
      decreaseUsd: decrease,
      decreaseBps,
    },
  };
}

export async function runSanityChecks(): Promise<{
  allPassed: boolean;
  checks: SanityCheckResult[];
}> {
  const generator = checkGenerator();
  const hold = await checkHold();
  const roundTrip = await checkRoundTrip();

  return {
    allPassed: generator.passed && hold.passed && roundTrip.passed,
    checks: [generator, hold, roundTrip],
  };
}
