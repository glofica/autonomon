import { describe, it, expect } from 'vitest';
import { runSanityChecks } from '../tests/t2/sanity-checks.js';
import { solveValueIteration } from '../tests/t2/value-iteration.js';
import { T2_MDP } from '../tests/t2/mdp-reference.js';
import { runOneSeed, T2_DEFAULT_CONFIG } from '../tests/t2/runner.js';

describe('T2 — Known Stationary MDP Test Suite (Paper §14)', () => {
  it('passes all sanity checks (probability conservation, bounded rewards, VI convergence, communicating)', () => {
    const sanity = runSanityChecks(T2_MDP);
    expect(sanity.allPassed).toBe(true);
    for (const check of sanity.checks) {
      expect(check.passed).toBe(true);
    }
  });

  it('computes exact ground-truth Q* and pi* via pure Value Iteration', () => {
    const vi = solveValueIteration(T2_MDP);
    expect(vi.converged).toBe(true);
    expect(vi.maxBellmanResidual).toBeLessThan(1e-8);

    // Bull regime prefers acquiring / holding heavy inventory
    expect(vi.optimalPolicy['BULL_FLAT']).toBe('ACQUIRE_SPOT');
    expect(vi.optimalPolicy['BULL_LIGHT']).toBe('ACQUIRE_SPOT');
    expect(vi.optimalPolicy['BULL_HEAVY']).toBe('HOLD');

    // Bear regime prefers disposing inventory or holding cash flat
    expect(vi.optimalPolicy['BEAR_FLAT']).toBe('HOLD');
    expect(vi.optimalPolicy['BEAR_LIGHT']).toBe('DISPOSE_SPOT');
    expect(vi.optimalPolicy['BEAR_HEAVY']).toBe('DISPOSE_SPOT');
  });

  it('converges to optimal policy and low Q error on representative seed', async () => {
    const vi = solveValueIteration(T2_MDP);
    const result = await runOneSeed(1, T2_MDP, vi, {
      ...T2_DEFAULT_CONFIG,
      transitionsPerSeed: 25000,
    });

    expect(result.optimalActionAgreement).toBeGreaterThanOrEqual(0.95);
    expect(result.supNormQError).toBeLessThan(0.12);
    expect(result.actionValueRegret).toBeLessThan(0.01);
  }, 30000);
});
