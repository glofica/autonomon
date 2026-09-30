/**
 * Action Definitions
 *
 * All possible actions a Langton Agent can take in the RWA marketplace.
 */

export interface Action {
    id: string;
    type: 'buy' | 'sell' | 'hold' | 'rebalance';
    product?: string;
    description: string;
}

/** All available agent actions. */
export const ACTIONS: Action[] = [
    { id: 'buy_gQMF', type: 'buy', product: 'gQMF', description: 'Buy Quantum Metals Fund' },
    { id: 'buy_gOIL', type: 'buy', product: 'gOIL', description: 'Buy Venezuela Oil Fund' },
    { id: 'buy_gLRE', type: 'buy', product: 'gLRE', description: 'Buy LATAM Real Estate Index' },
    { id: 'buy_gCO2', type: 'buy', product: 'gCO2', description: 'Buy Amazon Carbon Credits' },
    { id: 'buy_gTBND', type: 'buy', product: 'gTBND', description: 'Buy US Treasury Bond 2028' },
    { id: 'buy_gHASH', type: 'buy', product: 'gHASH', description: 'Buy BTC Mining Hashrate' },
    { id: 'buy_gGOLD', type: 'buy', product: 'gGOLD', description: 'Buy Tokenized Gold Reserve' },
    { id: 'sell_all', type: 'sell', description: 'Sell all positions' },
    { id: 'rebalance', type: 'rebalance', description: 'Rebalance portfolio per genome weights' },
    { id: 'hold', type: 'hold', description: 'Do nothing this turn' },
];

/** Action IDs as a string array (for Q-Learning). */
export const ACTION_IDS = ACTIONS.map(a => a.id);

/** Get an action definition by ID. */
export function getAction(id: string): Action | undefined {
    return ACTIONS.find(a => a.id === id);
}

/**
 * Filter available actions based on agent genome preferences.
 * Agents with specific preferredProducts will prioritize those.
 */
export function filterActions(preferredProducts: string[]): string[] {
    const buyActions = preferredProducts.map(p => `buy_${p}`);
    return [...buyActions, 'sell_all', 'rebalance', 'hold'];
}
