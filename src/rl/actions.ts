/**
 * Action Definitions — Paper §4 Canonical Implementation
 *
 * Paper §4 specifies exactly 5 abstract financial action labels:
 * - HOLD: Incur no trading transaction / wait for market signal
 * - ACQUIRE_SPOT: Acquire spot inventory via concrete adapter
 * - DISPOSE_SPOT: Dispose spot inventory to lock realized PnL
 * - PROVIDE_LIQUIDITY: Provide liquidity to target venue / AMM pool
 * - REDUCE_INVENTORY: Reduce inventory exposure towards neutral
 *
 * Specific instruments, venues, and order sizing are determined
 * by the deterministic adapter, not by the action labels.
 *
 * Reference: GLOFICA_Langton_Autonomon.md §4
 */

export type ActionLabel =
    | 'HOLD'
    | 'ACQUIRE_SPOT'
    | 'DISPOSE_SPOT'
    | 'PROVIDE_LIQUIDITY'
    | 'REDUCE_INVENTORY';

export const ACTION_LABELS: readonly ActionLabel[] = [
    'HOLD',
    'ACQUIRE_SPOT',
    'DISPOSE_SPOT',
    'PROVIDE_LIQUIDITY',
    'REDUCE_INVENTORY',
] as const;

export interface Action {
    id: ActionLabel;
    type: ActionLabel;
    description: string;
}

/** The 5 canonical abstract actions specified in Paper §4 */
export const ACTIONS: Action[] = [
    {
        id: 'HOLD',
        type: 'HOLD',
        description: 'Hold current position / incur no trading transaction',
    },
    {
        id: 'ACQUIRE_SPOT',
        type: 'ACQUIRE_SPOT',
        description: 'Acquire spot inventory via concrete adapter',
    },
    {
        id: 'DISPOSE_SPOT',
        type: 'DISPOSE_SPOT',
        description: 'Dispose spot inventory to lock realized PnL',
    },
    {
        id: 'PROVIDE_LIQUIDITY',
        type: 'PROVIDE_LIQUIDITY',
        description: 'Provide liquidity to target venue / AMM pool',
    },
    {
        id: 'REDUCE_INVENTORY',
        type: 'REDUCE_INVENTORY',
        description: 'Reduce inventory exposure towards neutral',
    },
];

/** Action IDs as string array for Q-Learning policy (|A| = 5) */
export const ACTION_IDS: string[] = ACTIONS.map(a => a.id);

/** Get an action definition by ID */
export function getAction(id: string): Action | undefined {
    return ACTIONS.find(a => a.id === id);
}

/**
 * Filter available actions to admissible set A_safe(z_t) per Paper §4.
 */
export function filterActions(admissible?: ActionLabel[]): string[] {
    if (admissible && admissible.length > 0) {
        return admissible;
    }
    return [...ACTION_IDS];
}
