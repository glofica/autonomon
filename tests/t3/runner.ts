/**
 * T3 — Regime Change Test Runner
 *
 * Runs 3 comparison arms across 30 independent seeds:
 *   1. Constant-step (alpha = 0.10)
 *   2. Diminishing-step (alpha_n = n^(-0.7))
 *   3. Frozen (alpha = 0 after tau)
 *
 * Budget:
 *   - 30 seeds
 *   - 50,000 transitions per seed
 *   - Parameter change at tau = 25,000
 *   - Post-change regret tolerance = 0.05
 *
 * Reference: GLOFICA_Langton_Autonomon.md §14 (T3) & Proposition 8.
 */

import { QLearning, type RandomSource } from '../../src/rl/q-learning.js';
import { type MDPDefinition, T2_STATES, T2_ACTIONS, T2_GAMMA } from '../t2/mdp-reference.js';
import { solveValueIteration, type ValueIterationResult } from '../t2/value-iteration.js';
import {
  T3_MDP_PHASE1,
  T3_MDP_PHASE2,
  TAU_CHANGE_STEP,
  TOTAL_TRANSITIONS,
  REGRET_TOLERANCE,
} from './mdp-regime-change.js';
import {
  type ArmType,
  type SeedArmResult,
  type T3Metrics,
  computeT3Metrics,
} from './metrics.js';
import { writeReport, type T3Config } from './report.js';

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

export const T3_DEFAULT_CONFIG: T3Config = {
  seedsCount: 30,
  totalTransitions: TOTAL_TRANSITIONS,
  tauChangeStep: TAU_CHANGE_STEP,
  regretTolerance: REGRET_TOLERANCE,
  stabilityDuration: 100, // Sustained window requirement per Paper §14
  gamma: T2_GAMMA,
  constantAlpha: 0.10,
  diminishingPower: -0.7,
  episodeLength: 10,
  initialEpsilon: 1.0,
  epsilonDecay: 0.99995,
  epsilonMin: 0.35,
};

export interface T3Report {
  results: Record<ArmType, SeedArmResult[]>;
  metrics: T3Metrics;
  viPhase1: ValueIterationResult;
  viPhase2: ValueIterationResult;
  passed: boolean;
  reportPath: string;
}

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
 * Computes mean action-value regret across states using Q* from value iteration:
 *   Regret = (1 / |S|) * sum_{s} [ Q*(s, pi*(s)) - Q*(s, pi_hat(s)) ]
 *
 * Regret uses Q* (ground truth from value iteration), not the agent's
 * Q-table. Using Q_agente would yield zero regret by construction,
 * making the metric meaningless. See paper §14.
 */
function computeRegretAgainstGroundTruth(
  ql: QLearning,
  viResult: ValueIterationResult,
): number {
  let total = 0.0;
  for (const s of T2_STATES) {
    const starA = viResult.optimalPolicy[s];
    const agentA = ql.bestAction(s);
    const regretS = viResult.qStar[s][starA] - viResult.qStar[s][agentA];
    total += Math.max(0, regretS);
  }
  return total / T2_STATES.length;
}

/**
 * Runs a single arm for a specific seed.
 */
export async function runArmForSeed(
  arm: ArmType,
  seed: number,
  viPhase1: ValueIterationResult,
  viPhase2: ValueIterationResult,
  config: T3Config = T3_DEFAULT_CONFIG,
): Promise<SeedArmResult> {
  const rng = new SeededPRNG(seed * 7919 + 104729);

  let stepSizeFn: ((n: number) => number) | undefined = undefined;
  if (arm === 'diminishing') {
    stepSizeFn = (n: number) => Math.pow(n, config.diminishingPower);
  }

  const ql = new QLearning(
    [...T2_ACTIONS],
    {
      alpha: config.constantAlpha,
      gamma: config.gamma,
      epsilon: config.initialEpsilon,
      epsilonDecay: config.epsilonDecay,
      epsilonMin: config.epsilonMin,
      stepSizeFn,
    },
    rng,
  );

  let currentMdp = T3_MDP_PHASE1;
  const numStates = T2_STATES.length;
  let currentState = T2_STATES[Math.floor(rng.next() * numStates)];

  let recoveryStep: number | null = null;
  let consecutiveSteps = 0;
  let cumulativePostRegret = 0.0;
  const postChangeHorizon = config.totalTransitions - config.tauChangeStep;

  for (let t = 0; t < config.totalTransitions; t++) {
    // Parameter change occurs at t = tau
    if (t === config.tauChangeStep) {
      currentMdp = T3_MDP_PHASE2;
    }

    const action = ql.selectAction(currentState);
    const nextState = sampleNextState(currentMdp, currentState, action, rng);
    const reward = currentMdp.rewards[currentState][action];

    // For frozen arm, no Q updates occur post-tau (alpha = 0)
    if (!(t >= config.tauChangeStep && arm === 'frozen')) {
      ql.update(currentState, action, reward, nextState);
    }

    // Exploring starts reset
    if ((t + 1) % config.episodeLength === 0) {
      currentState = T2_STATES[Math.floor(rng.next() * numStates)];
    } else {
      currentState = nextState;
    }

    // Evaluate post-change regret against MDP 2 ground truth
    if (t >= config.tauChangeStep) {
      const currentRegret = computeRegretAgainstGroundTruth(ql, viPhase2);
      cumulativePostRegret += currentRegret;

      // Track sustained tolerance window per Paper §14
      if (recoveryStep === null) {
        if (currentRegret < config.regretTolerance) {
          consecutiveSteps++;
          if (consecutiveSteps === config.stabilityDuration) {
            recoveryStep = (t - config.tauChangeStep) - config.stabilityDuration + 1;
          }
        } else {
          consecutiveSteps = 0;
        }
      }
    }
  }

  const finalRegret = computeRegretAgainstGroundTruth(ql, viPhase2);
  const censored = recoveryStep === null;

  return {
    seed,
    arm,
    adaptationDelay: recoveryStep,
    effectiveSteps: recoveryStep ?? postChangeHorizon,
    censored,
    cumulativePostRegret,
    finalRegret,
  };
}

/**
 * Runs the full T3 test suite across all 3 arms and 30 seeds.
 */
export async function runT3(config: T3Config = T3_DEFAULT_CONFIG): Promise<T3Report> {
  const viPhase1 = solveValueIteration(T3_MDP_PHASE1);
  const viPhase2 = solveValueIteration(T3_MDP_PHASE2);

  const results: Record<ArmType, SeedArmResult[]> = {
    constant: [],
    diminishing: [],
    frozen: [],
  };

  const arms: ArmType[] = ['constant', 'diminishing', 'frozen'];

  for (const arm of arms) {
    for (let seed = 1; seed <= config.seedsCount; seed++) {
      const res = await runArmForSeed(arm, seed, viPhase1, viPhase2, config);
      results[arm].push(res);
    }
  }

  const metrics = computeT3Metrics(results);
  const passed = metrics.overallPassed;

  const reportPath = await writeReport(
    metrics,
    config,
    results,
    viPhase1,
    viPhase2,
    'results/t3/report.md',
  );

  return {
    results,
    metrics,
    viPhase1,
    viPhase2,
    passed,
    reportPath,
  };
}
