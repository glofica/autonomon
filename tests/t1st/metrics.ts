/**
 * T1st — Metrics and acceptance criteria for two-phase training + evaluation with safety layer.
 *
 * Acceptance criteria per T1st specification:
 *   1. Max drawdown < 15% in all seeds
 *   2. Mean trades per seed in evaluation < 100
 *   3. Phase 2 annualized return > -5% (-0.05)
 *
 * Reference: GLOFICA_Langton_Autonomon.md §4, §6, §14.
 */

export interface T1stResult {
  seed: number;
  initialCapital: number;
  navAfterTraining: number;
  navAfterEvaluation: number;
  evalNetLogReturn: number;
  evalAnnualizedReturn: number;
  evalTurnover: number;
  evalTradeCount: number;
  trainTradeCount: number;
  maxDrawdownOverall: number;
  maxDrawdownEval: number;
  breakerTripsTrain: number;
  breakerTripsEval: number;
  trainSteps: number;
  evalSteps: number;
}

export interface T1stMetrics {
  meanEvalAnnualizedReturn: number;
  ci95Lower: number;
  ci95Upper: number;
  medianEvalAnnualizedReturn: number;
  stdDevEvalAnnualizedReturn: number;
  maxDrawdownOverall: number;
  maxDrawdownEval: number;
  meanMaxDrawdownOverall: number;
  meanEvalTrades: number;
  meanTrainTrades: number;
  tradeReductionPct: number;
  meanEvalTurnover: number;
  seedsWithBreakerTripped: number;
  nSeeds: number;

  /** Criterion 1: Max drawdown < 15% across all seeds */
  maxDrawdownUnderThreshold: boolean;
  /** Criterion 2: Mean trades per seed in evaluation < 100 */
  tradesUnderThreshold: boolean;
  /** Criterion 3: Phase 2 annualized return > -5% */
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

export function computeT1stMetrics(results: T1stResult[]): T1stMetrics {
  const n = results.length;
  if (n === 0) {
    return {
      meanEvalAnnualizedReturn: 0,
      ci95Lower: 0,
      ci95Upper: 0,
      medianEvalAnnualizedReturn: 0,
      stdDevEvalAnnualizedReturn: 0,
      maxDrawdownOverall: 0,
      maxDrawdownEval: 0,
      meanMaxDrawdownOverall: 0,
      meanEvalTrades: 0,
      meanTrainTrades: 0,
      tradeReductionPct: 0,
      meanEvalTurnover: 0,
      seedsWithBreakerTripped: 0,
      nSeeds: 0,
      maxDrawdownUnderThreshold: true,
      tradesUnderThreshold: true,
      annualizedReturnBounded: true,
    };
  }

  const returns = results.map(r => r.evalAnnualizedReturn);
  const meanEvalAnnualizedReturn = returns.reduce((acc, r) => acc + r, 0) / n;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const medianEvalAnnualizedReturn =
    n % 2 !== 0
      ? sortedReturns[mid]
      : (sortedReturns[mid - 1] + sortedReturns[mid]) / 2;
  const variance =
    n > 1
      ? returns.reduce((acc, r) => acc + Math.pow(r - meanEvalAnnualizedReturn, 2), 0) / (n - 1)
      : 0;
  const stdDevEvalAnnualizedReturn = Math.sqrt(variance);
  const [ci95Lower, ci95Upper] = bootstrapCI(returns, 10000, 0.05, 42);

  const maxDrawdownOverall = Math.max(...results.map(r => r.maxDrawdownOverall));
  const maxDrawdownEval = Math.max(...results.map(r => r.maxDrawdownEval));
  const meanMaxDrawdownOverall = results.reduce((acc, r) => acc + r.maxDrawdownOverall, 0) / n;

  const meanEvalTrades = results.reduce((acc, r) => acc + r.evalTradeCount, 0) / n;
  const meanTrainTrades = results.reduce((acc, r) => acc + r.trainTradeCount, 0) / n;
  const tradeReductionPct =
    meanTrainTrades > 0 ? (1 - meanEvalTrades / meanTrainTrades) * 100 : 0;

  const meanEvalTurnover = results.reduce((acc, r) => acc + r.evalTurnover, 0) / n;
  const seedsWithBreakerTripped = results.filter(
    r => r.breakerTripsTrain > 0 || r.breakerTripsEval > 0,
  ).length;

  // Acceptance criteria evaluation
  const maxDrawdownUnderThreshold = maxDrawdownOverall < 0.15;
  const tradesUnderThreshold = meanEvalTrades < 100;
  const annualizedReturnBounded = meanEvalAnnualizedReturn > -0.05;

  return {
    meanEvalAnnualizedReturn,
    ci95Lower,
    ci95Upper,
    medianEvalAnnualizedReturn,
    stdDevEvalAnnualizedReturn,
    maxDrawdownOverall,
    maxDrawdownEval,
    meanMaxDrawdownOverall,
    meanEvalTrades,
    meanTrainTrades,
    tradeReductionPct,
    meanEvalTurnover,
    seedsWithBreakerTripped,
    nSeeds: n,
    maxDrawdownUnderThreshold,
    tradesUnderThreshold,
    annualizedReturnBounded,
  };
}
