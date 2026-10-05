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
});
