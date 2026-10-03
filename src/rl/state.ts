/**
 * Langton State Discretization — Paper §3 Canonical Implementation
 *
 * Implements the 6-coordinate observation discretization:
 * S = S_trend × S_rsi × S_forecast × S_vol × S_pos × S_health
 * Total cardinality: |S| = 5 × 3 × 4 × 3 × 4 × 3 = 2160 states.
 *
 * Reference: GLOFICA_Langton_Autonomon.md §3.1 – §3.7
 */

// ── 1. Coordinate Categories & Types ──

/** §3.1 Trend (5 categories) */
export type TrendCategory = 'STRONG_UP' | 'UP' | 'FLAT' | 'DOWN' | 'STRONG_DOWN';
export const TREND_CATEGORIES: readonly TrendCategory[] = [
    'STRONG_UP',
    'UP',
    'FLAT',
    'DOWN',
    'STRONG_DOWN',
] as const;

/** §3.2 Momentum / RSI (3 categories) */
export type RSICategory = 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
export const RSI_CATEGORIES: readonly RSICategory[] = [
    'OVERSOLD',
    'NEUTRAL',
    'OVERBOUGHT',
] as const;

/** §3.3 Forecast (4 categories) */
export type ForecastCategory =
    | 'VOLATILE_UNCERTAINTY'
    | 'BULLISH_EXPANSION'
    | 'BEARISH_EXPANSION'
    | 'TIGHT_RANGE';
export const FORECAST_CATEGORIES: readonly ForecastCategory[] = [
    'VOLATILE_UNCERTAINTY',
    'BULLISH_EXPANSION',
    'BEARISH_EXPANSION',
    'TIGHT_RANGE',
] as const;

/** §3.4 Realized Volatility (3 categories) */
export type VolatilityCategory = 'LOW' | 'MEDIUM' | 'HIGH';
export const VOLATILITY_CATEGORIES: readonly VolatilityCategory[] = [
    'LOW',
    'MEDIUM',
    'HIGH',
] as const;

/** §3.5 Inventory / Position (4 categories) */
export type PositionCategory = 'FLAT' | 'HEDGED' | 'LIGHT_LONG' | 'HEAVY_LONG';
export const POSITION_CATEGORIES: readonly PositionCategory[] = [
    'FLAT',
    'HEDGED',
    'LIGHT_LONG',
    'HEAVY_LONG',
] as const;

/** §3.6 Operational Health (3 categories) */
export type HealthCategory = 'CRITICAL' | 'RESTRICTED' | 'SOLVENT';
export const HEALTH_CATEGORIES: readonly HealthCategory[] = [
    'CRITICAL',
    'RESTRICTED',
    'SOLVENT',
] as const;

/** Total state cardinality: 5 × 3 × 4 × 3 × 4 × 3 = 2160 */
export const TOTAL_STATE_COUNT =
    TREND_CATEGORIES.length *
    RSI_CATEGORIES.length *
    FORECAST_CATEGORIES.length *
    VOLATILITY_CATEGORIES.length *
    POSITION_CATEGORIES.length *
    HEALTH_CATEGORIES.length; // 2160

// Legacy aliases for backward compatibility if needed
export type PriceTrend = TrendCategory;
export type RSIBucket = RSICategory;
export type VolumeTrend = 'rising' | 'falling' | 'stable';
export type Position = 'none' | 'long' | 'short' | PositionCategory;
export type BalanceBucket = 'low' | 'medium' | 'high';
export type MarketRegime = 'bull' | 'bear' | 'sideways';
export type ForecastTrend = 'f_bull' | 'f_bear' | 'f_flat' | 'bullish' | 'bearish' | 'flat';
export type ForecastConfidence = 'c_high' | 'c_med' | 'c_low';

// ── 2. Discrete State Interface ──

export interface DiscreteState {
    trend: TrendCategory;
    rsi: RSICategory;
    forecast: ForecastCategory;
    volatility: VolatilityCategory;
    position: PositionCategory;
    health: HealthCategory;
}

// ── 3. Market Observation Interface ──

