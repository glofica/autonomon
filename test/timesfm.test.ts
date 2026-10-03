import { describe, it, expect } from 'vitest';
import { TimesFMClient } from '../src/market/timesfm.js';

describe('Paper §3 TimesFM Fail-Safe Behavior', () => {
    it('returns fail-safe HOLD-only forecast when service is unreachable', async () => {
        // Using non-existent port to simulate unreachable TimesFM service
        const client = new TimesFMClient({
            serviceUrl: 'http://127.0.0.1:59999/forecast',
            timeoutMs: 300,
        });

        const history = [100, 102, 101, 104, 106, 108];
        const forecast = await client.forecast('gGOLD', history, 32);

        expect(forecast.isFailSafe).toBe(true);
        expect(forecast.holdOnly).toBe(true);
        expect(forecast.engine).toBe('timesfm-failsafe');
        expect(forecast.trend).toBe('flat');
        expect(forecast.confidence).toBe(0);
        expect(forecast.expectedReturnPct).toBe(0);
        expect(forecast.medianForecast).toEqual([]);
    });

    it('returns fail-safe HOLD-only forecast when history is insufficient', async () => {
        const client = new TimesFMClient();
        const shortHistory = [100, 102];
        const forecast = await client.forecast('gGOLD', shortHistory, 32);

        expect(forecast.isFailSafe).toBe(true);
        expect(forecast.holdOnly).toBe(true);
        expect(forecast.engine).toBe('timesfm-failsafe');
    });

    it('has no local linear regression fallback methods', () => {
        const client = new TimesFMClient();
        expect((client as any).generateFallbackForecast).toBeUndefined();
    });
});
