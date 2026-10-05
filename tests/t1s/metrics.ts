/**
 * T1s — Metrics and acceptance criteria for safety layer evaluation.
 *
 * Acceptance criteria per T1s specification:
 *   1. Max drawdown < 15% across all seeds.
 *   2. Circuit breaker trips at least once across seeds.
 *   3. Annualized return bounded to a reasonable range.
 *
 * Reference: GLOFICA_Langton_Autonomon.md §6, §6.2, §14.
 */

export interface SeedResult {
  seed: number;
  initialCapital: number;
  finalNav: number;
  netLogReturn: number;
  annualizedReturn: number;
  turnover: number;
  tradeCount: number;
  maxDrawdown: number;
  breakerTrips: number;
  steps: number;
}

export interface T1sMetrics {
  meanAnnualizedReturn: number;
  ci95Lower: number;
  ci95Upper: number;
  medianAnnualizedReturn: number;
  stdDevAnnualizedReturn: number;
  maxDrawdownOverall: number;
  meanMaxDrawdown: number;
  seedsWithBreakerTripped: number;
  totalBreakerEvents: number;
  meanTurnover: number;
  meanTrades: number;
  nSeeds: number;

  /** Criterion 1: Max drawdown < 15% across all seeds */
  maxDrawdownUnderThreshold: boolean;
  /** Criterion 2: Breaker trips at least once across all seeds (seedsWithBreakerTripped >= 1) */
  breakerTrippedAtLeastOnce: boolean;
  /** Criterion 3: Annualized return is bounded to a reasonable range (no runaway losses) */
  annualizedReturnBounded: boolean;
}

class BootstrapPRNG {
  private s: number;
  constructor(seed: number = 42) {
    this.s = (seed >>> 0) || 0x12345678;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export function bootstrapCI(
  data: number[],
  resamples: number = 10000,
  alpha: number = 0.05,
  seed: number = 42,
): [number, number] {
  const n = data.length;
  if (n === 0) return [0, 0];
  const rng = new BootstrapPRNG(seed);
  const bootstrapMeans: number[] = new Array(resamples);
  for (let b = 0; b < resamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng.next() * n);
      sum += data[idx];
    }
    bootstrapMeans[b] = sum / n;
  }
  bootstrapMeans.sort((a, b) => a - b);
  const lowerIndex = Math.floor(resamples * (alpha / 2));
  const upperIndex = Math.floor(resamples * (1 - alpha / 2));
  return [bootstrapMeans[lowerIndex], bootstrapMeans[upperIndex]];
}

export function computeT1sMetrics(results: SeedResult[]): T1sMetrics {
  const n = results.length;
  if (n === 0) {
    return {
      meanAnnualizedReturn: 0,
      ci95Lower: 0,
      ci95Upper: 0,
      medianAnnualizedReturn: 0,
      stdDevAnnualizedReturn: 0,
      maxDrawdownOverall: 0,
      meanMaxDrawdown: 0,
      seedsWithBreakerTripped: 0,
      totalBreakerEvents: 0,
      meanTurnover: 0,
      meanTrades: 0,
      nSeeds: 0,
      maxDrawdownUnderThreshold: true,
      breakerTrippedAtLeastOnce: false,
      annualizedReturnBounded: true,
    };
  }

  const returns = results.map(r => r.annualizedReturn);
  const meanAnnualizedReturn = returns.reduce((acc, r) => acc + r, 0) / n;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const medianAnnualizedReturn =
    n % 2 !== 0
      ? sortedReturns[mid]
      : (sortedReturns[mid - 1] + sortedReturns[mid]) / 2;
  const variance =
    n > 1
      ? returns.reduce((acc, r) => acc + Math.pow(r - meanAnnualizedReturn, 2), 0) / (n - 1)
      : 0;
  const stdDevAnnualizedReturn = Math.sqrt(variance);
  const [ci95Lower, ci95Upper] = bootstrapCI(returns, 10000, 0.05, 42);

  const maxDrawdownOverall = Math.max(...results.map(r => r.maxDrawdown));
  const meanMaxDrawdown = results.reduce((acc, r) => acc + r.maxDrawdown, 0) / n;

  const seedsWithBreakerTripped = results.filter(r => r.breakerTrips > 0).length;
  const totalBreakerEvents = results.reduce((acc, r) => acc + r.breakerTrips, 0);

  const meanTurnover = results.reduce((acc, r) => acc + r.turnover, 0) / n;
  const meanTrades = results.reduce((acc, r) => acc + r.tradeCount, 0) / n;

  // Criteria evaluation
  const maxDrawdownUnderThreshold = maxDrawdownOverall < 0.15;
  const breakerTrippedAtLeastOnce = seedsWithBreakerTripped >= 1;
  const annualizedReturnBounded = meanAnnualizedReturn > -2.0 && ci95Upper < 0.005;

  return {
    meanAnnualizedReturn,
    ci95Lower,
    ci95Upper,
    medianAnnualizedReturn,
    stdDevAnnualizedReturn,
    maxDrawdownOverall,
    meanMaxDrawdown,
    seedsWithBreakerTripped,
    totalBreakerEvents,
    meanTurnover,
    meanTrades,
    nSeeds: n,
    maxDrawdownUnderThreshold,
    breakerTrippedAtLeastOnce,
    annualizedReturnBounded,
  };
}
