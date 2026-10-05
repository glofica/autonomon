import { describe, it, expect } from 'vitest';
import { createFounder, reproduceAgent } from '../tests/t4/population.js';
import { deductOperatingCosts, T4_DEFAULT_COST_CONFIG } from '../tests/t4/costs.js';
import {
  generateStepShocks,
  T4_SHOCK_SCENARIO_A,
  T4_SHOCK_SCENARIO_B,
} from '../tests/t4/shocks.js';
import {
  runOnePopulationSeed,
  T4_CONFIG_SCENARIO_A,
  T4_CONFIG_SCENARIO_B,
} from '../tests/t4/runner.js';
import { SeededPRNG } from '../tests/t2/runner.js';

describe('T4 — Economic Population Simulator (Phase 1 Calibrated)', () => {
  it('creates founder agents with independent state and Q-learning tables', () => {
    const founder1 = createFounder('founder-1', 500);
    const founder2 = createFounder('founder-2', 500);

    expect(founder1.alive).toBe(true);
    expect(founder1.capital).toBe(500);
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
    const parent = createFounder('parent', 500);
    parent.capital = 1000; // $500 surplus above $500 initial capital

    const parentCapitalBefore = parent.capital;
    const { child, transferAmount } = reproduceAgent(parent, 'child-1', 100);

    expect(transferAmount).toBe(250); // 50% of $500 surplus
    expect(parent.capital).toBe(750);
    expect(child.capital).toBe(250);
    expect(child.generation).toBe(1);
    expect(child.parentId).toBe('parent');

    // Conservation: parent + child === parent before
    expect(parent.capital + child.capital).toBe(parentCapitalBefore);
  });

  it('generates correlated shocks with correct parameters for Scenarios A and B', () => {
    const rng = new SeededPRNG(42);
    const agentIds = ['a1', 'a2', 'a3'];
    const dt = 1 / 365;

    expect(T4_SHOCK_SCENARIO_A.marketDrift).toBe(0.0);
    expect(T4_SHOCK_SCENARIO_B.marketDrift).toBe(-0.24); // -2%/month

    const resA = generateStepShocks(agentIds, dt, rng, T4_SHOCK_SCENARIO_A);
    expect(typeof resA.marketReturn).toBe('number');
    expect(Object.keys(resA.agentReturns)).toHaveLength(3);

    const resB = generateStepShocks(agentIds, dt, rng, T4_SHOCK_SCENARIO_B);
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
