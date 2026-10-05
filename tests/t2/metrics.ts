/**
 * T2 — Metrics and Acceptance Criteria
 *
 * Prespecified measurements per Paper §14:
 *   "Report sup-norm Q error, action-value regret, and optimal-action-set agreement;
 *    target error < epsilon (0.1) and agreement >= 95% at a prespecified budget."
 */

export interface SeedMetricResult {
  seed: number;
  supNormQError: number;
  actionValueRegret: number;
  optimalActionAgreement: number; // 0.0 to 1.0 (fraction of states)
  totalTransitions: number;
  minPairVisits: number;
  maxPairVisits: number;
}

export interface MetricSummary {
  mean: number;
  ci95Lower: number;
  ci95Upper: number;
  median: number;
  stdDev: number;
}

export interface T2Metrics {
  nSeeds: number;
  supNormQError: MetricSummary;
  actionValueRegret: MetricSummary;
  optimalActionAgreement: MetricSummary;
  // Acceptance criteria flags
  supNormErrorThreshold: number; // 0.1
  agreementThreshold: number; // 0.95
  supNormPassed: boolean; // mean < 0.1
  agreementPassed: boolean; // mean >= 0.95
  overallPassed: boolean;
}

export const SUP_NORM_ERROR_THRESHOLD = 0.1;
export const OPTIMAL_AGREEMENT_THRESHOLD = 0.95;

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

export function summarizeMetric(values: number[]): MetricSummary {
  const n = values.length;
  if (n === 0) {
    return { mean: 0, ci95Lower: 0, ci95Upper: 0, median: 0, stdDev: 0 };
  }
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const variance =
    n > 1
      ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const [ci95Lower, ci95Upper] = bootstrapCI(values, 10000, 0.05, 42);

  return { mean, ci95Lower, ci95Upper, median, stdDev };
}

export function computeT2Metrics(seedResults: SeedMetricResult[]): T2Metrics {
  const nSeeds = seedResults.length;
  const supErrors = seedResults.map((r) => r.supNormQError);
  const regrets = seedResults.map((r) => r.actionValueRegret);
  const agreements = seedResults.map((r) => r.optimalActionAgreement);

  const supNormSummary = summarizeMetric(supErrors);
  const regretSummary = summarizeMetric(regrets);
  const agreementSummary = summarizeMetric(agreements);

  // Acceptance criteria per Paper §14:
  // 1. Sup-norm Q error < 0.1
  // 2. Optimal-action-set agreement >= 95%
  const supNormPassed = supNormSummary.mean < SUP_NORM_ERROR_THRESHOLD;
  const agreementPassed = agreementSummary.mean >= OPTIMAL_AGREEMENT_THRESHOLD;
  const overallPassed = supNormPassed && agreementPassed;

  return {
    nSeeds,
    supNormQError: supNormSummary,
    actionValueRegret: regretSummary,
    optimalActionAgreement: agreementSummary,
    supNormErrorThreshold: SUP_NORM_ERROR_THRESHOLD,
    agreementThreshold: OPTIMAL_AGREEMENT_THRESHOLD,
    supNormPassed,
    agreementPassed,
    overallPassed,
  };
}
