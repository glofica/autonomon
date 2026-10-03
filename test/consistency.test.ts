import { describe, it, expect } from 'vitest';
import { runConsistencyCheck } from '../scripts/consistency-check.js';

describe('Paper Alignment Consistency Check Script', () => {
    it('passes all canonical checks with 0 errors', () => {
        const result = runConsistencyCheck();

        expect(result.errors).toEqual([]);
        expect(result.passed).toBe(true);

        // |S| === 2160
        expect(result.stateSpace.totalStates).toBe(2160);
        expect(result.stateSpace.uniqueKeysCount).toBe(2160);

        // ACTIONS.length === 5
        expect(result.actions.actionCount).toBe(5);

        // GENOME_LOCI.length === 7
        expect(result.genome.lociCount).toBe(7);

        // All ranges pass
        for (const locus of result.genome.lociChecked) {
            expect(locus.passed).toBe(true);
        }
    });
});
