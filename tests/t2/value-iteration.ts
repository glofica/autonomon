/**
 * T2 — Value Iteration (Ground Truth Solver)
 *
 * Computes exact Q*(s, a) and pi*(s) via pure Bellman optimality value iteration:
 *   Q_{k+1}(s, a) = R(s, a) + gamma * sum_{s'} P(s' | s, a) * max_{a'} Q_k(s', a')
 *
 * Parameters:
 *   tolerance: 1e-8
 *   maxIterations: 10,000
 *
 * Does NOT use the agent. Serves as pure analytical ground truth per Paper §14.
 */

import { type MDPDefinition, T2_MDP } from './mdp-reference.js';

export interface ValueIterationResult {
  qStar: Record<string, Record<string, number>>;
  vStar: Record<string, number>;
  optimalPolicy: Record<string, string>;
  optimalActionSets: Record<string, string[]>;
  iterations: number;
  maxBellmanResidual: number;
  converged: boolean;
}

export function solveValueIteration(
  mdp: MDPDefinition = T2_MDP,
  tolerance: number = 1e-8,
  maxIterations: number = 10000,
): ValueIterationResult {
  const { states, actions, gamma, transitions, rewards } = mdp;

  // Initialize Q_0(s, a) = 0
  let qCurrent: Record<string, Record<string, number>> = {};
  for (const s of states) {
    qCurrent[s] = {};
    for (const a of actions) {
      qCurrent[s][a] = 0.0;
    }
  }

  let iterations = 0;
  let maxResidual = Infinity;

  while (iterations < maxIterations) {
    iterations++;
    const qNext: Record<string, Record<string, number>> = {};
    let delta = 0.0;

    for (const s of states) {
      qNext[s] = {};
      for (const a of actions) {
        const r = rewards[s][a];
        const transList = transitions[s][a];

        let expectedNextValue = 0.0;
        for (const t of transList) {
          let maxNextQ = -Infinity;
          for (const nextA of actions) {
            const nextVal = qCurrent[t.nextState][nextA];
            if (nextVal > maxNextQ) {
              maxNextQ = nextVal;
            }
          }
          expectedNextValue += t.probability * maxNextQ;
        }

        const updatedQ = r + gamma * expectedNextValue;
        qNext[s][a] = updatedQ;

        const diff = Math.abs(updatedQ - qCurrent[s][a]);
        if (diff > delta) {
          delta = diff;
        }
      }
    }

    qCurrent = qNext;
    maxResidual = delta;

    if (delta < tolerance) {
      break;
    }
  }

  // Derive V*(s), pi*(s), and optimalActionSets
  const vStar: Record<string, number> = {};
  const optimalPolicy: Record<string, string> = {};
  const optimalActionSets: Record<string, string[]> = {};

  for (const s of states) {
    let maxVal = -Infinity;
    let bestAction = actions[0];

    for (const a of actions) {
      const qVal = qCurrent[s][a];
      if (qVal > maxVal) {
        maxVal = qVal;
        bestAction = a;
      }
    }

    vStar[s] = maxVal;
    optimalPolicy[s] = bestAction;

    // Collect all actions within 1e-9 of maxVal to account for ties
    const tiedActions: string[] = [];
    for (const a of actions) {
      if (Math.abs(qCurrent[s][a] - maxVal) < 1e-9) {
        tiedActions.push(a);
      }
    }
    optimalActionSets[s] = tiedActions;
  }

  return {
    qStar: qCurrent,
    vStar,
    optimalPolicy,
    optimalActionSets,
    iterations,
    maxBellmanResidual: maxResidual,
    converged: maxResidual < tolerance,
  };
}
