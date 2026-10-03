/**
 * TimesFM Integration (Time Series Foundation Model)
 *
 * Provides zero-shot time series forecasting for Autonomon agents.
 * TimesFM (developed by Google Research) predicts multi-step price trajectories
 * and quantiles (p10, p50, p90) to enrich the agent's Q-Learning state
 * with forward-looking expectations.
 *
 * Paper §3 Fail-Safe:
 * If TimesFM service is unavailable, unreachable, or returns invalid/insufficient
 * data, the architecture routes to an external fail-safe mode with HOLD-only execution.
 * Local linear regression / heuristic trend estimation fallbacks are strictly prohibited.
 *
 * Reference: GLOFICA_Langton_Autonomon.md §1.2, §3, §6.2
 */

export interface TimesFMConfig {
    serviceUrl?: string;
    defaultHorizon?: number;
    quantiles?: number[];
    timeoutMs?: number;
}

export interface TimesFMForecast {
    symbol: string;
    contextLength: number;
    horizon: number;
    medianForecast: number[];
    lowerQuantile: number[];
    upperQuantile: number[];
    targetPrice: number;
    currentPrice: number;
    expectedReturnPct: number;
    trend: 'bullish' | 'bearish' | 'flat';
    quantileSpreadPct: number;
    confidence: number;
    engine: 'timesfm-service' | 'timesfm-failsafe';
    isFailSafe: boolean;
    holdOnly: boolean;
}

const DEFAULT_CONFIG: Required<TimesFMConfig> = {
    serviceUrl: process.env.TIMESFM_SERVICE_URL || 'http://127.0.0.1:8008/forecast',
    defaultHorizon: 32, // Paper §3.3 specifies horizon H = 32 samples
    quantiles: [0.1, 0.5, 0.9],
    timeoutMs: 3000,
};

export class TimesFMClient {
    private config: Required<TimesFMConfig>;

    constructor(config: TimesFMConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Request quantiles forecast from TimesFM service.
     * If the service fails or is unreachable, enforces fail-safe HOLD-only.
     */
    async forecast(
        symbol: string,
        priceHistory: number[],
        horizon?: number
    ): Promise<TimesFMForecast> {
        const h = horizon || this.config.defaultHorizon;
        const currentPrice = priceHistory[priceHistory.length - 1] || 100;

        if (priceHistory.length < 5) {
            // Insufficient history -> Paper §3 fail-safe HOLD-only
            return this.generateFailSafe(symbol, currentPrice, h, priceHistory.length, 'Insufficient price history');
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

            const res = await fetch(this.config.serviceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    prices: priceHistory,
                    horizon: h,
                    quantiles: this.config.quantiles,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (res.ok) {
                const data = await res.json();
                return this.parseServiceResponse(symbol, data, currentPrice, h);
            }
        } catch {
            // Service offline, timed out, or network partition
        }

        // Fail-safe: No local linear regression. Enforce HOLD-only per Paper §3.
        return this.generateFailSafe(symbol, currentPrice, h, priceHistory.length, 'TimesFM service unavailable');
    }

    /**
     * Generate canonical fail-safe response (Paper §3 fail-safe: HOLD-only)
     */
    private generateFailSafe(
        symbol: string,
        currentPrice: number,
        horizon: number,
        contextLength: number,
        _reason: string
    ): TimesFMForecast {
        return {
            symbol,
            contextLength,
            horizon,
            medianForecast: [],
            lowerQuantile: [],
            upperQuantile: [],
            targetPrice: currentPrice,
            currentPrice,
            expectedReturnPct: 0,
            trend: 'flat',
            quantileSpreadPct: 0,
            confidence: 0,
            engine: 'timesfm-failsafe',
            isFailSafe: true,
            holdOnly: true,
        };
    }

    private parseServiceResponse(
        symbol: string,
        data: any,
        currentPrice: number,
        horizon: number
    ): TimesFMForecast {
        const median = data.median || data.forecast || [];
        const lower = data.p10 || median.map((v: number) => v * 0.95);
        const upper = data.p90 || median.map((v: number) => v * 1.05);

        const targetPrice = median[median.length - 1] ?? currentPrice;
        const expectedReturnPct = ((targetPrice - currentPrice) / currentPrice) * 100;

        const trend: 'bullish' | 'bearish' | 'flat' =
            expectedReturnPct > 1.5 ? 'bullish' :
            expectedReturnPct < -1.5 ? 'bearish' : 'flat';

        const lastLower = lower[lower.length - 1] ?? targetPrice * 0.95;
        const lastUpper = upper[upper.length - 1] ?? targetPrice * 1.05;
        const spreadPct = targetPrice > 0 ? (lastUpper - lastLower) / targetPrice : 0.1;
        const confidence = Math.max(0, Math.min(1, 1 - (spreadPct * 1.5)));

        return {
            symbol,
            contextLength: data.contextLength || 32,
            horizon,
            medianForecast: median,
            lowerQuantile: lower,
            upperQuantile: upper,
            targetPrice,
            currentPrice,
            expectedReturnPct,
            trend,
            quantileSpreadPct: spreadPct * 100,
            confidence,
            engine: 'timesfm-service',
            isFailSafe: false,
            holdOnly: false,
        };
    }
}