export interface MarketObservation {
    /** Current price P_t > 0 */
    price: number;
    /** Previous price (optional) */
    previousPrice?: number;
    /** Historical return samples (N >= 2) for statistical derivation */
    returns?: number[];
    /** Direct normalized trend statistic u_t (§3.1) */
    u_t?: number;
    /** RSI indicator value in [0, 100] (§3.2) */
    rsi: number;
    /** Quantiles forecast at H=32 (q10, q50, q90) (§3.3) */
    q10?: number;
    q50?: number;
    q90?: number;
    /** Direct forecast width U_t and drift D_t (§3.3) */
    forecastUt?: number;
    forecastDt?: number;
    /** Realized volatility sigma_t (§3.4) */
    volatility?: number;
    /** Inventory exposure ratio e_t = exposure / NAV (§3.5) */
    exposureRatio?: number;
    /** Hedge predicate H_t (§3.5) */
    isHedged?: boolean;
    /** Funded runway in months rho_t = R_exec / c_t (§3.6) */
    runwayMonths?: number;
    /** Disk utilization d_t in [0, 1] (§3.6) */
    diskUtilization?: number;

    // Optional legacy fields for seamless caller compatibility
    balance?: number;
    position?: Position;
    volume?: number;
    previousVolume?: number;
    priceChange30?: number;
    forecastTrend?: ForecastTrend;
    forecastConfidence?: number;
    expectedReturnPct?: number;
}

// ── 4. Coordinate Discretization Functions (§3.1 – §3.6) ──

/**
 * §3.1 Compute normalized trend statistic u_t = (sqrt(N) * mu) / max(sigma, sigma_floor)
 */
export function computeTrendStatistic(returns: number[], sigmaFloor: number = 1e-6): number {
    const N = returns.length;
    if (N < 2) return 0;
    const mu = returns.reduce((acc, r) => acc + r, 0) / N;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - mu, 2), 0) / N;
    const sigma = Math.sqrt(variance);
    return (Math.sqrt(N) * mu) / Math.max(sigma, sigmaFloor);
}

/**
 * §3.1 Classify Trend (5 categories)
 * - STRONG_UP: u_t > 2
 * - UP: 0.5 < u_t <= 2
 * - FLAT: -0.5 <= u_t <= 0.5
 * - DOWN: -2 <= u_t < -0.5
 * - STRONG_DOWN: u_t < -2
 */
export function discretizeTrend(u: number): TrendCategory {
    if (u > 2) return 'STRONG_UP';
    if (u > 0.5) return 'UP';
    if (u >= -0.5) return 'FLAT';
    if (u >= -2) return 'DOWN';
    return 'STRONG_DOWN';
}

/**
 * §3.2 Classify Momentum / RSI (3 categories)
 * - OVERSOLD: RSI < 30
 * - NEUTRAL: 30 <= RSI <= 70
 * - OVERBOUGHT: RSI > 70
 * Requirement: RSI must lie in [0, 100].
 */
export function discretizeRSI(rsi: number): RSICategory {
    if (rsi < 0 || rsi > 100 || !Number.isFinite(rsi)) {
        throw new Error(`[ObservationError] RSI must lie in [0, 100], got ${rsi}`);
    }
    if (rsi < 30) return 'OVERSOLD';
    if (rsi <= 70) return 'NEUTRAL';
    return 'OVERBOUGHT';
}

/**
 * §3.3 Classify Forecast (4 categories)
 * U_t = (q90 - q10) / q50
 * D_t = (q50 - P_t) / P_t
 * - VOLATILE_UNCERTAINTY: U_t >= 0.05
 * - BULLISH_EXPANSION: D_t > 0.015 (if U_t < 0.05)
 * - BEARISH_EXPANSION: D_t < -0.015 (if U_t < 0.05)
 * - TIGHT_RANGE: |D_t| <= 0.015 (if U_t < 0.05)
 */
export function discretizeForecast(params: {
    Ut: number;
    Dt: number;
}): ForecastCategory {
    if (params.Ut >= 0.05) return 'VOLATILE_UNCERTAINTY';
    if (params.Dt > 0.015) return 'BULLISH_EXPANSION';
    if (params.Dt < -0.015) return 'BEARISH_EXPANSION';
    return 'TIGHT_RANGE';
}

/**
 * §3.4 Compute realized volatility sigma_t = sqrt(N^-1 * sum((r_i - mu)^2))
 */
