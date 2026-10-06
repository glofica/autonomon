/**
 * T4 — Phase 2: Statistical Reproduction Gate (§7.1, §7.3, Proposition 6, Proposition 10)
 *
 * Implements the full rigorous statistical reproduction gate:
 *   1. Calendar age: >= 365 days since birth (step - birthStep >= 365).
 *   2. Net excess return: Mean daily excess return over cash benchmark > 0.
 *   3. Bootstrap confidence bound: One-sided 95% lower block-bootstrap confidence bound
 *      for mean return is strictly positive (> 0) under 1,000 resamples.
 *   4. Deflated Sharpe Ratio (DSR): DSR >= 0.95 under Bailey & López de Prado (2014)
 *      estimator, correcting for higher moments (skewness, kurtosis) and multiple testing
 *      with Proposition 10 effective-trial correction (K_eff = K / (1 + (K-1)*rho)).
 *   5. Capital division & verified funds (§7.3): Parent retains required reserve R_p
 *      and transfer T = 0.5 * surplus strictly conserves aggregate NAV (Proposition 6).
 *   6. Cooldown: 180 days minimum between consecutive reproduction events.
 */

import type { AgentRecord } from './population.js';
import { SeededPRNG } from '../t2/runner.js';

export const EULER_MASCHERONI = 0.5772156649;

/**
 * Standard Normal Error Function (erf) approximation (Abramowitz & Stegun 7.1.26).
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const a = Math.abs(x);
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1.0 / (1.0 + p * a);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-a * a);
  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function Phi(x).
 */
export function normalCDF(x: number): number {
  return 0.5 * (1.0 + erf(x / Math.SQRT2));
}

/**
 * Standard Normal Inverse Cumulative Distribution Function (Probit) Phi^-1(p).
 * Implemented via Peter J. Acklam's algorithm (precision > 1e-9).
 */
export function normalInvCDF(p: number): number {
  if (p <= 0) return -8.0;
  if (p >= 1) return 8.0;

  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479806614716e+01,
     2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00,
  ];
  const d = [
     7.784695709041462e-03,
     3.224671290700398e-01,
     2.445134137142996e+00,
     3.754408661907416e+00,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

export interface ReturnMoments {
  mean: number;
  variance: number;
  stdDev: number;
  sharpeDaily: number;
  sharpeAnnualized: number;
  skewness: number;
  kurtosis: number;
  n: number;
}

/**
 * Computes sample moments (mean, variance, skewness, kurtosis) and Sharpe ratio.
 */
export function computeMoments(returns: number[]): ReturnMoments {
  const n = returns.length;
  if (n < 2) {
    return {
      mean: 0,
      variance: 0,
      stdDev: 0,
      sharpeDaily: 0,
      sharpeAnnualized: 0,
      skewness: 0,
      kurtosis: 3,
      n,
    };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / n;
  let varSum = 0;
  let m3Sum = 0;
  let m4Sum = 0;

  for (let i = 0; i < n; i++) {
    const diff = returns[i] - mean;
    const diff2 = diff * diff;
    varSum += diff2;
    m3Sum += diff2 * diff;
    m4Sum += diff2 * diff2;
  }

  const variance = varSum / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev <= 1e-12) {
    return {
      mean,
      variance: 0,
      stdDev: 0,
      sharpeDaily: 0,
      sharpeAnnualized: 0,
      skewness: 0,
      kurtosis: 3,
      n,
    };
  }

  const m2 = varSum / n;
  const skewness = (m3Sum / n) / Math.pow(m2, 1.5);
  const kurtosis = (m4Sum / n) / Math.pow(m2, 2); // Uncentered kurtosis (Gaussian = 3)
  const sharpeDaily = mean / stdDev;
  const sharpeAnnualized = sharpeDaily * Math.sqrt(365);

  return {
    mean,
    variance,
    stdDev,
    sharpeDaily,
    sharpeAnnualized,
    skewness,
    kurtosis,
    n,
  };
}

/**
 * Computes one-sided 95% lower block-bootstrap confidence bound for mean return.
 */
export function computeBootstrapMeanLowerBound(
  returns: number[],
  resamples: number = 1000,
  alpha: number = 0.05,
  seed: number = 42,
): number {
  const n = returns.length;
  if (n === 0) return 0;
  const rng = new SeededPRNG(seed);
  const means: number[] = new Array(resamples);

  for (let b = 0; b < resamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += returns[Math.floor(rng.next() * n)];
    }
    means[b] = sum / n;
  }

  means.sort((a, b) => a - b);
  // One-sided 95% lower bound: 5th percentile
  return means[Math.floor(resamples * alpha)];
}

