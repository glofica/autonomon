/**
 * Langton Autonomon — Paper Alignment & Consistency Check
 *
 * Validates canonical invariants defined in GLOFICA_Langton_Autonomon.md:
 * 1. State space cardinality: |S| === 2160 (Paper §3)
 * 2. Abstract action space: ACTIONS.length === 5 (Paper §4)
 * 3. Genome loci count: GENOME_LOCI.length === 7 (Paper §7)
 * 4. Genome ranges strictly match Paper §7 table:
 *    - g_risk: [0.10, 5.00]
 *    - g_tau: [5, 60] minutes
 *    - g_epsilon: [0.05, 0.50]
 *    - g_alpha: [0.01, 0.25]
 *    - g_gas: [100, 1000] XGO
 *    - g_omega: [0.05, 0.40]
 *    - g_mitosis: [1.50, 3.00]
 */

import {
    TREND_CATEGORIES,
    RSI_CATEGORIES,
    FORECAST_CATEGORIES,
    VOLATILITY_CATEGORIES,
    POSITION_CATEGORIES,
    HEALTH_CATEGORIES,
    TOTAL_STATE_COUNT,
    getAllStateKeys,
} from '../src/rl/state.js';

import {
    ACTIONS,
    ACTION_IDS,
    ACTION_LABELS,
    type ActionLabel,
} from '../src/rl/actions.js';

import {
    GENOME_LOCI,
    DEFAULT_GENOME,
    clipGenomeToBox,
    type NumericGenome,
} from '../src/genome/types.js';

export interface ConsistencyCheckResult {
    passed: boolean;
    stateSpace: {
        totalStates: number;
        uniqueKeysCount: number;
        coordinates: Record<string, number>;
    };
    actions: {
        actionCount: number;
        actionLabels: string[];
    };
    genome: {
        lociCount: number;
        lociChecked: Array<{ name: string; min: number; max: number; passed: boolean }>;
    };
    errors: string[];
}

export function runConsistencyCheck(): ConsistencyCheckResult {
    const errors: string[] = [];

    // ── 1. Check State Space Cardinality (|S| === 2160) ──
    const trendCount = TREND_CATEGORIES.length;
    const rsiCount = RSI_CATEGORIES.length;
    const forecastCount = FORECAST_CATEGORIES.length;
    const volCount = VOLATILITY_CATEGORIES.length;
    const posCount = POSITION_CATEGORIES.length;
    const healthCount = HEALTH_CATEGORIES.length;

    const computedS = trendCount * rsiCount * forecastCount * volCount * posCount * healthCount;

    if (computedS !== 2160) {
        errors.push(`[StateSpaceError] |S| = ${computedS} !== 2160`);
    }

    if (TOTAL_STATE_COUNT !== 2160) {
        errors.push(`[StateSpaceError] TOTAL_STATE_COUNT = ${TOTAL_STATE_COUNT} !== 2160`);
    }

    const stateKeys = getAllStateKeys();
    const uniqueKeys = new Set(stateKeys);
    if (uniqueKeys.size !== 2160) {
        errors.push(`[StateSpaceError] Unique state keys count = ${uniqueKeys.size} !== 2160`);
    }

    // ── 2. Check Action Space (ACTIONS.length === 5) ──
    if (ACTIONS.length !== 5) {
        errors.push(`[ActionError] ACTIONS.length = ${ACTIONS.length} !== 5`);
    }

    if (ACTION_IDS.length !== 5) {
        errors.push(`[ActionError] ACTION_IDS.length = ${ACTION_IDS.length} !== 5`);
    }

    const expectedActions: ActionLabel[] = [
        'HOLD',
        'ACQUIRE_SPOT',
        'DISPOSE_SPOT',
        'PROVIDE_LIQUIDITY',
        'REDUCE_INVENTORY',
    ];

    for (const expected of expectedActions) {
        if (!ACTION_LABELS.includes(expected)) {
            errors.push(`[ActionError] Missing expected canonical action: ${expected}`);
        }
    }

    // ── 3. Check Genome Loci (GENOME_LOCI.length === 7) ──
    if (GENOME_LOCI.length !== 7) {
        errors.push(`[GenomeError] GENOME_LOCI.length = ${GENOME_LOCI.length} !== 7`);
    }

    // ── 4. Check Genome Ranges per Paper §7 Table ──
    const expectedRanges: Record<string, { min: number; max: number }> = {
        g_risk: { min: 0.10, max: 5.00 },
        g_tau: { min: 5, max: 60 },
        g_epsilon: { min: 0.05, max: 0.50 },
        g_alpha: { min: 0.01, max: 0.25 },
        g_gas: { min: 100, max: 1000 },
        g_omega: { min: 0.05, max: 0.40 },
        g_mitosis: { min: 1.50, max: 3.00 },
    };

    const lociChecked: Array<{ name: string; min: number; max: number; passed: boolean }> = [];

    for (const [name, range] of Object.entries(expectedRanges)) {
        const found = GENOME_LOCI.find(l => l.name === name);
        if (!found) {
            errors.push(`[GenomeError] Missing locus ${name}`);
            lociChecked.push({ name, min: range.min, max: range.max, passed: false });
        } else if (found.min !== range.min || found.max !== range.max) {
            errors.push(
                `[GenomeError] Range mismatch for ${name}: expected [${range.min}, ${range.max}], got [${found.min}, ${found.max}]`
            );
            lociChecked.push({ name, min: found.min, max: found.max, passed: false });
        } else {
            lociChecked.push({ name, min: found.min, max: found.max, passed: true });
        }
    }

    return {
        passed: errors.length === 0,
        stateSpace: {
            totalStates: computedS,
            uniqueKeysCount: uniqueKeys.size,
            coordinates: {
                Trend: trendCount,
                RSI: rsiCount,
                Forecast: forecastCount,
                Volatility: volCount,
                Position: posCount,
                Health: healthCount,
            },
        },
        actions: {
            actionCount: ACTIONS.length,
            actionLabels: ACTIONS.map(a => a.id),
        },
        genome: {
            lociCount: GENOME_LOCI.length,
            lociChecked,
        },
        errors,
    };
}