export function computeRealizedVolatility(returns: number[]): number {
    const N = returns.length;
    if (N < 2) return 0;
    const mu = returns.reduce((acc, r) => acc + r, 0) / N;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - mu, 2), 0) / N;
    return Math.sqrt(variance);
}

/**
 * §3.4 Classify Realized Volatility (3 categories)
 * - LOW: sigma_t < v1
 * - MEDIUM: v1 <= sigma_t < v2
 * - HIGH: sigma_t >= v2
 * Default thresholds: v1 = 0.01 (1%), v2 = 0.03 (3%)
 */
export const DEFAULT_VOLATILITY_THRESHOLDS = {
    v1: 0.01,
    v2: 0.03,
};

export function discretizeVolatility(
    sigma: number,
    v1: number = DEFAULT_VOLATILITY_THRESHOLDS.v1,
    v2: number = DEFAULT_VOLATILITY_THRESHOLDS.v2,
): VolatilityCategory {
    if (sigma < v1) return 'LOW';
    if (sigma < v2) return 'MEDIUM';
    return 'HIGH';
}

/**
 * §3.5 Classify Inventory / Position (4 categories)
 * Exposure ratio e_t = gross marked inventory exposure / NAV
 * Priority:
 * 1. FLAT if e_t <= e0
 * 2. HEDGED if H_t holds
 * 3. LIGHT_LONG if e_t <= e1
 * 4. HEAVY_LONG otherwise
 * Default thresholds: e0 = 0.05, e1 = 0.50
 */
export const DEFAULT_EXPOSURE_THRESHOLDS = {
    e0: 0.05,
    e1: 0.50,
};

export function discretizePosition(params: {
    exposureRatio: number;
    isHedged?: boolean;
    e0?: number;
    e1?: number;
}): PositionCategory {
    const e0 = params.e0 ?? DEFAULT_EXPOSURE_THRESHOLDS.e0;
    const e1 = params.e1 ?? DEFAULT_EXPOSURE_THRESHOLDS.e1;
    const et = params.exposureRatio;

    if (et <= e0) return 'FLAT';
    if (params.isHedged) return 'HEDGED';
    if (et <= e1) return 'LIGHT_LONG';
    return 'HEAVY_LONG';
}

/**
 * §3.6 Classify Operational Health (3 categories)
 * rho_t = R_exec / c_t (funded runway in months)
 * d_t in [0, 1] (disk utilization)
 * Fixed constants: d_R = 0.70, d_C = 0.85
 * - CRITICAL: rho_t < 1 or d_t >= d_C
 * - RESTRICTED: not CRITICAL and (rho_t < 3 or d_t >= d_R)
 * - SOLVENT: rho_t >= 3 and d_t < d_R
 */
export const DISK_THRESHOLDS = {
    dR: 0.70,
    dC: 0.85,
};

export function discretizeHealth(params: {
    runwayMonths: number;
    diskUtilization?: number;
    dR?: number;
    dC?: number;
}): HealthCategory {
    const rho = params.runwayMonths;
    const d = params.diskUtilization ?? 0.20; // default 20% healthy disk
    const dR = params.dR ?? DISK_THRESHOLDS.dR;
    const dC = params.dC ?? DISK_THRESHOLDS.dC;

    if (rho < 1 || d >= dC) {
        return 'CRITICAL';
    }
    if (rho < 3 || d >= dR) {
        return 'RESTRICTED';
    }
    return 'SOLVENT';
}

// ── 5. Full Observation Discretization ──

/**
 * Discretize a raw observation into the canonical 6-coordinate state per §3.
 */