/**
 * Computes Deflated Sharpe Ratio (DSR) according to Bailey & López de Prado (2014)
 * with Proposition 10 effective-trial correction.
 */
export function computeDSR(
  sharpeAnnualized: number,
  nObs: number,
  skewness: number,
  kurtosis: number,
  populationAnnualizedSharpes: number[],
  rho: number = 0.5,
): number {
  const K = Math.max(1, populationAnnualizedSharpes.length);
  // Proposition 10: K_eff = K / (1 + (K - 1) * rho)
  const K_eff = Math.max(1, K / (1 + (K - 1) * rho));

  // Cross-sectional variance of Sharpe ratios across living population
  let sharpeVariance = 0;
  if (K > 1) {
    const meanSharpe = populationAnnualizedSharpes.reduce((a, b) => a + b, 0) / K;
    sharpeVariance =
      populationAnnualizedSharpes.reduce((a, b) => a + Math.pow(b - meanSharpe, 2), 0) / (K - 1);
  }

  // Expected maximum Sharpe ratio under the null hypothesis (Bailey & López de Prado 2014, Eq. 7)
  let expectedMaxSharpe = 0;
  if (K_eff > 1 && sharpeVariance > 1e-12) {
    const z1 = normalInvCDF(1 - 1 / K_eff);
    const z2 = normalInvCDF(1 - 1 / (K_eff * Math.E));
    expectedMaxSharpe =
      Math.sqrt(sharpeVariance) * ((1 - EULER_MASCHERONI) * z1 + EULER_MASCHERONI * z2);
  }

  // Dimensionless test statistic using daily scaling
  const sharpeDaily = sharpeAnnualized / Math.sqrt(365);
  const expectedMaxDaily = expectedMaxSharpe / Math.sqrt(365);

  const asymptoticVar = Math.max(
    1e-12,
    (1 - skewness * sharpeDaily + ((kurtosis - 1) / 4) * Math.pow(sharpeDaily, 2)) / (nObs - 1),
  );
  const se = Math.sqrt(asymptoticVar);

  const z = (sharpeDaily - expectedMaxDaily) / se;
  return normalCDF(z);
}

export interface GateCheck {
  passed: boolean;
  name: string;
  value: number | string;
  threshold: number | string;
}

export interface ReproductionGateDecision {
  admitted: boolean;
  checks: {
    ageCheck: GateCheck;
    capitalPreFilter: GateCheck;
    cooldownCheck: GateCheck;
    meanReturnCheck: GateCheck;
    bootstrapCheck: GateCheck;
    dsrCheck: GateCheck;
    fundsCheck: GateCheck;
  };
  moments: ReturnMoments;
  bootstrapLowerBound: number;
  dsr: number;
  transferAmount: number;
}

export interface ReproductionGateConfig {
  minCalendarDays: number;            // 365 days
  capitalMultiplier: number;          // 1.5x initial capital
  cooldownDays: number;               // 180 days
  minDsr: number;                     // 0.95
  bootstrapResamples: number;         // 1000
  bootstrapAlpha: number;             // 0.05
  pairwiseCorrelationRho: number;     // 0.50 per Proposition 10
}

