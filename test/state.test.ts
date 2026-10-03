import { describe, it, expect } from 'vitest';
import {
    TREND_CATEGORIES,
    RSI_CATEGORIES,
    FORECAST_CATEGORIES,
    VOLATILITY_CATEGORIES,
    POSITION_CATEGORIES,
    HEALTH_CATEGORIES,
    TOTAL_STATE_COUNT,
    getAllStateKeys,
    discretizeTrend,
    discretizeRSI,
    discretizeForecast,
    discretizeVolatility,
    discretizePosition,
    discretizeHealth,
    discretize,
    stateToKey,
} from '../src/rl/state.js';

describe('Paper §3 State Space and Discretization', () => {
    it('has exactly 6 coordinates with the exact cardinalities from paper §3', () => {
        expect(TREND_CATEGORIES).toHaveLength(5);
        expect(RSI_CATEGORIES).toHaveLength(3);
        expect(FORECAST_CATEGORIES).toHaveLength(4);
        expect(VOLATILITY_CATEGORIES).toHaveLength(3);
        expect(POSITION_CATEGORIES).toHaveLength(4);
        expect(HEALTH_CATEGORIES).toHaveLength(3);

        const calculated =
            TREND_CATEGORIES.length *
            RSI_CATEGORIES.length *
            FORECAST_CATEGORIES.length *
            VOLATILITY_CATEGORIES.length *
            POSITION_CATEGORIES.length *
            HEALTH_CATEGORIES.length;

        expect(calculated).toBe(2160);
        expect(TOTAL_STATE_COUNT).toBe(2160);
    });

    it('generates exactly 2160 unique discrete state keys', () => {
        const keys = getAllStateKeys();
        expect(keys.length).toBe(2160);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(2160);
    });

    it('classifies Trend per §3.1 thresholds', () => {
        expect(discretizeTrend(2.5)).toBe('STRONG_UP');
        expect(discretizeTrend(2.0)).toBe('UP');
        expect(discretizeTrend(0.51)).toBe('UP');
        expect(discretizeTrend(0.50)).toBe('FLAT');
        expect(discretizeTrend(0.0)).toBe('FLAT');
        expect(discretizeTrend(-0.50)).toBe('FLAT');
        expect(discretizeTrend(-0.51)).toBe('DOWN');
        expect(discretizeTrend(-2.0)).toBe('DOWN');
        expect(discretizeTrend(-2.01)).toBe('STRONG_DOWN');
    });

    it('classifies RSI per §3.2 thresholds and validates range', () => {
        expect(discretizeRSI(29.9)).toBe('OVERSOLD');
        expect(discretizeRSI(30)).toBe('NEUTRAL');
        expect(discretizeRSI(50)).toBe('NEUTRAL');
        expect(discretizeRSI(70)).toBe('NEUTRAL');
        expect(discretizeRSI(70.1)).toBe('OVERBOUGHT');

        expect(() => discretizeRSI(-1)).toThrow();
        expect(() => discretizeRSI(101)).toThrow();
    });

    it('classifies Forecast per §3.3 thresholds', () => {
        // High uncertainty takes precedence: Ut >= 0.05
        expect(discretizeForecast({ Ut: 0.05, Dt: 0.05 })).toBe('VOLATILE_UNCERTAINTY');
        expect(discretizeForecast({ Ut: 0.06, Dt: 0.0 })).toBe('VOLATILE_UNCERTAINTY');

        // Low uncertainty (Ut < 0.05)
        expect(discretizeForecast({ Ut: 0.02, Dt: 0.016 })).toBe('BULLISH_EXPANSION');
        expect(discretizeForecast({ Ut: 0.02, Dt: -0.016 })).toBe('BEARISH_EXPANSION');
        expect(discretizeForecast({ Ut: 0.02, Dt: 0.015 })).toBe('TIGHT_RANGE');
        expect(discretizeForecast({ Ut: 0.02, Dt: -0.015 })).toBe('TIGHT_RANGE');
        expect(discretizeForecast({ Ut: 0.02, Dt: 0.0 })).toBe('TIGHT_RANGE');
    });

    it('classifies Volatility per §3.4 thresholds', () => {
        expect(discretizeVolatility(0.009)).toBe('LOW');
        expect(discretizeVolatility(0.01)).toBe('MEDIUM');
        expect(discretizeVolatility(0.025)).toBe('MEDIUM');
        expect(discretizeVolatility(0.03)).toBe('HIGH');
        expect(discretizeVolatility(0.05)).toBe('HIGH');
    });

    it('classifies Position per §3.5 priority', () => {
        // Flat if exposure <= 0.05
        expect(discretizePosition({ exposureRatio: 0.03, isHedged: true })).toBe('FLAT');
        expect(discretizePosition({ exposureRatio: 0.05 })).toBe('FLAT');

        // Hedged if exposure > 0.05 and isHedged
        expect(discretizePosition({ exposureRatio: 0.30, isHedged: true })).toBe('HEDGED');

        // Light long if exposure <= 0.50
        expect(discretizePosition({ exposureRatio: 0.20, isHedged: false })).toBe('LIGHT_LONG');
        expect(discretizePosition({ exposureRatio: 0.50, isHedged: false })).toBe('LIGHT_LONG');

        // Heavy long if exposure > 0.50
        expect(discretizePosition({ exposureRatio: 0.51, isHedged: false })).toBe('HEAVY_LONG');
    });

    it('classifies Health per §3.6 thresholds', () => {
        // CRITICAL if rho < 1 or disk >= 0.85
        expect(discretizeHealth({ runwayMonths: 0.8, diskUtilization: 0.2 })).toBe('CRITICAL');
        expect(discretizeHealth({ runwayMonths: 5, diskUtilization: 0.86 })).toBe('CRITICAL');

        // RESTRICTED if rho < 3 or disk >= 0.70
        expect(discretizeHealth({ runwayMonths: 2.5, diskUtilization: 0.3 })).toBe('RESTRICTED');
        expect(discretizeHealth({ runwayMonths: 4, diskUtilization: 0.72 })).toBe('RESTRICTED');

        // SOLVENT if rho >= 3 and disk < 0.70
        expect(discretizeHealth({ runwayMonths: 3.0, diskUtilization: 0.69 })).toBe('SOLVENT');
        expect(discretizeHealth({ runwayMonths: 10, diskUtilization: 0.15 })).toBe('SOLVENT');
    });

    it('end-to-end discretize produces valid state and key', () => {
        const state = discretize({
            price: 100,
            rsi: 45,
            u_t: 1.2,
            forecastUt: 0.02,
            forecastDt: 0.02,
            volatility: 0.015,
            exposureRatio: 0.2,
            runwayMonths: 4.5,
            diskUtilization: 0.25,
        });

        expect(state).toEqual({
            trend: 'UP',
            rsi: 'NEUTRAL',
            forecast: 'BULLISH_EXPANSION',
            volatility: 'MEDIUM',
            position: 'LIGHT_LONG',
            health: 'SOLVENT',
        });

        expect(stateToKey(state)).toBe('UP|NEUTRAL|BULLISH_EXPANSION|MEDIUM|LIGHT_LONG|SOLVENT');
    });
});
