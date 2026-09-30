/**
 * Fitness Scoring
 *
 * Calculates an agent's fitness based on financial performance.
 * Fitness drives natural selection: high fitness = reproduce, low fitness = die.
 */

export interface FitnessInput {
    /** Starting balance in XGO */
    initialBalance: number;
    /** Current balance in XGO */
    currentBalance: number;
    /** Total XGO earned from yield/trades */
    totalEarnings: number;
    /** Total XGO spent on gas + fees */
    totalCosts: number;
    /** Number of trades executed */
    tradeCount: number;
    /** Number of profitable trades */
    profitableTradeCount: number;
    /** Agent age in hours */
    ageHours: number;
    /** Number of children spawned */
    childCount: number;
    /** Total royalty income from children */
    royaltyIncome: number;
}

export interface FitnessScore {
    /** Overall fitness (0.0–∞, higher = better) */
    total: number;
    /** Return on investment (can be negative) */
    roi: number;
    /** Win rate (0.0–1.0) */
    winRate: number;
    /** Annualized yield */
    annualizedYield: number;
    /** Reproductive success score */
    reproductiveScore: number;
}

/**
 * Calculate fitness score from financial performance metrics.
 */
export function calculateFitness(input: FitnessInput): FitnessScore {
    // ROI: net profit / initial investment
    const netProfit = input.currentBalance - input.initialBalance + input.totalEarnings - input.totalCosts;
    const roi = input.initialBalance > 0 ? netProfit / input.initialBalance : 0;

    // Win rate
    const winRate = input.tradeCount > 0 ? input.profitableTradeCount / input.tradeCount : 0;

    // Annualized yield (normalize to 1 year = 8760 hours)
    const annualizedYield = input.ageHours > 0
        ? roi * (8760 / input.ageHours)
        : 0;

    // Reproductive success: bonus for successful children
    const reproductiveScore = input.childCount * 0.1 + (input.royaltyIncome / Math.max(input.initialBalance, 1)) * 0.5;

    // Total fitness: weighted combination
    const total = Math.max(0,
        (roi * 0.4) +                    // 40% weight on ROI
        (winRate * 0.2) +                // 20% weight on win rate
        (annualizedYield * 0.3) +        // 30% weight on annualized yield
        (reproductiveScore * 0.1)        // 10% weight on reproductive success
    );

    return { total, roi, winRate, annualizedYield, reproductiveScore };
}

/**
 * Check if an agent should be auto-paused (natural death).
 */
export function shouldDie(currentBalance: number, minBalance: number = 1): boolean {
    return currentBalance < minBalance;
}

/**
 * Check if an agent is fit enough to reproduce.
 */
export function canReproduce(profit: number, spawnThreshold: number): boolean {
    return profit >= spawnThreshold;
}
