/**
 * Q-Learning Engine
 *
 * Tabular Q-Learning for financial decision making.
 *
 * Q[s][a] = Q[s][a] + α * (reward + γ * max(Q[s'][a']) - Q[s][a])
 *
 * Reproducibility: an optional seeded RNG can be supplied. If none is
 * provided, Math.random() is used (non-reproducible). Tests must always
 * supply a seeded RNG.
 */

export interface RandomSource {
    next(): number; // returns a number in [0, 1)
}

const defaultRandomSource: RandomSource = {
    next: () => Math.random(),
};

export interface QLearningConfig {
    alpha: number;
    gamma: number;
    epsilon: number;
    epsilonDecay: number;
    epsilonMin: number;
    /** Optional per-(s,a) step-size schedule: alpha_n(n, stateKey, action) */
    stepSizeFn?: (n: number, stateKey: string, action: string) => number;
}

export const DEFAULT_QL_CONFIG: QLearningConfig = {
    alpha: 0.1,
    gamma: 0.95,
    epsilon: 0.3,
    epsilonDecay: 0.995,
    epsilonMin: 0.05,
};

export type QTable = Map<string, Map<string, number>>;

export class QLearning {
    private qTable: QTable = new Map();
    private config: QLearningConfig;
    private actions: string[];
    private rng: RandomSource;
    private totalUpdates: number = 0;
    private pairVisits: Map<string, Map<string, number>> = new Map();

    constructor(
        actions: string[],
        config: Partial<QLearningConfig> = {},
        rng: RandomSource = defaultRandomSource,
    ) {
        this.actions = actions;
        this.config = { ...DEFAULT_QL_CONFIG, ...config };
        this.rng = rng;
    }

    selectAction(stateKey: string): string {
        if (this.rng.next() < this.config.epsilon) {
            const idx = Math.floor(this.rng.next() * this.actions.length);
            return this.actions[idx];
        }
        return this.bestAction(stateKey);
    }

    bestAction(stateKey: string): string {
        const stateQ = this.qTable.get(stateKey);
        if (!stateQ || stateQ.size === 0) {
            // No data → default to the safest action (HOLD).
            // HOLD is the first action in the array by convention.
            return this.actions[0];
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

    update(stateKey: string, action: string, reward: number, nextStateKey: string): void {
        const currentQ = this.getQ(stateKey, action);
        const maxNextQ = this.maxQ(nextStateKey);

        let alpha = this.config.alpha;
        if (this.config.stepSizeFn) {
            let stateMap = this.pairVisits.get(stateKey);
            if (!stateMap) {
                stateMap = new Map();
                this.pairVisits.set(stateKey, stateMap);
            }
            const n = (stateMap.get(action) ?? 0) + 1;
            stateMap.set(action, n);
            alpha = this.config.stepSizeFn(n, stateKey, action);
        }

        const newQ = currentQ + alpha * (
            reward + this.config.gamma * maxNextQ - currentQ
        );
        this.setQ(stateKey, action, newQ);
        this.config.epsilon = Math.max(
            this.config.epsilonMin,
            this.config.epsilon * this.config.epsilonDecay,
        );
        this.totalUpdates++;
    }

    getPairVisits(stateKey: string, action: string): number {
        return this.pairVisits.get(stateKey)?.get(action) ?? 0;
    }

    getQ(stateKey: string, action: string): number {
        return this.qTable.get(stateKey)?.get(action) ?? 0;
    }

    private setQ(stateKey: string, action: string, value: number): void {
        if (!this.qTable.has(stateKey)) {
            this.qTable.set(stateKey, new Map());
        }
        this.qTable.get(stateKey)!.set(action, value);
    }

    maxQ(stateKey: string): number {
        const stateQ = this.qTable.get(stateKey);
        if (!stateQ || stateQ.size === 0) return 0;
        let max = -Infinity;
        for (const value of stateQ.values()) {
            if (value > max) max = value;
        }
        return max;
    }

    exportQTable(): Record<string, Record<string, number>> {
        const result: Record<string, Record<string, number>> = {};
        for (const [state, actions] of this.qTable.entries()) {
            result[state] = Object.fromEntries(actions.entries());
        }
        return result;
    }

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