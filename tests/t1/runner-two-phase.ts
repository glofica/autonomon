/**
 * T1c — Two-phase training and evaluation test.
 *
 * Phase 1 (training): 5,000 steps with epsilon = 0.30 (exploration on).
 * Phase 2 (evaluation): 5,000 steps with epsilon = 0 (exploitation only).
 *
 * The Q-table is preserved between phases. We measure Phase 2 only.
 *
 * Purpose: prove the agent learns a useful policy (HOLD) in a market with
 * no edge. If Phase 2 shows low trades and near-zero return, the agent
 * learned. If Phase 2 shows high trades and deep losses, the agent did
 * not learn — it only follows the Q-table default.
 *
 * Reference: GLOFICA_Langton_Autonomon.md Section 14 and Section 4.
 */

import { generateMartingale } from './martingale-generator.js';
import { SyntheticAssetAdapter } from './synthetic-adapter.js';
import { QLearning, type RandomSource } from '../../src/rl/q-learning.js';
import { observeState, type MarketObservation } from '../../src/rl/state.js';
import { ACTION_IDS } from '../../src/rl/actions.js';
import { DEFAULT_GENOME } from '../../src/genome/types.js';
import { computeT1Metrics, type T1Metrics } from './metrics.js';
import { writeReport, type T1Config } from './report.js';

// ─── Seeded PRNG ────────────────────────────────────────────────────────

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

// ─── Config ─────────────────────────────────────────────────────────────

export interface T1cResult {
    seed: number;
    initialCapital: number;
    navAfterTraining: number;
    navAfterEvaluation: number;
    evalNetLogReturn: number;
    evalAnnualizedReturn: number;
    evalTurnover: number;
    evalTradeCount: number;
    trainSteps: number;
    evalSteps: number;
}

export interface T1cReport {
    results: T1cResult[];
    metrics: T1Metrics;
    passed: boolean;
    reportPath: string;
}

export const T1C_CONFIG: T1Config & {
    trainSteps: number;
    evalSteps: number;
    trainEpsilon: number;
} = {
    seedsCount: 30,
    stepsPerSeed: 10000,       // legacy field, not used in T1c loop
    trainSteps: 5000,
    evalSteps: 5000,
    trainEpsilon: 0.30,
    initialCapital: 10000,
    sigma: 0.30,
    dt: 5 / (60 * 24 * 365),
    feeBps: 10,
    slippageBps: 5,
};

const RSI_PERIOD = 14;
const RETURN_LOOKBACK = 14;
const R_MAX = 1.0;

// ─── Feature helpers ────────────────────────────────────────────────────

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

// ─── Single seed, two phases ────────────────────────────────────────────

export async function runOneSeedT1c(seed: number): Promise<T1cResult> {
    const {
        trainSteps, evalSteps, trainEpsilon,
        initialCapital, sigma, dt,
    } = T1C_CONFIG;

    const totalSteps = trainSteps + evalSteps;
    const prices = generateMartingale({
        seed, p0: 100, sigma, dt, n: totalSteps,
    });

    const adapter = new SyntheticAssetAdapter({
        initialCash: initialCapital,
        currentPrice: prices[0],
    });

    const agentId = `t1c-agent-${seed}`;
    const genome = DEFAULT_GENOME;

    // Phase 1: training with exploration.
    const ql = new QLearning(
        ACTION_IDS,
        {
            alpha: genome.g_alpha,
            gamma: 0.95,
            epsilon: trainEpsilon,
            epsilonDecay: 0.995,
            epsilonMin: 0.05,
        },
        new SeededPRNG(seed * 7919),
    );

    const history: number[] = [prices[0]];
    let prevNav = initialCapital;

    // ── Phase 1: training ──
    for (let t = 0; t < trainSteps; t++) {
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

    const navAfterTraining = prevNav;

    // ── Phase 2: evaluation with exploitation only ──
    // Replace the QLearning epsilon with 0 (and disable decay).
    // Reuse the same Q-table via a fresh instance with imported data.
    const qlEval = new QLearning(
        ACTION_IDS,
        {
            alpha: genome.g_alpha,
            gamma: 0.95,
            epsilon: 0,
            epsilonDecay: 1.0,
            epsilonMin: 0,
        },
        new SeededPRNG(seed * 7919 + 1),
    );
    qlEval.importQTable(ql.exportQTable());

    // Reset trade counters for the evaluation phase.
    // Note: totalTurnover and tradeCount are cumulative, so we snapshot here.
    const tradesAtStart = adapter.getTradeCount();
    const turnoverAtStart = adapter.getTotalTurnover();

    for (let t = trainSteps; t < totalSteps; t++) {
        const price = prices[t];
        const previousPrice = history.length >= 2 ? history[history.length - 2] : undefined;
        const agentState = await adapter.getState(agentId);

        const obs = buildObservation(
            price, previousPrice, history,
            agentState.exposureRatio, seed, t,
        );
        const stateKey = observeState(obs);
        const action = qlEval.selectAction(stateKey);

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

        qlEval.update(stateKey, action, reward, nextStateKey);
        prevNav = newNav;
    }

    const navAfterEvaluation = prevNav;
    const evalTradeCount = adapter.getTradeCount() - tradesAtStart;
    const evalTurnover = (adapter.getTotalTurnover() - turnoverAtStart) / navAfterTraining;

    const evalNetLogReturn = Math.log(navAfterEvaluation / navAfterTraining);
    const horizonYears = evalSteps * dt;
    const evalAnnualizedReturn = horizonYears > 0 ? evalNetLogReturn / horizonYears : 0;

    return {
        seed,
        initialCapital,
        navAfterTraining,
        navAfterEvaluation,
        evalNetLogReturn,
        evalAnnualizedReturn,
        evalTurnover,
        evalTradeCount,
        trainSteps,
        evalSteps,
    };
}

// ─── Full T1c run ───────────────────────────────────────────────────────

export async function runT1c(): Promise<T1cReport> {
    const results: T1cResult[] = [];
    for (let seed = 1; seed <= T1C_CONFIG.seedsCount; seed++) {
        const r = await runOneSeedT1c(seed);
        results.push(r);
    }

    // Map to SeedResult shape for computeT1Metrics.
    const seedResults = results.map((r) => ({
        seed: r.seed,
        initialCapital: r.navAfterTraining,
        finalNav: r.navAfterEvaluation,
        netLogReturn: r.evalNetLogReturn,
        annualizedReturn: r.evalAnnualizedReturn,
        turnover: r.evalTurnover,
        tradeCount: r.evalTradeCount,
        steps: r.evalSteps,
    }));

    const metrics = computeT1Metrics(seedResults);
    const passed = metrics.noPositiveMaterialEdge && metrics.fprWithinTolerance;

    const reportPath = await writeReport(
        metrics,
        { ...T1C_CONFIG } as any,
        seedResults,
        'results/t1c/report.md',
        'T1c — two-phase (training then evaluation)',
    );

    return {
        results,
        metrics,
        passed,
        reportPath,
    };
}