/**
 * Langton Genome — Type Definitions
 *
 * The genome is a modular, mutable parameter set that defines
 * a Langton organism's investment strategy, reproduction rules,
 * TimesFM foundation forecasting horizons, and Qwen cognitive soul.
 *
 * Each module mutates independently during reproduction.
 */

// ── Risk Module ──
export interface RiskModule {
    /** How aggressively the agent invests (0.0 = conservative, 1.0 = aggressive) */
    riskTolerance: number;
    /** Auto-exit if position drops this percentage (0.05 = 5%) */
    stopLossPct: number;
    /** Maximum percentage of balance in a single position */
    maxPositionPct: number;
}

// ── Market Module ──
export interface MarketModule {
    /** RWA product token symbols to target */
    preferredProducts: string[];
    /** Weight allocation per sector (must sum to 1.0) */
    sectorWeights: Record<string, number>;
}

// ── Temporal Module ──
export type EntryStrategy = 'momentum' | 'contrarian' | 'mean_reversion' | 'breakout' | 'dca';
export type HoldingPeriod = 'short' | 'medium' | 'long';

export interface TemporalModule {
    /** Hours between portfolio rebalancing (1–168) */
    rebalanceFreqHours: number;
    /** Market entry strategy */
    entryStrategy: EntryStrategy;
    /** How long to hold positions */
    holdingPeriod: HoldingPeriod;
}

// ── Forecast Module (TimesFM Foundation Model) ──
export interface ForecastModule {
    /** Whether to use TimesFM zero-shot foundation forecasts */
    useTimesFM: boolean;
    /** Forecast horizon steps (e.g. 6, 12, 24, 48) */
    forecastHorizon: number;
    /** Minimum quantile confidence (0.0 to 1.0) before executing */
    minConfidence: number;
    /** Weight of foundation forecast vs immediate momentum (0.0 to 1.0) */
    forecastWeight: number;
}

// ── Soul Module (Qwen Cognitive Consciousness) ──
export type SoulPersonality = 'analytical' | 'risk_seeking' | 'conservative' | 'contrarian' | 'stoic';

export interface SoulModule {
    /** Psychological archetype */
    personality: SoulPersonality;
    /** LLM model tag in Ollama */
    model: string;
    /** Reasoning temperature */
    temperature: number;
    /** Verbosity of introspective diary entries */
    reflectionDepth: number;
}

// ── Social Module ──
export interface SocialModule {
    /** Willingness to cooperate with other Langton agents (0.0 = lone wolf, 1.0 = swarm) */
    cooperationLevel: number;
    /** How much to trust signals from other agents */
    signalTrust: number;
    /** Willingness to join investment pools */
    poolWillingness: number;
}

// ── Reproduction Module ──
export interface ReproductionModule {
    /** Profit (in XGO) required before the agent can spawn a child */
    spawnThresholdXGO: number;
    /** Percentage of balance given to child at spawn */
    childFundPct: number;
    /** Probability of each gene mutating during reproduction (0.01–0.5) */
    mutationRate: number;
    /** Percentage of child's yield sent to parent */
    parentRoyaltyPct: number;
}

// ── Meta Module ──
export interface MetaModule {
    /** Generation number (0 = seed, 1+ = offspring) */
    generation: number;
    /** GLOFICA address of parent agent (empty for seed) */
    parentAddress: string;
    /** Cumulative fitness score (ROI-based) */
    fitness: number;
    /** GLOFICA epoch when this agent was created */
    birthEpoch: number;
    /** Hash of the Q-table for inheritance verification */
    qTableHash: string;
}

// ── Complete Langton Genome ──
export interface LangtonGenome {
    risk: RiskModule;
    market: MarketModule;
    temporal: TemporalModule;
    forecast: ForecastModule;
    soul: SoulModule;
    social: SocialModule;
    reproduction: ReproductionModule;
    meta: MetaModule;
}

// ── Default Seed Genome ──
export const DEFAULT_GENOME: LangtonGenome = {
    risk: {
        riskTolerance: 0.5,
        stopLossPct: 0.1,
        maxPositionPct: 0.3,
    },
    market: {
        preferredProducts: ['gGOLD', 'gTBND', 'gOIL', 'gQMF'],
        sectorWeights: { commodities: 0.5, fixed_income: 0.3, energy: 0.2 },
    },
    temporal: {
        rebalanceFreqHours: 24,
        entryStrategy: 'momentum',
        holdingPeriod: 'medium',
    },
    forecast: {
        useTimesFM: true,
        forecastHorizon: 24,
        minConfidence: 0.65,
        forecastWeight: 0.70,
    },
    soul: {
        personality: 'analytical',
        model: 'qwen2.5:7b',
        temperature: 0.6,
        reflectionDepth: 0.8,
    },
    social: {
        cooperationLevel: 0.3,
        signalTrust: 0.2,
        poolWillingness: 0.1,
    },
    reproduction: {
        spawnThresholdXGO: 500,
        childFundPct: 0.2,
        mutationRate: 0.1,
        parentRoyaltyPct: 0.1,
    },
    meta: {
        generation: 0,
        parentAddress: '',
        fitness: 0,
        birthEpoch: 0,
        qTableHash: '',
    },
};
