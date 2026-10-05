/**
 * T2 — Sanity Checks
 *
 * Pre-flight validation verifying MDP mathematical consistency before running seeds:
 *   1. Probability conservation: sum_{s'} P(s' | s, a) == 1.0 for all (s, a)
 *   2. Bounded reward: |R(s, a)| <= R_max = 1.0 for all (s, a)
 *   3. Value iteration convergence: Bellman residual < 1e-8 within 10,000 iterations
 *   4. Communicating property: all states reachable from any starting state
 */

import { type MDPDefinition, T2_MDP } from './mdp-reference.js';
import { solveValueIteration, type ValueIterationResult } from './value-iteration.js';

export interface SanityCheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export function checkProbabilityConservation(mdp: MDPDefinition = T2_MDP): SanityCheckResult {
  let allValid = true;
  const invalidPairs: string[] = [];

  for (const s of mdp.states) {
    for (const a of mdp.actions) {
      const transList = mdp.transitions[s][a];
      const sumProb = transList.reduce((acc, t) => acc + t.probability, 0);
      const isConservation = Math.abs(sumProb - 1.0) < 1e-12;
      const allNonNegative = transList.every((t) => t.probability >= 0 && t.probability <= 1);

      if (!isConservation || !allNonNegative) {
        allValid = false;
        invalidPairs.push(`${s}:${a} (sum=${sumProb})`);
      }
    }
  }

  return {
    name: 'Probability Conservation Check',
    passed: allValid,
    message: allValid
      ? `Passed: All ${mdp.states.length * mdp.actions.length} (s, a) pairs have valid probabilities summing to 1.0`
      : `Failed: Invalid probabilities on: ${invalidPairs.join(', ')}`,
    details: { invalidPairs },
  };
}

export function checkBoundedRewards(mdp: MDPDefinition = T2_MDP, rMax: number = 1.0): SanityCheckResult {
  let allBounded = true;
  let minR = Infinity;
  let maxR = -Infinity;

  for (const s of mdp.states) {
    for (const a of mdp.actions) {
      const r = mdp.rewards[s][a];
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (Math.abs(r) > rMax) {
        allBounded = false;
      }
    }
  }

  return {
    name: 'Bounded Rewards Check',
    passed: allBounded,
    message: allBounded
      ? `Passed: All rewards lie in [${minR.toFixed(4)}, ${maxR.toFixed(4)}], strictly bounded within [-${rMax}, ${rMax}]`
      : `Failed: Rewards exceed bound [-${rMax}, ${rMax}]`,
    details: { minR, maxR, rMax },
  };
}

export function checkValueIteration(viResult: ValueIterationResult): SanityCheckResult {
  const passed = viResult.converged && viResult.maxBellmanResidual < 1e-8;

  return {
    name: 'Value Iteration Convergence Check',
    passed,
    message: passed
      ? `Passed: Value iteration converged in ${viResult.iterations} iterations (Bellman residual: ${viResult.maxBellmanResidual.toExponential(4)} < 1e-8)`
      : `Failed: VI did not converge within tolerance (residual: ${viResult.maxBellmanResidual.toExponential(4)})`,
    details: {
      iterations: viResult.iterations,
      maxBellmanResidual: viResult.maxBellmanResidual,
      converged: viResult.converged,
      optimalPolicy: viResult.optimalPolicy,
    },
  };
}

export function checkCommunicating(mdp: MDPDefinition = T2_MDP): SanityCheckResult {
  // Check that every state can reach every other state under uniform random policy
  const n = mdp.states.length;
  const stateIndices = new Map(mdp.states.map((s, idx) => [s, idx]));

  // Adjacency matrix for reachability
  const reach: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  for (let i = 0; i < n; i++) reach[i][i] = true;

  for (const s of mdp.states) {
    const u = stateIndices.get(s)!;
    for (const a of mdp.actions) {
      for (const t of mdp.transitions[s][a]) {
        if (t.probability > 0) {
          const v = stateIndices.get(t.nextState)!;
          reach[u][v] = true;
        }
      }
    }
  }

  // Warshall's algorithm for transitive closure
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        reach[i][j] = reach[i][j] || (reach[i][k] && reach[k][j]);
      }
    }
  }

  let stronglyConnected = true;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!reach[i][j]) {
        stronglyConnected = false;
        break;
      }
    }
  }

  return {
    name: 'Communicating MDP Check',
    passed: stronglyConnected,
    message: stronglyConnected
      ? `Passed: MDP is strongly communicating (all ${n} states mutually reachable under exploration)`
      : `Failed: MDP graph is not strongly communicating`,
    details: { stronglyConnected },
  };
}

export function runSanityChecks(
  mdp: MDPDefinition = T2_MDP,
  viResult?: ValueIterationResult,
): { allPassed: boolean; checks: SanityCheckResult[] } {
  const vi = viResult || solveValueIteration(mdp);

  const cProb = checkProbabilityConservation(mdp);
  const cReward = checkBoundedRewards(mdp);
  const cVI = checkValueIteration(vi);
  const cComm = checkCommunicating(mdp);

  const checks = [cProb, cReward, cVI, cComm];
  const allPassed = checks.every((c) => c.passed);

  return { allPassed, checks };
}
