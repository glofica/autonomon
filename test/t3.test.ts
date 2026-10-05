import { describe, it, expect } from 'vitest';
import { solveValueIteration } from '../tests/t2/value-iteration.js';
import { T3_MDP_PHASE1, T3_MDP_PHASE2, TAU_CHANGE_STEP } from '../tests/t3/mdp-regime-change.js';
import { runArmForSeed, T3_DEFAULT_CONFIG } from '../tests/t3/runner.js';
import { T2_STATES } from '../tests/t2/mdp-reference.js';

describe('T3 — Regime Change Adaptation Test Suite (Paper §14 & Proposition 8)', () => {
  it('converges to well-defined optimal policies in both Phase 1 and Phase 2', () => {
    const vi1 = solveValueIteration(T3_MDP_PHASE1);
    const vi2 = solveValueIteration(T3_MDP_PHASE2);

    expect(vi1.converged).toBe(true);
    expect(vi2.converged).toBe(true);
    expect(vi1.maxBellmanResidual).toBeLessThan(1e-8);
    expect(vi2.maxBellmanResidual).toBeLessThan(1e-8);

    // Policy must change on at least one state
    let policyChangedCount = 0;
    for (const s of T2_STATES) {
      if (vi1.optimalPolicy[s] !== vi2.optimalPolicy[s]) {
        policyChangedCount++;
      }
    }
    expect(policyChangedCount).toBeGreaterThan(0);
  });

  it('guarantees that frozen policy pi*_1 has regret > 0.05 under MDP Phase 2', () => {
    const vi1 = solveValueIteration(T3_MDP_PHASE1);
    const vi2 = solveValueIteration(T3_MDP_PHASE2);

    let totalRegret = 0;
    for (const s of T2_STATES) {
      const starAction = vi2.optimalPolicy[s];
      const frozenAction = vi1.optimalPolicy[s];
      totalRegret += vi2.qStar[s][starAction] - vi2.qStar[s][frozenAction];
    }
    const avgRegret = totalRegret / T2_STATES.length;
    expect(avgRegret).toBeGreaterThan(0.05);
  });

  it('recovers within tolerance for constant-step arm while frozen arm remains censored', async () => {
    const vi1 = solveValueIteration(T3_MDP_PHASE1);
    const vi2 = solveValueIteration(T3_MDP_PHASE2);

    const config = {
      ...T3_DEFAULT_CONFIG,
      totalTransitions: 27000,
      tauChangeStep: 25000,
    };

    const constResult = await runArmForSeed('constant', 1, vi1, vi2, config);
    expect(constResult.censored).toBe(false);
    expect(constResult.adaptationDelay).toBeLessThan(500);

    const frozenResult = await runArmForSeed('frozen', 1, vi1, vi2, config);
    expect(frozenResult.censored).toBe(true);
    expect(frozenResult.finalRegret).toBeGreaterThan(0.05);
  }, 30000);
});
