/**
 * Langton Genome — Mutation Engine
 *
 * Each module mutates independently during reproduction.
 * Offspring inherit parent traits with gaussian drift and discrete mutations,
 * creating evolutionary divergence in risk, forecasting, and cognition.
 */

import type {
    LangtonGenome,
    NumericGenome,
    EntryStrategy,
    HoldingPeriod,
    SoulPersonality,
} from './types.js';

function gaussian(mean = 0, stdev = 1): number {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdev;
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

/**
 * Mutate a single numerical locus per Paper §7 Proposition 5:
 * g_i^child = clip(g_i^parent * (1 + xi_i), l_i, u_i) where xi_i ~ N(0, 0.05^2)
 */
export function mutateLocus(parentVal: number, min: number, max: number, stdev = 0.05): number {
    const xi = gaussian(0, stdev);
    return clamp(parentVal * (1 + xi), min, max);
}

/**
 * Mutate the 7 canonical numerical loci per Paper §7 Proposition 5
 */
export function mutateNumericGenome(parent: NumericGenome): NumericGenome {
    return {
        g_risk: Number(mutateLocus(parent.g_risk, 0.10, 5.00).toFixed(4)),
        g_tau: Math.round(mutateLocus(parent.g_tau, 5, 60)),
        g_epsilon: Number(mutateLocus(parent.g_epsilon, 0.05, 0.50).toFixed(4)),
        g_alpha: Number(mutateLocus(parent.g_alpha, 0.01, 0.25).toFixed(4)),
        g_gas: Math.round(mutateLocus(parent.g_gas, 100, 1000)),
        g_omega: Number(mutateLocus(parent.g_omega, 0.05, 0.40).toFixed(4)),
        g_mitosis: Number(mutateLocus(parent.g_mitosis, 1.50, 3.00).toFixed(4)),
    };
}

function pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shouldMutate(rate: number): boolean {
    return Math.random() < rate;
}

const ENTRY_STRATEGIES: readonly EntryStrategy[] = ['momentum', 'contrarian', 'mean_reversion', 'breakout', 'dca'];
const HOLDING_PERIODS: readonly HoldingPeriod[] = ['short', 'medium', 'long'];
const SOUL_PERSONALITIES: readonly SoulPersonality[] = ['analytical', 'risk_seeking', 'conservative', 'contrarian', 'stoic'];
const ALL_PRODUCTS = ['gQMF', 'gOIL', 'gLRE', 'gCO2', 'gTBND', 'gHASH', 'gGOLD'];

export function mutate(parent: LangtonGenome): LangtonGenome {
    const rate = parent.reproduction.mutationRate;

    // Mutate 7 loci per Paper §7 Proposition 5
    const loci = mutateNumericGenome({
        g_risk: parent.g_risk ?? 1.0,
        g_tau: parent.g_tau ?? 15,
        g_epsilon: parent.g_epsilon ?? 0.30,
        g_alpha: parent.g_alpha ?? 0.10,
        g_gas: parent.g_gas ?? 250,
        g_omega: parent.g_omega ?? 0.20,
        g_mitosis: parent.g_mitosis ?? 2.00,
    });

    const child: LangtonGenome = {
        ...loci,
        // ── Risk Module ──
        risk: {
            riskTolerance: shouldMutate(rate)
                ? clamp(parent.risk.riskTolerance + gaussian(0, 0.1), 0, 1)
                : parent.risk.riskTolerance,
            stopLossPct: shouldMutate(rate)
                ? clamp(parent.risk.stopLossPct + gaussian(0, 0.05), 0.02, 0.5)
                : parent.risk.stopLossPct,
            maxPositionPct: shouldMutate(rate)
                ? clamp(parent.risk.maxPositionPct + gaussian(0, 0.1), 0.1, 0.9)
                : parent.risk.maxPositionPct,
        },

        // ── Market Module ──
        market: {
            preferredProducts: shouldMutate(rate)
                ? mutateProducts(parent.market.preferredProducts)
                : [...parent.market.preferredProducts],
            sectorWeights: shouldMutate(rate)
                ? mutateSectorWeights(parent.market.sectorWeights)
                : { ...parent.market.sectorWeights },
        },

        // ── Temporal Module ──
        temporal: {
            rebalanceFreqHours: shouldMutate(rate)
                ? clamp(Math.round(parent.temporal.rebalanceFreqHours + gaussian(0, 12)), 1, 168)
                : parent.temporal.rebalanceFreqHours,
            entryStrategy: shouldMutate(rate)
                ? pickRandom(ENTRY_STRATEGIES)
                : parent.temporal.entryStrategy,
            holdingPeriod: shouldMutate(rate)
                ? pickRandom(HOLDING_PERIODS)
                : parent.temporal.holdingPeriod,
        },

        // ── Forecast Module (TimesFM) ──
        forecast: {
            useTimesFM: parent.forecast.useTimesFM,
            forecastHorizon: shouldMutate(rate)
                ? clamp(Math.round(parent.forecast.forecastHorizon + gaussian(0, 6)), 6, 72)
                : parent.forecast.forecastHorizon,
            minConfidence: shouldMutate(rate)
                ? clamp(parent.forecast.minConfidence + gaussian(0, 0.05), 0.4, 0.95)
                : parent.forecast.minConfidence,
            forecastWeight: shouldMutate(rate)
                ? clamp(parent.forecast.forecastWeight + gaussian(0, 0.08), 0.2, 0.95)
                : parent.forecast.forecastWeight,
        },

        // ── Soul Module (Qwen) ──
        soul: {
            personality: shouldMutate(rate * 0.5) // personality mutates more slowly
                ? pickRandom(SOUL_PERSONALITIES)
                : parent.soul.personality,
            model: parent.soul.model,
            temperature: shouldMutate(rate)
                ? clamp(parent.soul.temperature + gaussian(0, 0.1), 0.2, 0.9)
                : parent.soul.temperature,
            reflectionDepth: shouldMutate(rate)
                ? clamp(parent.soul.reflectionDepth + gaussian(0, 0.1), 0.3, 1.0)
                : parent.soul.reflectionDepth,
        },

        // ── Social Module ──
        social: {
            cooperationLevel: shouldMutate(rate)
                ? clamp(parent.social.cooperationLevel + gaussian(0, 0.15), 0, 1)
                : parent.social.cooperationLevel,
            signalTrust: shouldMutate(rate)
                ? clamp(parent.social.signalTrust + gaussian(0, 0.1), 0, 1)
                : parent.social.signalTrust,
            poolWillingness: shouldMutate(rate)
                ? clamp(parent.social.poolWillingness + gaussian(0, 0.15), 0, 1)
                : parent.social.poolWillingness,
        },

        // ── Reproduction Module ──
        reproduction: {
            spawnThresholdXGO: shouldMutate(rate)
                ? clamp(Math.round(parent.reproduction.spawnThresholdXGO + gaussian(0, 100)), 50, 10000)
                : parent.reproduction.spawnThresholdXGO,
            childFundPct: shouldMutate(rate)
                ? clamp(parent.reproduction.childFundPct + gaussian(0, 0.05), 0.05, 0.5)
                : parent.reproduction.childFundPct,
            mutationRate: shouldMutate(rate)
                ? clamp(parent.reproduction.mutationRate + gaussian(0, 0.03), 0.01, 0.5)
                : parent.reproduction.mutationRate,
            parentRoyaltyPct: shouldMutate(rate)
                ? clamp(parent.reproduction.parentRoyaltyPct + gaussian(0, 0.03), 0, 0.3)
                : parent.reproduction.parentRoyaltyPct,
        },

        // ── Meta Module ──
        meta: {
            generation: parent.meta.generation + 1,
            parentAddress: '',
            fitness: 0,
            birthEpoch: 0,
            qTableHash: parent.meta.qTableHash,
        },
    };

    return child;
}

function mutateProducts(products: string[]): string[] {
    const result = [...products];
    if (Math.random() < 0.5 && result.length > 1) {
        result.splice(Math.floor(Math.random() * result.length), 1);
    } else {
        const available = ALL_PRODUCTS.filter(p => !result.includes(p));
        if (available.length > 0) {
            result.push(pickRandom(available));
        }
    }
    return result;
}

function mutateSectorWeights(weights: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    let total = 0;

    for (const [sector, weight] of Object.entries(weights)) {
        const mutated = Math.max(0.01, weight + gaussian(0, 0.1));
        result[sector] = mutated;
        total += mutated;
    }

    for (const sector of Object.keys(result)) {
        result[sector] /= total;
    }

    return result;
}
