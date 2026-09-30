/**
 * Langton State Discretization — Enriched with TimesFM
 *
 * Converts continuous market observations and TimesFM foundation forecasts
 * into discrete states for Q-Learning.
 */

export type PriceTrend = 'up' | 'down' | 'flat';
export type RSIBucket = 'oversold' | 'neutral' | 'overbought';
export type VolumeTrend = 'rising' | 'falling' | 'stable';
export type Position = 'none' | 'long' | 'short';
export type BalanceBucket = 'low' | 'medium' | 'high';
export type MarketRegime = 'bull' | 'bear' | 'sideways';

// TimesFM Foundation State Dimensions
export type ForecastTrend = 'f_bull' | 'f_bear' | 'f_flat';
export type ForecastConfidence = 'c_high' | 'c_med' | 'c_low';

export interface MarketObservation {
    /** Current price (raw) */
    price: number;
    /** Previous price (for short-term momentum) */
    previousPrice: number;
    /** RSI indicator (0–100) */
    rsi: number;
    /** Current volume */
    volume: number;
    /** Previous volume */
    previousVolume: number;
    /** Current position type */
    position: Position;
    /** Current XGO balance */
    balance: number;
    /** 30-period price change percentage */
    priceChange30: number;

    // ── TimesFM Predictive Inputs ──
    /** TimesFM projected trend */
    forecastTrend?: 'bullish' | 'bearish' | 'flat';
    /** TimesFM quantile confidence (0.0 to 1.0) */
    forecastConfidence?: number;
    /** TimesFM expected percentage return */
    expectedReturnPct?: number;
}

export interface DiscreteState {
    priceTrend: PriceTrend;
    rsiBucket: RSIBucket;
    volumeTrend: VolumeTrend;
    position: Position;
    balanceBucket: BalanceBucket;
    marketRegime: MarketRegime;
    forecastTrend: ForecastTrend;
    forecastConfidence: ForecastConfidence;
}

/**
 * Discretize a continuous market observation + TimesFM forecast into a state.
 */
export function discretize(obs: MarketObservation): DiscreteState {
    // Price trend (immediate delta)
    const priceChangePct = obs.previousPrice > 0
        ? (obs.price - obs.previousPrice) / obs.previousPrice
        : 0;
    const priceTrend: PriceTrend =
        priceChangePct > 0.01 ? 'up' :
        priceChangePct < -0.01 ? 'down' : 'flat';

    // RSI buckets
    const rsiBucket: RSIBucket =
        obs.rsi < 30 ? 'oversold' :
        obs.rsi > 70 ? 'overbought' : 'neutral';

    // Volume trend
    const volumeChangePct = obs.previousVolume > 0
        ? (obs.volume - obs.previousVolume) / obs.previousVolume
        : 0;
    const volumeTrend: VolumeTrend =
        volumeChangePct > 0.1 ? 'rising' :
        volumeChangePct < -0.1 ? 'falling' : 'stable';

    // Balance buckets (relative to XGO thresholds)
    const balanceBucket: BalanceBucket =
        obs.balance < 100 ? 'low' :
        obs.balance < 1000 ? 'medium' : 'high';

    // Market regime (30-period macro window)
    const marketRegime: MarketRegime =
        obs.priceChange30 > 5 ? 'bull' :
        obs.priceChange30 < -5 ? 'bear' : 'sideways';

    // TimesFM Foundation Forecast
    const ft = obs.forecastTrend || 'flat';
    const forecastTrend: ForecastTrend =
        ft === 'bullish' ? 'f_bull' :
        ft === 'bearish' ? 'f_bear' : 'f_flat';

    const fc = obs.forecastConfidence ?? 0.5;
    const forecastConfidence: ForecastConfidence =
        fc >= 0.75 ? 'c_high' :
        fc >= 0.50 ? 'c_med' : 'c_low';

    return {
        priceTrend,
        rsiBucket,
        volumeTrend,
        position: obs.position,
        balanceBucket,
        marketRegime,
        forecastTrend,
        forecastConfidence,
    };
}

/**
 * Convert a discrete state to a string key for the Q-table.
 */
export function stateToKey(state: DiscreteState): string {
    return `${state.priceTrend}|${state.rsiBucket}|${state.volumeTrend}|${state.position}|${state.balanceBucket}|${state.marketRegime}|${state.forecastTrend}|${state.forecastConfidence}`;
}

/**
 * Observe market + TimesFM and return state key for Q-Learning.
 */
export function observeState(obs: MarketObservation): string {
    return stateToKey(discretize(obs));
}
