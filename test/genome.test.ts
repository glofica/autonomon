import { describe, it, expect } from 'vitest';
import {
    GENOME_LOCI,
    DEFAULT_GENOME,
    clipGenomeToBox,
    type NumericGenome,
} from '../src/genome/types.js';
import { mutateNumericGenome } from '../src/genome/mutation.js';

describe('Paper §7 Genome Specification', () => {
    it('defines exactly 7 canonical numerical loci', () => {
        expect(GENOME_LOCI).toHaveLength(7);
        const names = GENOME_LOCI.map(l => l.name);
        expect(names).toEqual([
            'g_risk',
            'g_tau',
            'g_epsilon',
            'g_alpha',
            'g_gas',
            'g_omega',
            'g_mitosis',
        ]);
    });

    it('matches exact locus domains per Paper §7 table', () => {
        const domainMap = new Map(GENOME_LOCI.map(l => [l.name, { min: l.min, max: l.max }]));

        expect(domainMap.get('g_risk')).toEqual({ min: 0.10, max: 5.00 });
        expect(domainMap.get('g_tau')).toEqual({ min: 5, max: 60 });
        expect(domainMap.get('g_epsilon')).toEqual({ min: 0.05, max: 0.50 });
        expect(domainMap.get('g_alpha')).toEqual({ min: 0.01, max: 0.25 });
        expect(domainMap.get('g_gas')).toEqual({ min: 100, max: 1000 });
        expect(domainMap.get('g_omega')).toEqual({ min: 0.05, max: 0.40 });
        expect(domainMap.get('g_mitosis')).toEqual({ min: 1.50, max: 3.00 });
    });

    it('initializes DEFAULT_GENOME strictly inside Omega', () => {
        for (const locus of GENOME_LOCI) {
            const val = DEFAULT_GENOME[locus.name as keyof NumericGenome];
            expect(val).toBeGreaterThanOrEqual(locus.min);
            expect(val).toBeLessThanOrEqual(locus.max);
        }
    });

    it('satisfies Proposition 5 (Genome closure under clipping)', () => {
        const extreme: NumericGenome = {
            g_risk: 999,
            g_tau: -50,
            g_epsilon: 1.5,
            g_alpha: 0.0001,
            g_gas: 50000,
            g_omega: 0.99,
            g_mitosis: 0.2,
        };

        const clipped = clipGenomeToBox(extreme);

        expect(clipped.g_risk).toBe(5.00);
        expect(clipped.g_tau).toBe(5);
        expect(clipped.g_epsilon).toBe(0.50);
        expect(clipped.g_alpha).toBe(0.01);
        expect(clipped.g_gas).toBe(1000);
        expect(clipped.g_omega).toBe(0.40);
        expect(clipped.g_mitosis).toBe(1.50);
    });

    it('mutates numerical genome preserving bounded box Omega', () => {
        let current: NumericGenome = { ...DEFAULT_GENOME };
        for (let i = 0; i < 50; i++) {
            current = mutateNumericGenome(current);
            for (const locus of GENOME_LOCI) {
                const val = current[locus.name as keyof NumericGenome];
                expect(val).toBeGreaterThanOrEqual(locus.min);
                expect(val).toBeLessThanOrEqual(locus.max);
            }
        }
    });
});