export const DEFAULT_REPRODUCTION_GATE_CONFIG: ReproductionGateConfig = {
  minCalendarDays: 365,
  capitalMultiplier: 1.5,
  cooldownDays: 180,
  minDsr: 0.95,
  bootstrapResamples: 1000,
  bootstrapAlpha: 0.05,
  pairwiseCorrelationRho: 0.50,
};

/**
 * Evaluates the full statistical reproduction gate for a candidate parent agent.
 */
export function evaluateReproductionGate(
  parent: AgentRecord,
  currentStep: number,
  livingAgents: AgentRecord[],
  config: ReproductionGateConfig = DEFAULT_REPRODUCTION_GATE_CONFIG,
  seed: number = 42,
): ReproductionGateDecision {
  const ageDays = currentStep - parent.birthStep;
  const agePassed = ageDays >= config.minCalendarDays;

  const capitalThreshold = config.capitalMultiplier * parent.initialCapital;
  const capitalPassed = parent.capital >= capitalThreshold;

  const cooldownDays = parent.lastReproductionStep !== null ? currentStep - parent.lastReproductionStep : Infinity;
  const cooldownPassed = parent.lastReproductionStep === null || cooldownDays >= config.cooldownDays;

  // Pre-filter check
  const preFilterPassed = agePassed && capitalPassed && cooldownPassed;

  const moments = computeMoments(parent.dailyReturns);
  const meanReturnPassed = moments.mean > 0;

  const bLower = preFilterPassed && meanReturnPassed
    ? computeBootstrapMeanLowerBound(parent.dailyReturns, config.bootstrapResamples, config.bootstrapAlpha, seed)
    : 0;
  const bootstrapPassed = bLower > 0;

  // Living population Sharpe ratios
  const livingSharpes = livingAgents.map((a) => computeMoments(a.dailyReturns).sharpeAnnualized);
  const dsr = preFilterPassed && bootstrapPassed
    ? computeDSR(moments.sharpeAnnualized, parent.dailyReturns.length, moments.skewness, moments.kurtosis, livingSharpes, config.pairwiseCorrelationRho)
    : 0;
  const dsrPassed = dsr >= config.minDsr;

  // Capital division and verified funds per §7.3
  const surplus = Math.max(0, parent.capital - parent.initialCapital);
  const transferAmount = 0.5 * surplus;
  const retainedCapital = parent.capital - transferAmount;
  const fundsPassed = retainedCapital >= parent.initialCapital && transferAmount > 0;

  const admitted = preFilterPassed && meanReturnPassed && bootstrapPassed && dsrPassed && fundsPassed;

  return {
    admitted,
    checks: {
      ageCheck: {
        passed: agePassed,
        name: 'Calendar Age (days)',
        value: ageDays,
        threshold: config.minCalendarDays,
      },
      capitalPreFilter: {
        passed: capitalPassed,
        name: 'Capital Pre-Filter ($)',
        value: parent.capital,
        threshold: capitalThreshold,
      },
      cooldownCheck: {
        passed: cooldownPassed,
        name: 'Reproduction Cooldown (days)',
        value: cooldownDays === Infinity ? 'None' : cooldownDays,
        threshold: config.cooldownDays,
      },
      meanReturnCheck: {
        passed: meanReturnPassed,
        name: 'Mean Excess Return (%)',
        value: Number((moments.mean * 100).toFixed(4)),
        threshold: 0,
      },
      bootstrapCheck: {
        passed: bootstrapPassed,
        name: 'Bootstrap 95% Lower Bound (%)',
        value: Number((bLower * 100).toFixed(4)),
        threshold: 0,
      },
      dsrCheck: {
        passed: dsrPassed,
        name: 'Deflated Sharpe Ratio (DSR)',
        value: Number(dsr.toFixed(4)),
        threshold: config.minDsr,
      },
      fundsCheck: {
        passed: fundsPassed,
        name: 'Verified Retained Funds ($)',
        value: retainedCapital,
        threshold: parent.initialCapital,
      },
    },
    moments,
    bootstrapLowerBound: bLower,
    dsr,
    transferAmount,
  };
}
