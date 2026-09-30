/**
 * Q-Learning Engine
 *
 * Tabular Q-Learning for financial decision making.
 * Learns optimal investment actions from market state observations.
 *
 * Q[s][a] = Q[s][a] + α * (reward + γ * max(Q[s'][a']) - Q[s][a])
 */

export interface QLearningConfig {
    /** Learning rate (0.0–1.0). Higher = faster learning, less stable. */
    alpha: number;
    /** Discount factor (0.0–1.0). Higher = values future rewards more. */
    gamma: number;
    /** Exploration rate (0.0–1.0). Higher = more random exploration. */
    epsilon: number;
    /** Epsilon decay per step (0.99–1.0). Reduces exploration over time. */
    epsilonDecay: number;
    /** Minimum epsilon (never stop exploring entirely). */
    epsilonMin: number;
}

export const DEFAULT_QL_CONFIG: QLearningConfig = {
    alpha: 0.1,
    gamma: 0.95,
    epsilon: 0.3,
    epsilonDecay: 0.999,
    epsilonMin: 0.01,
};

/** Q-table: state key → { action → Q-value } */
export type QTable = Map<string, Map<string, number>>;

export class QLearning {
    private qTable: QTable = new Map();
    private config: QLearningConfig;
    private actions: string[];
    private totalUpdates: number = 0;

    constructor(actions: string[], config: Partial<QLearningConfig> = {}) {
        this.actions = actions;
        this.config = { ...DEFAULT_QL_CONFIG, ...config };
    }

    /**
     * Select an action using epsilon-greedy policy.
     * With probability ε, explore (random action).
     * With probability 1-ε, exploit (best known action).
     */
    selectAction(stateKey: string): string {
        if (Math.random() < this.config.epsilon) {
            // Explore: random action
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        }

        // Exploit: best action for this state
        return this.bestAction(stateKey);
    }

    /**
     * Get the best known action for a state (highest Q-value).
     */
    bestAction(stateKey: string): string {
        const stateQ = this.qTable.get(stateKey);
        if (!stateQ || stateQ.size === 0) {
            // No data for this state — return random
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        }

        let bestA = this.actions[0];
        let bestVal = -Infinity;

        for (const [action, value] of stateQ.entries()) {
            if (value > bestVal) {
                bestVal = value;
                bestA = action;
            }
        }

        return bestA;
    }

    /**
     * Update Q-value using the Bellman equation:
     * Q[s][a] = Q[s][a] + α * (reward + γ * max(Q[s'][a']) - Q[s][a])
     */
    update(stateKey: string, action: string, reward: number, nextStateKey: string): void {
        const currentQ = this.getQ(stateKey, action);
        const maxNextQ = this.maxQ(nextStateKey);

        const newQ = currentQ + this.config.alpha * (
            reward + this.config.gamma * maxNextQ - currentQ
        );

        this.setQ(stateKey, action, newQ);

        // Decay exploration
        this.config.epsilon = Math.max(
            this.config.epsilonMin,
            this.config.epsilon * this.config.epsilonDecay,
        );

        this.totalUpdates++;
    }

    /**
     * Get Q-value for a state-action pair.
     */
    getQ(stateKey: string, action: string): number {
        return this.qTable.get(stateKey)?.get(action) ?? 0;
    }

    /**
     * Set Q-value for a state-action pair.
     */
    private setQ(stateKey: string, action: string, value: number): void {
        if (!this.qTable.has(stateKey)) {
            this.qTable.set(stateKey, new Map());
        }
        this.qTable.get(stateKey)!.set(action, value);
    }

    /**
     * Get the maximum Q-value across all actions for a state.
     */
    maxQ(stateKey: string): number {
        const stateQ = this.qTable.get(stateKey);
        if (!stateQ || stateQ.size === 0) return 0;

        let max = -Infinity;
        for (const value of stateQ.values()) {
            if (value > max) max = value;
        }
        return max;
    }

    /**
     * Export Q-table as a serializable object (for inheritance).
     */
    exportQTable(): Record<string, Record<string, number>> {
        const result: Record<string, Record<string, number>> = {};
        for (const [state, actions] of this.qTable.entries()) {
            result[state] = Object.fromEntries(actions.entries());
        }
        return result;
    }

    /**
     * Import a Q-table (from parent agent for inheritance).
     */
    importQTable(data: Record<string, Record<string, number>>): void {
        this.qTable.clear();
        for (const [state, actions] of Object.entries(data)) {
            const actionMap = new Map<string, number>();
            for (const [action, value] of Object.entries(actions)) {
                actionMap.set(action, value);
            }
            this.qTable.set(state, actionMap);
        }
    }

    /**
     * Get statistics about the Q-table.
     */
    getStats(): { states: number; totalEntries: number; totalUpdates: number; epsilon: number } {
        let totalEntries = 0;
        for (const actions of this.qTable.values()) {
            totalEntries += actions.size;
        }
        return {
            states: this.qTable.size,
            totalEntries,
            totalUpdates: this.totalUpdates,
            epsilon: this.config.epsilon,
        };
    }
}
