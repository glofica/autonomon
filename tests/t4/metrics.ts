/**
 * T4 — Economic Population: Metrics & Statistical Estimation
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §14 (T4):
 *   "Estimate horizon-specific ruin probability, survival curves, restricted
 *    mean lifetime, reproduction frequency, false reproduction under a null,
 *    and capital required for a prespecified survival target. Report confidence
 *    intervals and sensitivity to cost, capital, and shock assumptions."
 */

export interface SeedPopulationResult {
  seed: number;
  founderCount: number;
  totalAgents: number;
  finalLiving: number;
  deadCount: number;
  childrenBorn: number;
  ruinProbability: number;
  founderRuinProbability: number;
  reproductionFrequency: number;
  populationGrowthRate: number;
  maxCapital: number;
  livingCounts: number[];
  founderSurvivalCurve: number[];
  eventsCount: number;
}

export interface MetricSummary {
  mean: number;
  ci95Lower: number;
  ci95Upper: number;
  median: number;
  stdDev: number;
}

export interface SurvivalCheckpoint {
  month: number;
  day: number;
  survivalRate: number;
  livingCountMean: number;
}

export interface T4Metrics {
  nSeeds: number;
  ruinProbability: MetricSummary;
  founderRuinProbability: MetricSummary;
  finalLivingPopulation: MetricSummary;
  childrenBorn: MetricSummary;
  reproductionFrequency: MetricSummary;
  populationGrowthRate: MetricSummary;
  peakCapital: MetricSummary;
  survivalCheckpoints: SurvivalCheckpoint[];
  simulatorPassed: boolean;
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

export function computeT4Metrics(results: SeedPopulationResult[]): T4Metrics {
  const nSeeds = results.length;

  const ruinProbSummary = summarizeMetric(results.map((r) => r.ruinProbability));
  const founderRuinSummary = summarizeMetric(results.map((r) => r.founderRuinProbability));
  const finalLivingSummary = summarizeMetric(results.map((r) => r.finalLiving));
  const childrenBornSummary = summarizeMetric(results.map((r) => r.childrenBorn));
  const reproFreqSummary = summarizeMetric(results.map((r) => r.reproductionFrequency));
  const growthRateSummary = summarizeMetric(results.map((r) => r.populationGrowthRate));
  const peakCapitalSummary = summarizeMetric(results.map((r) => r.maxCapital));

  // Compute survival checkpoints (Months 6, 12, 18, 24)
  const checkpoints: { month: number; day: number }[] = [
    { month: 0, day: 0 },
    { month: 6, day: 182 },
    { month: 12, day: 365 },
    { month: 18, day: 547 },
    { month: 24, day: 730 },
  ];

  const survivalCheckpoints: SurvivalCheckpoint[] = checkpoints.map((cp) => {
    let sumSurv = 0;
    let sumLiving = 0;
    for (const r of results) {
      const dayIdx = Math.min(cp.day, r.founderSurvivalCurve.length - 1);
      sumSurv += r.founderSurvivalCurve[dayIdx];
      const livingIdx = Math.min(cp.day, r.livingCounts.length - 1);
      sumLiving += r.livingCounts[livingIdx];
    }
    return {
      month: cp.month,
      day: cp.day,
      survivalRate: nSeeds > 0 ? sumSurv / nSeeds : 0,
      livingCountMean: nSeeds > 0 ? sumLiving / nSeeds : 0,
    };
  });

  // Phase 1 criteria: simulator runs without error and generates outputs for all 30 seeds
  const simulatorPassed = nSeeds === 30 && results.every((r) => r.totalAgents > 0);

  return {
    nSeeds,
    ruinProbability: ruinProbSummary,
    founderRuinProbability: founderRuinSummary,
    finalLivingPopulation: finalLivingSummary,
    childrenBorn: childrenBornSummary,
    reproductionFrequency: reproFreqSummary,
    populationGrowthRate: growthRateSummary,
    peakCapital: peakCapitalSummary,
    survivalCheckpoints,
    simulatorPassed,
  };
}
