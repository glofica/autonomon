/**
 * T1b — No-edge null test with epsilon = 0 (exploitation only).
 *
 * Purpose: separate two questions.
 *   1. Does the agent learn to hold in a market with no edge?
 *   2. How much of T1's loss is attributable to mandatory exploration?
 *
 * If T1b shows near-zero return with low turnover, the agent has learned
 * the correct policy (HOLD) and T1's loss is the cost of exploration.
 *
 * Reference: GLOFICA_Langton_Autonomon.md §14 and §4.
 */

import { generateMartingale } from './martingale-generator.js';
import { SyntheticAssetAdapter } from './synthetic-adapter.js';
import { QLearning, type RandomSource } from '../../src/rl/q-learning.js';
import { observeState, type MarketObservation } from '../../src/rl/state.js';
import { ACTION_IDS } from '../../src/rl/actions.js';
import { DEFAULT_GENOME } from '../../src/genome/types.js';
import { computeT1Metrics, type T1Metrics } from './metrics.js';
import { runSanityChecks, type SanityCheckResult } from './sanity-checks.js';
import { writeReport, type T1Config } from './report.js';

class SeededPRNG implements RandomSource {
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

export interface T1Result {
    seed: number;
    initialCapital: number;
    finalNav: number;
    netLogReturn: number;
    annualizedReturn: number;
    turnover: number;
    tradeCount: number;
    steps: number;
}

export interface T1Report {
    results: T1Result[];
    metrics: T1Metrics;
    sanityChecks: { allPassed: boolean; checks: SanityCheckResult[] };
    passed: boolean;
    reportPath: string;
}

export const T1B_DEFAULT_CONFIG: T1Config = {
    seedsCount: 30,
    stepsPerSeed: 10000,
    initialCapital: 10000,
    sigma: 0.30,
    dt: 5 / (60 * 24 * 365),
    feeBps: 10,
    slippageBps: 5,
};

const RSI_PERIOD = 14;
const RETURN_LOOKBACK = 14;
const R_MAX = 1.0;

function computeReturns(prices: number[], lookback: number): number[] {
    const out: number[] = [];
    const start = Math.max(1, prices.length - lookback);
    for (let i = start; i < prices.length; i++) {
        out.push(Math.log(prices[i] / prices[i - 1]));
    }
    return out;
}

function computeRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const delta = prices[i] - prices[i - 1];
        if (delta > 0) gains += delta;
        else losses += -delta;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function syntheticForecast(seed: number, step: number, price: number) {
    const mix = ((seed * 73856093) ^ (step * 19349663)) >>> 0;
    const prng = new SeededPRNG(mix);
    const drift = (prng.next() - 0.5) * 0.04;
    const width = 0.01 + prng.next() * 0.06;
    const q50 = price * (1 + drift);
    const half = (q50 * width) / 2;
    return { q10: q50 - half, q50, q90: q50 + half };
}

function buildObservation(
    price: number,
    previousPrice: number | undefined,
    history: number[],
    agentExposure: number,
    seed: number,
    step: number,
): MarketObservation {
    const returns = computeReturns(history, RETURN_LOOKBACK);
    const rsi = computeRSI(history, RSI_PERIOD);
    const fc = syntheticForecast(seed, step, price);
    return {
        price,
        previousPrice,
        returns,
        rsi,
        q10: fc.q10,
        q50: fc.q50,
        q90: fc.q90,
        exposureRatio: agentExposure,
        runwayMonths: 12,
        diskUtilization: 0.20,
    };
}

export async function runOneSeedEpsilonZero(seed: number): Promise<T1Result> {
    const { stepsPerSeed: n, initialCapital, sigma, dt } = T1B_DEFAULT_CONFIG;

    const prices = generateMartingale({ seed, p0: 100, sigma, dt, n });
    const adapter = new SyntheticAssetAdapter({
        initialCash: initialCapital,
        currentPrice: prices[0],
    });

    const agentId = `t1b-agent-${seed}`;
    const genome = DEFAULT_GENOME;

    // Key difference from T1: epsilon = 0, epsilonDecay irrelevant.
    const ql = new QLearning(
        ACTION_IDS,
        {
            alpha: genome.g_alpha,
            gamma: 0.95,
            epsilon: 0,
            epsilonDecay: 1.0,
            epsilonMin: 0,
        },
        new SeededPRNG(seed * 7919),
    );

    const history: number[] = [prices[0]];
    let prevNav = initialCapital;

    for (let t = 0; t < n; t++) {
        const price = prices[t];
        const previousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
        const agentState = await adapter.getState(agentId);

        const obs = buildObservation(
            price, previousPrice, history,
            agentState.exposureRatio, seed, t,
        );
        const stateKey = observeState(obs);
        const action = ql.selectAction(stateKey);

        await adapter.execute({
            type: action as any,
            agentId,
            instrumentId: 'WR-CU-001',
        });

        const nextPrice = prices[t + 1];
        adapter.setPrice('WR-CU-001', nextPrice);
        history.push(nextPrice);
        if (history.length > 128) history.shift();

        const nextAgentState = await adapter.getState(agentId);
        const newNav = nextAgentState.nav;
        const rawReward =
            newNav > 0 && prevNav > 0 ? Math.log(newNav / prevNav) : 0;
        const reward = Math.max(-R_MAX, Math.min(R_MAX, rawReward));

        const nextPreviousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
        const nextObs = buildObservation(
            nextPrice, nextPreviousPrice, history,
            nextAgentState.exposureRatio, seed, t + 1,
        );
        const nextStateKey = observeState(nextObs);

        ql.update(stateKey, action, reward, nextStateKey);
        prevNav = newNav;
    }

    const finalState = await adapter.getState(agentId);
    const finalNav = finalState.nav;
    const netLogReturn = Math.log(finalNav / initialCapital);
    const horizonYears = n * dt;
    const annualizedReturn = horizonYears > 0 ? netLogReturn / horizonYears : 0;

    return {
        seed,
        initialCapital,
        finalNav,
        netLogReturn,
        annualizedReturn,
        turnover: adapter.getTotalTurnover() / initialCapital,
        tradeCount: adapter.getTradeCount(),
        steps: n,
    };
}

export async function runT1b(): Promise<T1Report> {
    const sanity = await runSanityChecks();
    if (!sanity.allPassed) {
        const failed = sanity.checks.filter((c) => !c.passed).map((c) => c.name).join(', ');
        throw new Error(`Sanity checks failed before T1b: ${failed}`);
    }

    const results: T1Result[] = [];
    for (let seed = 1; seed <= T1B_DEFAULT_CONFIG.seedsCount; seed++) {
        const r = await runOneSeedEpsilonZero(seed);
        results.push(r);
    }

    const metrics = computeT1Metrics(results);

    const passed = metrics.noPositiveMaterialEdge && metrics.fprWithinTolerance;

    const reportPath = await writeReport(
        metrics,
        T1B_DEFAULT_CONFIG,
        results,
        'results/t1b/report.md',
        'T1b — epsilon = 0 (exploitation only)',
    );

    return {
        results,
        metrics,
        sanityChecks: sanity,
        passed,
        reportPath,
    };
}