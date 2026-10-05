import { describe, it, expect } from 'vitest';
import { runSanityChecks } from '../tests/t1st/sanity-checks.js';
import { runOneSeedT1st, DEFAULT_T1ST_CONFIG } from '../tests/t1st/runner.js';

describe('T1st — Two-Phase Training + Evaluation with Safety Layer', () => {
    it('passes all 6 sanity checks', async () => {
        const sanity = await runSanityChecks();
        expect(sanity.allPassed).toBe(true);
        for (const check of sanity.checks) {
            expect(check.passed).toBe(true);
        }
    });

    it('enforces max drawdown < 15% and trade reduction in evaluation phase', async () => {
        const result = await runOneSeedT1st(1);

        expect(result.maxDrawdownOverall).toBeLessThan(0.15);
        expect(result.evalTradeCount).toBe(0);
        expect(result.evalAnnualizedReturn).toBe(0);
    }, 30000);
});
