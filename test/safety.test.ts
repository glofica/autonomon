import { describe, it, expect } from 'vitest';
import { SafetyLayer, type ExecutionSnapshot } from '../src/safety/safetyLayer.js';
import { DEFAULT_GENOME } from '../src/genome/types.js';

describe('Paper §6 Execution Safety Layer', () => {
    const safety = new SafetyLayer();
    const now = 1700000000000;

    const baseSnapshot: ExecutionSnapshot = {
        balanceGasXgo: 500,
        pendingGasReservationsXgo: 0,
        navUsd: 10000,
        instrumentExposuresUsd: { 'WR-CU-001': 1000 },
        runwayMonths: 6.0,
        trailingDrawdownPct: 0.05,
        oracleTimestampMs: now - 5000, // 5s fresh
        currentTimestampMs: now,
        marketDepthUsd: 50000,
    };

    it('admits valid transaction when all Paper §6 invariants are satisfied', () => {
        const result = safety.evaluate(baseSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
            instrument: 'WR-CU-001',
            tradeSpendXgo: 10,
            maxFeeXgo: 0.01,
            orderValueUsd: 500, // post-trade exposure 1500 / 10000 = 15% <= g_omega 20%
            expectedSlippagePct: 0.002, // 0.2%
        });

        expect(result.admissible).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.admissibleActions).toContain('ACQUIRE_SPOT');
        expect(result.admissibleActions).toContain('HOLD');
    });

    it('enforces gas reserve invariant B - L - C >= g_gas (§6)', () => {
        // g_gas is 250 XGO in DEFAULT_GENOME. Balance is 300.
        // If trade spend L is 60 XGO -> remaining is 300 - 60 - 0.01 = 239.99 < 250
        const tightSnapshot: ExecutionSnapshot = {
            ...baseSnapshot,
            balanceGasXgo: 300,
        };

        const result = safety.evaluate(tightSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
            tradeSpendXgo: 60,
        });

        expect(result.admissible).toBe(false);
        expect(result.violations.some(v => v.includes('[GasReserve]'))).toBe(true);
    });

    it('enforces concentration cap E_i / V <= g_ω (§6)', () => {
        // g_omega is 0.20 (20%). NAV is 10,000 USD.
        // Current exposure is 1,000 USD. Proposing +1,500 USD order -> 2,500 USD / 10,000 = 25% > 20%
        const result = safety.evaluate(baseSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
            instrument: 'WR-CU-001',
            orderValueUsd: 1500,
        });

        expect(result.admissible).toBe(false);
        expect(result.violations.some(v => v.includes('[ConcentrationCap]'))).toBe(true);
    });

    it('enforces funded runway critical threshold rho_t >= 1.0 (§3.6, §6)', () => {
        const criticalSnapshot: ExecutionSnapshot = {
            ...baseSnapshot,
            runwayMonths: 0.8, // Critical
        };

        const result = safety.evaluate(criticalSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
        });

        expect(result.admissible).toBe(false);
        expect(result.violations.some(v => v.includes('[RunwayCritical]'))).toBe(true);
        // Risk increasing actions removed from admissible set
        expect(result.admissibleActions).not.toContain('ACQUIRE_SPOT');
        expect(result.admissibleActions).toContain('HOLD');
    });

    it('trips 15% drawdown circuit breaker with 4-hour lockout (§6.2)', () => {
        const breakerSnapshot: ExecutionSnapshot = {
            ...baseSnapshot,
            trailingDrawdownPct: 0.16, // 16% >= 15%
        };

        const result = safety.evaluate(breakerSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
        });

        expect(result.isBreakerActive).toBe(true);
        expect(result.admissible).toBe(false);
        expect(result.violations.some(v => v.includes('[CircuitBreaker]'))).toBe(true);
        expect(result.admissibleActions).not.toContain('ACQUIRE_SPOT');
        expect(result.admissibleActions).toContain('HOLD');
    });

    it('rejects stale oracle feeds beyond max freshness threshold (§6.2)', () => {
        const staleSnapshot: ExecutionSnapshot = {
            ...baseSnapshot,
            oracleTimestampMs: now - 90000, // 90 seconds old > 60s
        };

        const result = safety.evaluate(staleSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
        });

        expect(result.admissible).toBe(false);
        expect(result.violations.some(v => v.includes('[OracleStale]'))).toBe(true);
    });

    it('enforces slippage and market depth liquidity constraints', () => {
        // Slippage 1.5% > 1%
        const highSlippage = safety.evaluate(baseSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
            expectedSlippagePct: 0.015,
        });
        expect(highSlippage.violations.some(v => v.includes('[SlippageExceeded]'))).toBe(true);

        // Order value 15,000 USD on 50,000 depth = 30% > 20%
        const highDepth = safety.evaluate(baseSnapshot, DEFAULT_GENOME, {
            action: 'ACQUIRE_SPOT',
            orderValueUsd: 15000,
        });
        expect(highDepth.violations.some(v => v.includes('[InsufficientLiquidity]'))).toBe(true);
    });
});
