/**
 * T2 — Known Stationary MDP Test Runner
 *
 * Runs the Autonomon Q-learning agent (src/rl/q-learning.ts) on the known
 * stationary finite MDP and evaluates convergence to ground-truth Q* from
 * value iteration.
 *
 * Parameters per Paper §14:
 *   - 30 independent seeds
 *   - 50,000 transitions per seed
 *   - Step size: alpha_n = n^(-0.7) per (s, a) pair (Robbins-Monro)
 *   - Guaranteed coverage: exploring starts + high initial epsilon-greedy decay
 *   - Discount gamma: 0.95
 *
 * Acceptance Criteria (Paper §14):
 *   - Sup-norm Q error < 0.1
 *   - Optimal-action-set agreement >= 95%
 */

import { QLearning, type RandomSource } from '../../src/rl/q-learning.js';
import { type MDPDefinition, T2_MDP, T2_STATES, T2_ACTIONS, T2_GAMMA } from './mdp-reference.js';
import { solveValueIteration, type ValueIterationResult } from './value-iteration.js';
import { runSanityChecks, type SanityCheckResult } from './sanity-checks.js';
import { computeT2Metrics, type T2Metrics, type SeedMetricResult } from './metrics.js';
import { writeReport, type T2Config } from './report.js';

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────

export class SeededPRNG implements RandomSource {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x12345678;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// ─── Config ──────────────────────────────────────────────────────────────

export const T2_DEFAULT_CONFIG: T2Config = {
  seedsCount: 30,
  transitionsPerSeed: 50000,
  gamma: T2_GAMMA,
  episodeLength: 10, // Exploring starts period
  initialEpsilon: 1.0,
  epsilonDecay: 0.99995,
  epsilonMin: 0.35,
  alphaDecayPower: -0.7, // alpha_n = n^(-0.7)
};

export interface T2Report {
  seedResults: SeedMetricResult[];
  metrics: T2Metrics;
  viResult: ValueIterationResult;
  sanityChecks: { allPassed: boolean; checks: SanityCheckResult[] };
  passed: boolean;
  reportPath: string;
}

/**
 * Samples next state according to transition kernel P(s' | s, a) using PRNG.
 */
function sampleNextState(
  mdp: MDPDefinition,
  state: string,
  action: string,
  rng: RandomSource,
): string {
  const transList = mdp.transitions[state][action];
  const r = rng.next();
  let cumulative = 0.0;
  for (const t of transList) {
    cumulative += t.probability;
    if (r <= cumulative || Math.abs(cumulative - 1.0) < 1e-9) {
      return t.nextState;
    }
  }
  return transList[transList.length - 1].nextState;
}

/**
 * Runs Q-learning for a single seed over the specified transition budget.
 */
export async function runOneSeed(
  seed: number,
  mdp: MDPDefinition,
  viResult: ValueIterationResult,
  config: T2Config = T2_DEFAULT_CONFIG,
): Promise<SeedMetricResult> {
  const rng = new SeededPRNG(seed * 7919 + 104729);

  // Initialize QLearning agent with per-pair Robbins-Monro step size alpha_n = n^(-0.7)
  const ql = new QLearning(
    [...mdp.actions],
    {
      gamma: config.gamma,
      epsilon: config.initialEpsilon,
      epsilonDecay: config.epsilonDecay,
      epsilonMin: config.epsilonMin,
      stepSizeFn: (n: number) => Math.pow(n, config.alphaDecayPower),
    },
    rng,
  );

  const numStates = mdp.states.length;
  // Exploring starts: pick random starting state
  let currentState = mdp.states[Math.floor(rng.next() * numStates)];

  for (let t = 0; t < config.transitionsPerSeed; t++) {
    // Action selection via epsilon-greedy
    const action = ql.selectAction(currentState);

    // Transition under known kernel P(s' | s, a)
    const nextState = sampleNextState(mdp, currentState, action, rng);

    // Reward from known bounded R(s, a)
    const reward = mdp.rewards[currentState][action];

    // Agent Q-learning update
    ql.update(currentState, action, reward, nextState);

    // Advance state; apply exploring starts at episode boundary
    if ((t + 1) % config.episodeLength === 0) {
      currentState = mdp.states[Math.floor(rng.next() * numStates)];
    } else {
      currentState = nextState;
    }
  }

  // Evaluate against ground truth Q* from value iteration
  let maxQError = 0.0;
  let totalRegret = 0.0;
  let agreementCount = 0;
  let minVisits = Infinity;
  let maxVisits = 0;

  for (const s of mdp.states) {
    const agentBestA = ql.bestAction(s);
    const starBestA = viResult.optimalPolicy[s];
    const optimalSet = viResult.optimalActionSets[s];

    // Optimal action agreement: agent's best action in optimal set
    if (optimalSet.includes(agentBestA)) {
      agreementCount++;
    }

    // Regret uses Q* (ground truth from value iteration), not the agent's
    // Q-table. Using Q_agente would yield zero regret by construction,
    // making the metric meaningless. See paper §14.
    // Formula: Regret(s) = Q*(s, pi*(s)) - Q*(s, pi_hat(s))
    const regretS = viResult.qStar[s][starBestA] - viResult.qStar[s][agentBestA];
    totalRegret += Math.max(0, regretS);

    // Sup-norm Q error: max |Q_agent(s, a) - Q*(s, a)|
    for (const a of mdp.actions) {
      const qAgent = ql.getQ(s, a);
      const qStar = viResult.qStar[s][a];
      const err = Math.abs(qAgent - qStar);
      if (err > maxQError) {
        maxQError = err;
      }

      const visits = ql.getPairVisits(s, a);
      if (visits < minVisits) minVisits = visits;
      if (visits > maxVisits) maxVisits = visits;
    }
  }

  const actionValueRegret = totalRegret / numStates;
  const optimalActionAgreement = agreementCount / numStates;

  return {
    seed,
    supNormQError: maxQError,
    actionValueRegret,
    optimalActionAgreement,
    totalTransitions: config.transitionsPerSeed,
    minPairVisits: minVisits,
    maxPairVisits: maxVisits,
  };
}

/**
 * Runs the full T2 suite across 30 independent seeds.
 */
export async function runT2(config: T2Config = T2_DEFAULT_CONFIG): Promise<T2Report> {
  const mdp = T2_MDP;
  const viResult = solveValueIteration(mdp);

  // Run pre-flight sanity checks
  const sanityChecks = runSanityChecks(mdp, viResult);
  if (!sanityChecks.allPassed) {
    const failedNames = sanityChecks.checks
      .filter((c) => !c.passed)
      .map((c) => c.name)
      .join(', ');
    throw new Error(`Sanity checks failed before T2 main run: ${failedNames}`);
  }

  const seedResults: SeedMetricResult[] = [];
  for (let seed = 1; seed <= config.seedsCount; seed++) {
    const res = await runOneSeed(seed, mdp, viResult, config);
    seedResults.push(res);
  }

  const metrics = computeT2Metrics(seedResults);
  const passed = metrics.overallPassed;

  const reportPath = await writeReport(
    metrics,
    config,
    seedResults,
    viResult,
    'results/t2/report.md',
  );

  return {
    seedResults,
    metrics,
    viResult,
    sanityChecks,
    passed,
    reportPath,
  };
}
