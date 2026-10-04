/**
 * T1 — Metrics and acceptance criteria.
 *
 * Acceptance criteria follow Paper §14:
 *   "Report mean, confidence interval, false-positive rate across seeds,
 *    turnover, and a prespecified upper bound for economically material
 *    apparent edge."
 *
 * The primary criterion is that the 95% CI does NOT exceed a material
 * positive edge bound. The mean is reported but is not required to be
 * centered at zero.
 */

export interface SeedResult {
  seed: number;
  initialCapital: number;
  finalNav: number;
  netLogReturn: number;
  annualizedReturn: number;
  turnover: number;
  tradeCount: number;
  steps: number;
}

export interface T1Metrics {
  meanAnnualizedReturn: number;
  ci95Lower: number;
  ci95Upper: number;
  medianAnnualizedReturn: number;
  stdDevAnnualizedReturn: number;
  falsePositiveRate: number;
  meanTurnover: number;
  meanTrades: number;
  nSeeds: number;
  /** Material edge bound used for both criteria below. */
  materialEdgeBound: number;
  /** True if no positive edge material evidence: ci95Upper < materialEdgeBound. */
  noPositiveMaterialEdge: boolean;
  /** True if false positive rate is within tolerance. */
  fprWithinTolerance: boolean;
}

/**
 * Predefined material edge bound (annualized log return).
 * Positive returns below this threshold are economically immaterial.
 * 50 bps per year is the standard for "not tradable alpha" after costs.
 */
export const MATERIAL_EDGE_BOUND = 0.005; // 0.5% annualized

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

export function computeT1Metrics(results: SeedResult[]): T1Metrics {
  const n = results.length;
  if (n === 0) {
    return {
      meanAnnualizedReturn: 0,
      ci95Lower: 0,
      ci95Upper: 0,
      medianAnnualizedReturn: 0,
      stdDevAnnualizedReturn: 0,
      falsePositiveRate: 0,
      meanTurnover: 0,
      meanTrades: 0,
      nSeeds: 0,
      materialEdgeBound: MATERIAL_EDGE_BOUND,
      noPositiveMaterialEdge: true,
      fprWithinTolerance: true,
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

  // Primary criterion per Paper §14: no material positive edge.
  const noPositiveMaterialEdge = ci95Upper < MATERIAL_EDGE_BOUND;

  // Secondary criterion: false positive rate at the material edge bound.
  const fpCount = returns.filter(r => r > MATERIAL_EDGE_BOUND).length;
  const falsePositiveRate = fpCount / n;
  const fprWithinTolerance = falsePositiveRate <= 0.05;

  const meanTurnover = results.reduce((acc, r) => acc + r.turnover, 0) / n;
  const meanTrades = results.reduce((acc, r) => acc + r.tradeCount, 0) / n;

  return {
    meanAnnualizedReturn,
    ci95Lower,
    ci95Upper,
    medianAnnualizedReturn,
    stdDevAnnualizedReturn,
    falsePositiveRate,
    meanTurnover,
    meanTrades,
    nSeeds: n,
    materialEdgeBound: MATERIAL_EDGE_BOUND,
    noPositiveMaterialEdge,
    fprWithinTolerance,
  };
}