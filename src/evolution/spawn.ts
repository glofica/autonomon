/**
 * Genome-Aware Child Spawning
 *
 * Extends Conway's spawn system with genome inheritance and Q-table transfer.
 */

import type { LangtonGenome } from '../genome/types.js';
import { mutate } from '../genome/mutation.js';
import { canReproduce } from '../genome/fitness.js';

export interface SpawnConfig {
    /** Parent's genome */
    parentGenome: LangtonGenome;
    /** Parent's Q-table (serialized) */
    parentQTable: Record<string, Record<string, number>>;
    /** Amount of XGO to fund the child */
    fundAmount: number;
    /** Parent's GLOFICA address */
    parentAddress: string;
    /** Current GLOFICA epoch */
    currentEpoch: number;
}

export interface SpawnResult {
    /** Child's mutated genome */
    childGenome: LangtonGenome;
    /** Inherited Q-table (from parent) */
    inheritedQTable: Record<string, Record<string, number>>;
    /** Amount funded to child */
    fundAmount: number;
    /** Whether spawn was successful */
    success: boolean;
    /** Error message if spawn failed */
    error?: string;
}

/**
 * Spawn a child agent with genome inheritance.
 *
 * 1. Check if parent has enough profit to reproduce
 * 2. Mutate the parent's genome
 * 3. Transfer Q-table to child (giving it a head start)
 * 4. Fund child with a percentage of parent's balance
 */
export function prepareSpawn(
    config: SpawnConfig,
    currentProfit: number,
): SpawnResult {
    const { parentGenome, parentQTable, fundAmount, parentAddress, currentEpoch } = config;

    // Check reproduction threshold
    if (!canReproduce(currentProfit, parentGenome.reproduction.spawnThresholdXGO)) {
        return {
            childGenome: parentGenome,
            inheritedQTable: {},
            fundAmount: 0,
            success: false,
            error: `Insufficient profit for reproduction. Need ${parentGenome.reproduction.spawnThresholdXGO} XGO, have ${currentProfit} XGO.`,
        };
    }

    // Mutate genome
    const childGenome = mutate(parentGenome);

    // Set meta fields
    childGenome.meta.parentAddress = parentAddress;
    childGenome.meta.birthEpoch = currentEpoch;
    childGenome.meta.fitness = 0;

    return {
        childGenome,
        inheritedQTable: parentQTable, // full Q-table inheritance
        fundAmount,
        success: true,
    };
}

/**
 * Calculate how much XGO to fund the child based on genome.
 */
export function calculateChildFunding(
    parentBalance: number,
    genome: LangtonGenome,
): number {
    return parentBalance * genome.reproduction.childFundPct;
}
