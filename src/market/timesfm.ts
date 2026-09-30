/**
 * TimesFM Integration (Time Series Foundation Model)
 *
 * Provides zero-shot time series forecasting for Autonomon agents.
 * TimesFM (developed by Google Research) predicts multi-step price trajectories
 * and quantiles (p10, p50, p90) to enrich the agent's Q-Learning state
 * with forward-looking expectations rather than purely backward-looking indicators.
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
    engine: 'timesfm-service' | 'timesfm-fallback-estimator';
}

const DEFAULT_CONFIG: Required<TimesFMConfig> = {
    serviceUrl: process.env.TIMESFM_SERVICE_URL || 'http://127.0.0.1:8008/forecast',
    defaultHorizon: 24,
    quantiles: [0.1, 0.5, 0.9],
    timeoutMs: 3000,
};

export class TimesFMClient {
    private config: Required<TimesFMConfig>;

    constructor(config: TimesFMConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    async forecast(
        symbol: string,
        priceHistory: number[],
        horizon?: number
    ): Promise<TimesFMForecast> {
        const h = horizon || this.config.defaultHorizon;
        const currentPrice = priceHistory[priceHistory.length - 1] || 100;

        if (priceHistory.length < 5) {
            return this.generateFallbackForecast(symbol, priceHistory, h, currentPrice);
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
            // Service offline or timeout -> use local mathematical estimator
        }

        return this.generateFallbackForecast(symbol, priceHistory, h, currentPrice);
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
        };
    }

    private generateFallbackForecast(
        symbol: string,
        history: number[],
        horizon: number,
        currentPrice: number
    ): TimesFMForecast {
        const n = history.length;
        const window = history.slice(-Math.min(n, 30));

        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        const m = window.length;
        for (let i = 0; i < m; i++) {
            sumX += i;
            sumY += window[i];
            sumXY += i * window[i];
            sumXX += i * i;
        }
        const slope = (m * sumXY - sumX * sumY) / (m * sumXX - sumX * sumX || 1);

        let returnSum = 0;
        const returns: number[] = [];
        for (let i = 1; i < m; i++) {
            const r = (window[i] - window[i - 1]) / window[i - 1];
            returns.push(r);
            returnSum += r;
        }
        const meanReturn = returnSum / (returns.length || 1);
        const variance = returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / (returns.length || 1);
        const vol = Math.sqrt(variance);

        const medianForecast: number[] = [];
        const lowerQuantile: number[] = [];
        const upperQuantile: number[] = [];

        for (let step = 1; step <= horizon; step++) {
            const dampening = Math.exp(-step / 40);
            const projected = currentPrice + (slope * step * dampening);
            const uncertainty = vol * Math.sqrt(step) * currentPrice * 1.645;

            medianForecast.push(Number(projected.toFixed(2)));
            lowerQuantile.push(Number(Math.max(0, projected - uncertainty).toFixed(2)));
            upperQuantile.push(Number((projected + uncertainty).toFixed(2)));
        }

        const targetPrice = medianForecast[medianForecast.length - 1];
        const expectedReturnPct = ((targetPrice - currentPrice) / currentPrice) * 100;

        const trend: 'bullish' | 'bearish' | 'flat' =
            expectedReturnPct > 1.2 ? 'bullish' :
            expectedReturnPct < -1.2 ? 'bearish' : 'flat';

        const lastLower = lowerQuantile[lowerQuantile.length - 1];
        const lastUpper = upperQuantile[upperQuantile.length - 1];
        const spreadPct = targetPrice > 0 ? (lastUpper - lastLower) / targetPrice : 0.1;
        const confidence = Math.max(0.1, Math.min(0.95, 1 - (spreadPct * 1.2)));

        return {
            symbol,
            contextLength: window.length,
            horizon,
            medianForecast,
            lowerQuantile,
            upperQuantile,
            targetPrice,
            currentPrice,
            expectedReturnPct,
            trend,
            quantileSpreadPct: spreadPct * 100,
            confidence,
            engine: 'timesfm-fallback-estimator',
        };
    }
}