export function discretize(obs: MarketObservation): DiscreteState {
    // 1. Trend (§3.1)
    let u = obs.u_t;
    if (u === undefined) {
        if (obs.returns && obs.returns.length >= 2) {
            u = computeTrendStatistic(obs.returns);
        } else if (obs.previousPrice !== undefined && obs.previousPrice > 0) {
            const ret = (obs.price - obs.previousPrice) / obs.previousPrice;
            // Single-step heuristic scaling: ret / 1%
            u = ret / 0.01;
        } else if (obs.priceChange30 !== undefined) {
            u = obs.priceChange30 / 2.5;
        } else {
            u = 0;
        }
    }
    const trend = discretizeTrend(u);

    // 2. RSI (§3.2)
    // Clamp slightly if within 0..100 boundary float jitter, or throw
    const rsiVal = Math.max(0, Math.min(100, obs.rsi));
    const rsi = discretizeRSI(rsiVal);

    // 3. Forecast (§3.3)
    let Ut = obs.forecastUt;
    let Dt = obs.forecastDt;
    if (Ut === undefined || Dt === undefined) {
        if (obs.q10 !== undefined && obs.q50 !== undefined && obs.q90 !== undefined && obs.q50 > 0 && obs.price > 0) {
            Ut = (obs.q90 - obs.q10) / obs.q50;
            Dt = (obs.q50 - obs.price) / obs.price;
        } else if (obs.expectedReturnPct !== undefined) {
            Dt = obs.expectedReturnPct / 100;
            const conf = obs.forecastConfidence ?? 0.5;
            Ut = conf < 0.3 ? 0.06 : 0.02;
        } else if (obs.forecastTrend) {
            const ft = obs.forecastTrend;
            const isBull = ft === 'bullish' || ft === 'f_bull';
            const isBear = ft === 'bearish' || ft === 'f_bear';
            Dt = isBull ? 0.02 : isBear ? -0.02 : 0;
            const conf = obs.forecastConfidence ?? 0.5;
            Ut = conf < 0.3 ? 0.06 : 0.02;
        } else {
            Ut = 0.01;
            Dt = 0;
        }
    }
    const forecast = discretizeForecast({ Ut, Dt });

    // 4. Volatility (§3.4)
    let vol = obs.volatility;
    if (vol === undefined) {
        if (obs.returns && obs.returns.length >= 2) {
            vol = computeRealizedVolatility(obs.returns);
        } else {
            vol = 0.015; // default moderate
        }
    }
    const volatility = discretizeVolatility(vol);

    // 5. Position (§3.5)
    let exposure = obs.exposureRatio;
    if (exposure === undefined) {
        if (obs.position === 'none' || obs.position === 'FLAT' || !obs.position) {
            exposure = 0;
        } else if (obs.position === 'HEDGED') {
            exposure = 0.3;
        } else if (obs.position === 'LIGHT_LONG' || obs.position === 'long') {
            exposure = 0.25;
        } else if (obs.position === 'HEAVY_LONG') {
            exposure = 0.75;
        } else {
            exposure = 0;
        }
    }
    const isHedged = obs.isHedged ?? (obs.position === 'HEDGED');
    const position = discretizePosition({ exposureRatio: exposure, isHedged });

    // 6. Health (§3.6)
    let runway = obs.runwayMonths;
    if (runway === undefined) {
        if (obs.balance !== undefined) {
            // Rough conversion: 1000 XGO / 150 XGO month = 6.66 months
            runway = obs.balance / 150;
        } else {
            runway = 12; // default healthy runway
        }
    }
    const health = discretizeHealth({
        runwayMonths: runway,
        diskUtilization: obs.diskUtilization,
    });

    return {
        trend,
        rsi,
        forecast,
        volatility,
        position,
        health,
    };
}

/**
 * Convert a discrete state tuple into a canonical string key.
 * Format: TREND|RSI|FORECAST|VOLATILITY|POSITION|HEALTH
 */
export function stateToKey(state: DiscreteState): string {
    return `${state.trend}|${state.rsi}|${state.forecast}|${state.volatility}|${state.position}|${state.health}`;
}

/**
 * Complete observation discretization pipeline -> canonical state key.
 */
export function observeState(obs: MarketObservation): string {
    return stateToKey(discretize(obs));
}

/**
 * Generate all 2160 nominal state keys of the Cartesian product:
 * S = S_trend × S_rsi × S_forecast × S_vol × S_pos × S_health
 */
export function getAllStateKeys(): string[] {
    const keys: string[] = [];
    for (const t of TREND_CATEGORIES) {
        for (const r of RSI_CATEGORIES) {
            for (const f of FORECAST_CATEGORIES) {
                for (const v of VOLATILITY_CATEGORIES) {
                    for (const p of POSITION_CATEGORIES) {
                        for (const h of HEALTH_CATEGORIES) {
                            keys.push(`${t}|${r}|${f}|${v}|${p}|${h}`);
                        }
                    }
                }
            }
        }
    }
    return keys;
}
