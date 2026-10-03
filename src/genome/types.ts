/**
 * Langton Genome — Paper §7 Canonical Specification
 *
 * Paper §7 defines the genome as a 7-dimensional bounded vector:
 * g = (g_risk, g_τ, g_ε, g_α, g_gas, g_ω, g_mitosis) ∈ Ω = ∏_{i=1}^7 [l_i, u_i]
 *
 * Loci:
 * 1. g_risk:    [0.10, 5.00]   - Risk aversion (Safety-layer stress-loss budget scaling)
 * 2. g_tau:     [5, 60] min    - Sampling interval of input series
 * 3. g_epsilon: [0.05, 0.50]   - Initial exploration rate
 * 4. g_alpha:   [0.01, 0.25]   - Tracking step size (practical Q learning rate)
 * 5. g_gas:     [100, 1000]    - Protected gas reserve admission constraint in XGO
 * 6. g_omega:   [0.05, 0.40]   - Concentration cap (max per-instrument exposure ratio)
 * 7. g_mitosis: [1.50, 3.00]   - Reproduction multiple threshold
 *
 * Reference: GLOFICA_Langton_Autonomon.md §7
 */

export interface GenomeLocusDefinition {
    name: 'g_risk' | 'g_tau' | 'g_epsilon' | 'g_alpha' | 'g_gas' | 'g_omega' | 'g_mitosis';
    symbol: string;
    min: number;
    max: number;
    unit?: string;
    description: string;
}

/** The 7 exact loci defined in Paper §7 */
export const GENOME_LOCI: readonly GenomeLocusDefinition[] = [
    {
        name: 'g_risk',
        symbol: 'g_risk',
        min: 0.10,
        max: 5.00,
        description: 'Safety-layer stress-loss budget scaling',
    },
    {
        name: 'g_tau',
        symbol: 'g_τ',
        min: 5,
        max: 60,
        unit: 'minutes',
        description: 'Input series sampling interval',
    },
    {
        name: 'g_epsilon',
        symbol: 'g_ε',
        min: 0.05,
        max: 0.50,
        description: 'Initial exploration epsilon',
    },
    {
        name: 'g_alpha',
        symbol: 'g_α',
        min: 0.01,
        max: 0.25,
        description: 'Practical Q learning rate',
    },
    {
        name: 'g_gas',
        symbol: 'g_gas',
        min: 100,
        max: 1000,
        unit: 'XGO',
        description: 'Protected gas reserve admission constraint',
    },
    {
        name: 'g_omega',
        symbol: 'g_ω',
        min: 0.05,
        max: 0.40,
        description: 'Maximum per-instrument exposure ratio',
    },
    {
        name: 'g_mitosis',
        symbol: 'g_mitosis',
        min: 1.50,
        max: 3.00,
        description: 'Reproduction multiple threshold',
    },
] as const;

/** Canonical numerical genome of the 7 loci */
export interface NumericGenome {
    g_risk: number;
    g_tau: number;
    g_epsilon: number;
    g_alpha: number;
    g_gas: number;
    g_omega: number;
    g_mitosis: number;
}

// ── Legacy Compatibility Modules ──

export interface RiskModule {
    riskTolerance: number;
    stopLossPct: number;
    maxPositionPct: number;
}

export interface MarketModule {
    preferredProducts: string[];
    sectorWeights: Record<string, number>;
}

export type EntryStrategy = 'momentum' | 'contrarian' | 'mean_reversion' | 'breakout' | 'dca';
export type HoldingPeriod = 'short' | 'medium' | 'long';

export interface TemporalModule {
    rebalanceFreqHours: number;
    entryStrategy: EntryStrategy;
    holdingPeriod: HoldingPeriod;
}

export interface ForecastModule {
    useTimesFM: boolean;
    forecastHorizon: number;
    minConfidence: number;
    forecastWeight: number;
}

export type SoulPersonality = 'analytical' | 'risk_seeking' | 'conservative' | 'contrarian' | 'stoic';

export interface SoulModule {
    personality: SoulPersonality;
    model: string;
    temperature: number;
    reflectionDepth: number;
}

export interface SocialModule {
    cooperationLevel: number;
    signalTrust: number;
    poolWillingness: number;
}

export interface ReproductionModule {
    spawnThresholdXGO: number;
    childFundPct: number;
    mutationRate: number;
    parentRoyaltyPct: number;
}

export interface MetaModule {
    generation: number;
    parentAddress: string;
    fitness: number;
    birthEpoch: number;
    qTableHash: string;
}

/** Complete Langton Genome with the 7 canonical loci and runtime extensions */
export interface LangtonGenome extends NumericGenome {
    risk: RiskModule;
    market: MarketModule;
    temporal: TemporalModule;
    forecast: ForecastModule;
    soul: SoulModule;
    social: SocialModule;
    reproduction: ReproductionModule;
    meta: MetaModule;
}

/** Clip a genome to the canonical bounded box Omega per Proposition 5 */
export function clipGenomeToBox(g: NumericGenome): NumericGenome {
    return {
        g_risk: Math.max(0.10, Math.min(5.00, g.g_risk)),
        g_tau: Math.max(5, Math.min(60, g.g_tau)),
        g_epsilon: Math.max(0.05, Math.min(0.50, g.g_epsilon)),
        g_alpha: Math.max(0.01, Math.min(0.25, g.g_alpha)),
        g_gas: Math.max(100, Math.min(1000, g.g_gas)),
        g_omega: Math.max(0.05, Math.min(0.40, g.g_omega)),
        g_mitosis: Math.max(1.50, Math.min(3.00, g.g_mitosis)),
    };
}

/** Default Seed Genome centered in valid parameter space */
export const DEFAULT_GENOME: LangtonGenome = {
    // 7 Canonical Loci (Paper §7)
    g_risk: 1.00,       // [0.10, 5.00]
    g_tau: 15,          // [5, 60] minutes
    g_epsilon: 0.30,    // [0.05, 0.50]
    g_alpha: 0.10,      // [0.01, 0.25]
    g_gas: 250,         // [100, 1000] XGO
    g_omega: 0.20,      // [0.05, 0.40]
    g_mitosis: 2.00,    // [1.50, 3.00]

    // Compatible runtime extensions
    risk: {
        riskTolerance: 1.00,
        stopLossPct: 0.08,
        maxPositionPct: 0.20,
    },
    market: {
        preferredProducts: ['WR-CU-001', 'WR-REE-006', 'WR-AL-002', 'WR-ZN-003'],
        sectorWeights: { copper: 0.40, rare_earths: 0.30, aluminum: 0.20, zinc: 0.10 },
    },
    temporal: {
        rebalanceFreqHours: 12,
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
        cooperationLevel: 0.4,
        signalTrust: 0.3,
        poolWillingness: 0.2,
    },
    reproduction: {
        spawnThresholdXGO: 500,
        childFundPct: 0.20,
        mutationRate: 0.15,
        parentRoyaltyPct: 0.08,
    },
    meta: {
        generation: 0,
        parentAddress: '',
        fitness: 100.0,
        birthEpoch: 0,
        qTableHash: '',
    },
};