// If invoked as a script, execute and print diagnostics
const result = runConsistencyCheck();

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('  🧬 AUTONOMON SPECIFICATION CONSISTENCY CHECK — PAPER VERIFICATION');
console.log('  Target: GLOFICA_Langton_Autonomon.md Canonical Alignment');
console.log('═══════════════════════════════════════════════════════════════════════\n');

console.log(`[1] State Space Cardinality |S|:`);
console.log(`    Coordinates: 5 x 3 x 4 x 3 x 4 x 3`);
console.log(`    Total States: ${result.stateSpace.totalStates} (Expected: 2160)`);
console.log(`    Unique Keys:  ${result.stateSpace.uniqueKeysCount} (Expected: 2160)`);
console.log(`    Status: ${result.stateSpace.totalStates === 2160 ? '✓ PASS' : '✗ FAIL'}\n`);

console.log(`[2] Action Space Cardinality |A|:`);
console.log(`    Actions: [${result.actions.actionLabels.join(', ')}]`);
console.log(`    Count: ${result.actions.actionCount} (Expected: 5)`);
console.log(`    Status: ${result.actions.actionCount === 5 ? '✓ PASS' : '✗ FAIL'}\n`);

console.log(`[3] Genome Loci Count:`);
console.log(`    Count: ${result.genome.lociCount} (Expected: 7)`);
console.log(`    Status: ${result.genome.lociCount === 7 ? '✓ PASS' : '✗ FAIL'}\n`);

console.log(`[4] Genome Loci Ranges Check (Paper §7):`);
for (const locus of result.genome.lociChecked) {
    console.log(`    ${locus.name.padEnd(12)} [${locus.min.toFixed(2)}, ${locus.max.toFixed(2)}] -> ${locus.passed ? '✓ PASS' : '✗ FAIL'}`);
}

console.log('\n' + '─'.repeat(71));
if (result.passed) {
    console.log('  ✨ ALL CANONICAL SPECIFICATION INVARIANTS PASS PERFECTLY (100% ALIGNED)');
    console.log('─'.repeat(71) + '\n');
} else {
    console.error('  ❌ INVARIANT FAILURES DETECTED:');
    for (const err of result.errors) {
        console.error(`     - ${err}`);
    }
    console.log('─'.repeat(71) + '\n');
    process.exit(1);
}
