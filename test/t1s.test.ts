import { describe, it, expect } from 'vitest';
import { runSanityChecks } from '../tests/t1s/sanity-checks.js';
import { runOneSeed, DEFAULT_T1S_CONFIG } from '../tests/t1s/runner.js';
import { computeT1sMetrics } from '../tests/t1s/metrics.js';

describe('T1s — Execution Safety Layer Null Test Suite', () => {
    it('passes all 6 sanity checks (generator, hold, roundtrip, breaker, concentration, gas)', async () => {
        const sanity = await runSanityChecks();
        expect(sanity.allPassed).toBe(true);
        for (const check of sanity.checks) {
            expect(check.passed).toBe(true);
        }
    });

    it('enforces max drawdown < 15% on representative seeds', async () => {
        const result1 = await runOneSeed(1, { ...DEFAULT_T1S_CONFIG, stepsPerSeed: 1000 });
        expect(result1.maxDrawdown).toBeLessThan(0.15);

        const result12 = await runOneSeed(12, { ...DEFAULT_T1S_CONFIG, stepsPerSeed: 4000 });
        expect(result12.maxDrawdown).toBeLessThan(0.15);
        expect(result12.breakerTrips).toBeGreaterThan(0);
    }, 30000);
});
