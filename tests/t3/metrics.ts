/**
 * T3 — Metrics and Acceptance Criteria
 *
 * Prespecified measurements per Paper §14 & §14.1:
 *   - Adaptation delay (steps after tau until post-change regret < 0.05)
 *   - Cumulative post-change regret
 *   - Fraction of runs censored (unrecovered within horizon)
 *   - Mean and 95% Bootstrap CI over 30 independent seeds across 3 arms:
 *       1. constant (alpha = 0.10)
 *       2. diminishing (alpha_n = n^(-0.7))
 *       3. frozen (alpha = 0 after tau)
 *
 * Acceptance Criteria (Paper §14):
 *   - Constant-step median adaptation delay < 5,000 steps
 *   - Frozen arm does NOT reach tolerance (censored)
 *   - Uncertainty intervals reported for all three arms
 */

export type ArmType = 'constant' | 'diminishing' | 'frozen';

export interface SeedArmResult {
  seed: number;
  arm: ArmType;
  /**
   * Adaptation delay: steps post-tau until regret remains below tolerance (< 0.05)
   * for a sustained window of 100 consecutive steps, per Paper §14 ("remain within
   * tolerance for a fixed duration"). Null if censored (the agent never sustains
   * 100 consecutive steps below tolerance before the end of the simulation).
   */
  adaptationDelay: number | null;
  /** Effective steps (capped at horizon if censored) for numerical summaries */
  effectiveSteps: number;
  censored: boolean;
  cumulativePostRegret: number;
  finalRegret: number;
}

export interface ArmSummary {
  arm: ArmType;
  nSeeds: number;
  censoredCount: number;
  censoredRate: number;
  // Adaptation delay summary (for uncensored or restricted horizon)
  adaptationDelayMedian: number | null;
  adaptationDelayMean: number;
  adaptationDelayCi95: [number, number];
  // Cumulative regret summary
  cumulativeRegretMean: number;
  cumulativeRegretMedian: number;
  cumulativeRegretCi95: [number, number];
  cumulativeRegretStdDev: number;
  // Final regret summary
  finalRegretMean: number;
  finalRegretMedian: number;
  finalRegretCi95: [number, number];
}

export interface T3Metrics {
  arms: Record<ArmType, ArmSummary>;
  regretTolerance: number;
  maxDelayThreshold: number; // 5,000 steps
  constantPassed: boolean;
  frozenPassed: boolean;
  overallPassed: boolean;
}

export const REGRET_TOLERANCE_THRESHOLD = 0.05;
export const MAX_CONSTANT_DELAY_THRESHOLD = 5000;

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

export function summarizeArm(arm: ArmType, results: SeedArmResult[]): ArmSummary {
  const nSeeds = results.length;
  const censoredCount = results.filter((r) => r.censored).length;
  const censoredRate = nSeeds > 0 ? censoredCount / nSeeds : 0;

  // Delays: evaluate effective steps (or null if all censored)
  const effectiveDelays = results.map((r) => r.effectiveSteps);
  const sortedDelays = [...effectiveDelays].sort((a, b) => a - b);
  const mid = Math.floor(nSeeds / 2);
  const medianDelay =
    nSeeds > 0
      ? (nSeeds % 2 !== 0 ? sortedDelays[mid] : (sortedDelays[mid - 1] + sortedDelays[mid]) / 2)
      : null;

  const meanDelay = nSeeds > 0 ? effectiveDelays.reduce((a, b) => a + b, 0) / nSeeds : 0;
  const delayCi95 = bootstrapCI(effectiveDelays, 10000, 0.05, 42);

  // Cumulative regret
  const cumRegrets = results.map((r) => r.cumulativePostRegret);
  const meanCumRegret = nSeeds > 0 ? cumRegrets.reduce((a, b) => a + b, 0) / nSeeds : 0;
  const sortedCum = [...cumRegrets].sort((a, b) => a - b);
  const medianCumRegret =
    nSeeds > 0 ? (nSeeds % 2 !== 0 ? sortedCum[mid] : (sortedCum[mid - 1] + sortedCum[mid]) / 2) : 0;
  const cumVariance =
    nSeeds > 1
      ? cumRegrets.reduce((acc, v) => acc + Math.pow(v - meanCumRegret, 2), 0) / (nSeeds - 1)
      : 0;
  const cumStdDev = Math.sqrt(cumVariance);
  const cumCi95 = bootstrapCI(cumRegrets, 10000, 0.05, 42);

  // Final regret
  const finalRegrets = results.map((r) => r.finalRegret);
  const meanFinal = nSeeds > 0 ? finalRegrets.reduce((a, b) => a + b, 0) / nSeeds : 0;
  const sortedFinal = [...finalRegrets].sort((a, b) => a - b);
  const medianFinal =
    nSeeds > 0 ? (nSeeds % 2 !== 0 ? sortedFinal[mid] : (sortedFinal[mid - 1] + sortedFinal[mid]) / 2) : 0;
  const finalCi95 = bootstrapCI(finalRegrets, 10000, 0.05, 42);

  return {
    arm,
    nSeeds,
    censoredCount,
    censoredRate,
    adaptationDelayMedian: censoredCount === nSeeds ? null : medianDelay,
    adaptationDelayMean: meanDelay,
    adaptationDelayCi95: delayCi95,
    cumulativeRegretMean: meanCumRegret,
    cumulativeRegretMedian: medianCumRegret,
    cumulativeRegretCi95: cumCi95,
    cumulativeRegretStdDev: cumStdDev,
    finalRegretMean: meanFinal,
    finalRegretMedian: medianFinal,
    finalRegretCi95: finalCi95,
  };
}

export function computeT3Metrics(allResults: Record<ArmType, SeedArmResult[]>): T3Metrics {
  const armSummaries: Record<ArmType, ArmSummary> = {
    constant: summarizeArm('constant', allResults.constant),
    diminishing: summarizeArm('diminishing', allResults.diminishing),
    frozen: summarizeArm('frozen', allResults.frozen),
  };

  // Acceptance Criteria (Paper §14):
  // 1. Constant-step reaches post-change tolerance with median < 5,000 steps
  const constantMedian = armSummaries.constant.adaptationDelayMedian;
  const constantPassed =
    constantMedian !== null && constantMedian < MAX_CONSTANT_DELAY_THRESHOLD;

  // 2. Frozen arm does NOT reach tolerance (censored rate > 50%, typically 100%)
  const frozenPassed =
    armSummaries.frozen.censoredCount > 0 &&
    armSummaries.frozen.censoredRate >= 0.90;

  const overallPassed = constantPassed && frozenPassed;

  return {
    arms: armSummaries,
    regretTolerance: REGRET_TOLERANCE_THRESHOLD,
    maxDelayThreshold: MAX_CONSTANT_DELAY_THRESHOLD,
    constantPassed,
    frozenPassed,
    overallPassed,
  };
}
