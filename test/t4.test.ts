import { describe, it, expect } from 'vitest';
import { createFounder, reproduceAgent } from '../tests/t4/population.js';
import { deductOperatingCosts, T4_DEFAULT_COST_CONFIG } from '../tests/t4/costs.js';
import {
  generateStepShocks,
  sampleNextRegime,
  T4_SHOCK_SCENARIO_A,
  T4_SHOCK_SCENARIO_B,
  T4_SHOCK_SCENARIO_C,
} from '../tests/t4/shocks.js';
import {
  runOnePopulationSeed,
  T4_CONFIG_SCENARIO_A,
  T4_CONFIG_SCENARIO_B,
  T4_CONFIG_SCENARIO_C,
} from '../tests/t4/runner.js';
import { SeededPRNG } from '../tests/t2/runner.js';
import {
  normalCDF,
  normalInvCDF,
  computeMoments,
  computeBootstrapMeanLowerBound,
  computeDSR,
  evaluateReproductionGate,
  DEFAULT_REPRODUCTION_GATE_CONFIG,
} from '../tests/t4/reproduction-gate.js';

describe('T4 — Economic Population Simulator (Two-Regime Persistent Market)', () => {
  it('creates founder agents with independent state and Q-learning tables', () => {
    const founder1 = createFounder('founder-1', 2000);
    const founder2 = createFounder('founder-2', 2000);

    expect(founder1.alive).toBe(true);
    expect(founder1.capital).toBe(2000);
    expect(founder1.generation).toBe(0);

    // Update founder 1 Q-table only
    founder1.ql.update('BULL_FLAT', 'ACQUIRE_SPOT', 1.0, 'BULL_LIGHT');
    expect(founder1.ql.getQ('BULL_FLAT', 'ACQUIRE_SPOT')).toBeGreaterThan(0);
    expect(founder2.ql.getQ('BULL_FLAT', 'ACQUIRE_SPOT')).toBe(0);
  });

  it('deducts operating costs and triggers financial termination when capital <= 0', () => {
    const agent = createFounder('test-agent', 10); // $10 capital
    const dt = 1 / 12; // 1 month ($22 cost)

    const res = deductOperatingCosts(agent, dt, 1, T4_DEFAULT_COST_CONFIG);
    expect(res.survived).toBe(false);
    expect(agent.alive).toBe(false);
    expect(agent.capital).toBe(0);
    expect(agent.deathStep).toBe(1);
  });

  it('strictly conserves capital during reproduction per Proposition 6', () => {
    const parent = createFounder('parent', 2000);
    parent.capital = 3000; // $1,000 surplus above $2,000 initial capital

    const parentCapitalBefore = parent.capital;
    const { child, transferAmount } = reproduceAgent(parent, 'child-1', 100);

    expect(transferAmount).toBe(500); // 50% of $1,000 surplus
    expect(parent.capital).toBe(2500);
    expect(child.capital).toBe(500);
    expect(child.generation).toBe(1);
    expect(child.parentId).toBe('parent');

    // Conservation: parent + child === parent before
    expect(parent.capital + child.capital).toBe(parentCapitalBefore);
  });

  it('implements regime persistence kernel q = 0.80', () => {
    const rng = new SeededPRNG(42);
    let bullStays = 0;
    const trials = 10000;

    for (let i = 0; i < trials; i++) {
      if (sampleNextRegime('BULL', 0.80, rng) === 'BULL') {
        bullStays++;
      }
    }
    const empiricalQ = bullStays / trials;
    expect(empiricalQ).toBeGreaterThan(0.78);
    expect(empiricalQ).toBeLessThan(0.82);
  });

  it('generates correlated shocks under active regime for Scenarios A, B, and C', () => {
    const rng = new SeededPRNG(42);
    const agentIds = ['a1', 'a2', 'a3'];
    const dt = 1 / 365;

    expect(T4_SHOCK_SCENARIO_A.driftBullMonthly).toBe(0.08);
    expect(T4_SHOCK_SCENARIO_A.driftBearMonthly).toBe(-0.08);

    expect(T4_SHOCK_SCENARIO_B.driftBullMonthly).toBe(0.04);
    expect(T4_SHOCK_SCENARIO_B.driftBearMonthly).toBe(-0.14);

    expect(T4_SHOCK_SCENARIO_C.driftBullMonthly).toBe(0.14);
    expect(T4_SHOCK_SCENARIO_C.driftBearMonthly).toBe(-0.04);

    const resA = generateStepShocks(agentIds, dt, 'BULL', rng, T4_SHOCK_SCENARIO_A);
    expect(typeof resA.marketReturn).toBe('number');
    expect(Object.keys(resA.agentReturns)).toHaveLength(3);

    const resB = generateStepShocks(agentIds, dt, 'BEAR', rng, T4_SHOCK_SCENARIO_B);
    expect(typeof resB.marketReturn).toBe('number');
    expect(Object.keys(resB.agentReturns)).toHaveLength(3);
  });

  it('runs population seed simulation producing valid survival and metric structures', async () => {
    const fastConfigA = {
      ...T4_CONFIG_SCENARIO_A,
      population: {
        ...T4_CONFIG_SCENARIO_A.population,
        founderCount: 5,
        horizonYears: 1,
        stepsPerYear: 50,
        dt: 1 / 50,
      },
    };

    const res = await runOnePopulationSeed(1, fastConfigA);
    expect(res.seed).toBe(1);
    expect(res.founderCount).toBe(5);
    expect(res.livingCounts.length).toBe(51);
    expect(res.founderSurvivalCurve.length).toBe(51);
    expect(res.founderSurvivalCurve[0]).toBe(1.0);
    expect(res.ruinProbability).toBeGreaterThanOrEqual(0);
    expect(res.ruinProbability).toBeLessThanOrEqual(1);
    expect(res.maxCapital).toBeGreaterThan(0);
  });

  it('defines distinct Stress ($800) and Product ($5,000) capital setups', () => {
    expect(T4_CONFIG_SCENARIO_A.population.initialCapitalPerFounder).toBe(800);
    expect(T4_CONFIG_SCENARIO_A.costs.monthlyHostingUsd).toBe(25);
    expect(T4_CONFIG_SCENARIO_A.costs.monthlyInferenceUsd).toBe(10);
    expect(T4_CONFIG_SCENARIO_A.costs.monthlyGasUsd).toBe(5);
    const totalMonthlyCost =
      T4_CONFIG_SCENARIO_A.costs.monthlyHostingUsd +
      T4_CONFIG_SCENARIO_A.costs.monthlyInferenceUsd +
      T4_CONFIG_SCENARIO_A.costs.monthlyGasUsd;
    expect(totalMonthlyCost).toBe(40);
    // Passive runway at $40/mo: $800 / $40 = 20 months
    const stressRunwayMonths = T4_CONFIG_SCENARIO_A.population.initialCapitalPerFounder / totalMonthlyCost;
    expect(stressRunwayMonths).toBe(20);
  });

  describe('Phase 2 — Statistical Reproduction Gate (§7.1, §7.3, Proposition 10)', () => {
    it('approximates standard normal CDF and inverse CDF with high precision', () => {
      expect(normalCDF(0)).toBeCloseTo(0.5, 6);
      expect(normalCDF(1.96)).toBeCloseTo(0.975, 2);
      expect(normalCDF(-1.96)).toBeCloseTo(0.025, 2);

      expect(normalInvCDF(0.5)).toBeCloseTo(0.0, 4);
      expect(normalInvCDF(0.975)).toBeCloseTo(1.96, 2);
      expect(normalInvCDF(0.05)).toBeCloseTo(-1.645, 2);
    });

    it('computes sample moments including mean, variance, skewness, and kurtosis', () => {
      const returns = [0.01, 0.02, -0.01, 0.03, -0.02, 0.01, 0.04];
      const moments = computeMoments(returns);

      expect(moments.n).toBe(7);
      expect(moments.mean).toBeGreaterThan(0);
      expect(moments.variance).toBeGreaterThan(0);
      expect(moments.stdDev).toBeCloseTo(Math.sqrt(moments.variance), 6);
      expect(moments.sharpeDaily).toBeCloseTo(moments.mean / moments.stdDev, 6);
      expect(moments.sharpeAnnualized).toBeCloseTo(moments.sharpeDaily * Math.sqrt(365), 4);
    });

    it('computes one-sided 95% bootstrap lower bound for return mean', () => {
      // Consistently positive returns
      const positiveReturns = Array.from({ length: 100 }, () => 0.005 + (Math.random() * 0.002));
      const bLowerPos = computeBootstrapMeanLowerBound(positiveReturns, 500, 0.05, 42);
      expect(bLowerPos).toBeGreaterThan(0);

      // Symmetrically distributed zero-mean returns
      const zeroReturns = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01));
      const bLowerZero = computeBootstrapMeanLowerBound(zeroReturns, 500, 0.05, 42);
      expect(bLowerZero).toBeLessThanOrEqual(0);
    });

    it('calculates Deflated Sharpe Ratio (DSR) under Bailey & López de Prado (2014)', () => {
      const populationSharpes = [0.8, 1.2, 0.5, 1.5, 0.9, 1.1, 0.7, 1.0];
      // High Sharpe ratio candidate with 500 observations
      const dsrHigh = computeDSR(2.5, 500, 0.0, 3.0, populationSharpes, 0.5);
      expect(dsrHigh).toBeGreaterThan(0.95);

      // Low Sharpe ratio candidate
      const dsrLow = computeDSR(0.8, 500, 0.0, 3.0, populationSharpes, 0.5);
      expect(dsrLow).toBeLessThan(0.90);
    });

    it('enforces all 5 reproduction gate criteria in evaluateReproductionGate', () => {
      const founder = createFounder('parent', 5000);

      // Case 1: Young agent (< 365 days) fails ageCheck
      founder.capital = 8000;
      const dec1 = evaluateReproductionGate(founder, 200, [founder], DEFAULT_REPRODUCTION_GATE_CONFIG);
      expect(dec1.admitted).toBe(false);
      expect(dec1.checks.ageCheck.passed).toBe(false);

      // Case 2: Sufficient age, but low capital (< 1.5x initial) fails capitalPreFilter
      founder.capital = 6000;
      const dec2 = evaluateReproductionGate(founder, 400, [founder], DEFAULT_REPRODUCTION_GATE_CONFIG);
      expect(dec2.admitted).toBe(false);
      expect(dec2.checks.capitalPreFilter.passed).toBe(false);

      // Case 3: Recent reproduction within cooldown (< 180 days) fails cooldownCheck
      founder.capital = 8000;
      founder.lastReproductionStep = 300;
      const dec3 = evaluateReproductionGate(founder, 400, [founder], DEFAULT_REPRODUCTION_GATE_CONFIG);
      expect(dec3.admitted).toBe(false);
      expect(dec3.checks.cooldownCheck.passed).toBe(false);

      // Case 4: Mature agent with strong edge passes all checks and verifies funds
      founder.lastReproductionStep = null;
      founder.dailyReturns = Array.from({ length: 400 }, (_, i) => 0.001 + (i % 2 === 0 ? 0.0005 : -0.0005));
      const dec4 = evaluateReproductionGate(founder, 400, [founder], DEFAULT_REPRODUCTION_GATE_CONFIG);
      expect(dec4.checks.ageCheck.passed).toBe(true);
      expect(dec4.checks.capitalPreFilter.passed).toBe(true);
      expect(dec4.checks.cooldownCheck.passed).toBe(true);
      expect(dec4.checks.meanReturnCheck.passed).toBe(true);
      expect(dec4.checks.bootstrapCheck.passed).toBe(true);
      expect(dec4.checks.dsrCheck.passed).toBe(true);
      expect(dec4.checks.fundsCheck.passed).toBe(true);
      expect(dec4.admitted).toBe(true);
      expect(dec4.transferAmount).toBe(1500); // 50% of ($8000 - $5000 surplus)
    });
  });
});
