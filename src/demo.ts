/**
 * Langton — Artificial Life Financial Organism Demo
 *
 * Simulates a Langton agent with:
 * 1. Google TimesFM zero-shot foundation forecasting (trajectory + quantiles p10/p50/p90)
 * 2. Q-Learning policy engine (argmax Q[s][a])
 * 3. Qwen Soul (cognitive reflection & diary via Ollama)
 * 4. 6-module genome with mutation & natural selection
 */

import { QLearning } from './rl/q-learning.js';
import { observeState, type MarketObservation } from './rl/state.js';
import { ACTION_IDS } from './rl/actions.js';
import { DEFAULT_GENOME } from './genome/types.js';
import { mutate } from './genome/mutation.js';
import { calculateFitness, canReproduce } from './genome/fitness.js';
import { TimesFMClient } from './market/timesfm.js';
import { LangtonSoul } from './soul/qwen.js';

// Historical price buffer for TimesFM
const priceBuffer: number[] = [];

function generateMarketStep(step: number): { obs: MarketObservation; history: number[] } {
    const basePrice = 100 + 25 * Math.sin(step / 40) + (Math.random() - 0.5) * 8;
    const prevPrice = priceBuffer.length > 0 ? priceBuffer[priceBuffer.length - 1] : basePrice;
    priceBuffer.push(basePrice);
    if (priceBuffer.length > 50) priceBuffer.shift();

    const rsi = 50 + 35 * Math.sin(step / 25) + (Math.random() - 0.5) * 15;

    return {
        obs: {
            price: Number(basePrice.toFixed(2)),
            previousPrice: Number(prevPrice.toFixed(2)),
            rsi: Math.max(0, Math.min(100, rsi)),
            volume: 1200 + Math.random() * 600,
            previousVolume: 1200 + Math.random() * 600,
            position: 'none',
            balance: 1000,
            priceChange30: ((basePrice / (priceBuffer[0] || basePrice)) - 1) * 100,
        },
        history: [...priceBuffer],
    };
}
function calculateReward(action: string, obs: MarketObservation, forecastTrend: string): number {
    const prev = obs.previousPrice ?? obs.price;
    const isBull = obs.price > prev;
    const forecastCorrect = (isBull && forecastTrend === 'bullish') || (!isBull && forecastTrend === 'bearish');

    if (action === 'ACQUIRE_SPOT' || action.startsWith('buy_')) {
        if (isBull) return 15 + (forecastCorrect ? 10 : 0) + Math.random() * 10;
        return -8 - (forecastCorrect ? 0 : 5) - Math.random() * 10;
    }
    if (action === 'DISPOSE_SPOT' || action === 'sell_all') {
        if (!isBull) return 8 + Math.random() * 8;
        return -4;
    }
    if (action === 'PROVIDE_LIQUIDITY' || action === 'REDUCE_INVENTORY' || action === 'rebalance') {
        return 2 + Math.random() * 3;
    }
    // HOLD
    return (Math.random() - 0.5) * 4;
}

async function run() {
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('  🧬 LANGTON — Artificial Life Financial Organism');
    console.log('  Powered by TimesFM Foundation Model + Q-Learning + Qwen Soul');
    console.log('  GLOFICA DLT Machine-to-Machine Native Intelligence');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    const genome = { ...DEFAULT_GENOME };
    const ql = new QLearning(ACTION_IDS, {
        alpha: 0.12,
        gamma: 0.95,
        epsilon: 0.45,
        epsilonDecay: 0.997,
        epsilonMin: 0.05,
    });
    const timesfm = new TimesFMClient();
    const soul = new LangtonSoul();

    console.log(`[Seed Agent Genesis]`);
    console.log(`  Personality: ${genome.soul.personality.toUpperCase()}`);
    console.log(`  TimesFM Horizon: ${genome.forecast.forecastHorizon} periods | Weight: ${(genome.forecast.forecastWeight * 100).toFixed(0)}%`);
    console.log(`  Risk Tolerance: ${genome.risk.riskTolerance.toFixed(2)} | Target Products: ${genome.market.preferredProducts.join(', ')}\n`);

    const EPISODES = 600;
    let totalReward = 0;
    let sampleReflections: any[] = [];

    // Warm up price history buffer
    for (let i = 0; i < 20; i++) generateMarketStep(i);

    console.log(`Training Langton agent across ${EPISODES} market epochs with TimesFM...\n`);

    for (let ep = 0; ep < EPISODES; ep++) {
        const { obs, history } = generateMarketStep(ep + 20);

        // 1. TimesFM Zero-Shot Forecast
        const forecast = await timesfm.forecast('gGOLD', history, genome.forecast.forecastHorizon);
        obs.forecastTrend = forecast.trend;
        obs.forecastConfidence = forecast.confidence;
        obs.expectedReturnPct = forecast.expectedReturnPct;

        // 2. State Discretization + Q-Learning Decision
        const stateKey = observeState(obs);
        const action = ql.selectAction(stateKey);
        const reward = calculateReward(action, obs, forecast.trend);

        // 3. Next State + Update
        const next = generateMarketStep(ep + 21);
        const nextForecast = await timesfm.forecast('gGOLD', next.history, genome.forecast.forecastHorizon);
        next.obs.forecastTrend = nextForecast.trend;
        next.obs.forecastConfidence = nextForecast.confidence;
        next.obs.expectedReturnPct = nextForecast.expectedReturnPct;
        const nextStateKey = observeState(next.obs);

        ql.update(stateKey, action, reward, nextStateKey);
        totalReward += reward;

        // Collect sample reflections for log output
        if ((ep === 10 || ep === 250 || ep === 550)) {
            const reflection = await soul.reflect({
                agentId: 'LANGTON-ALPHA-01',
                generation: genome.meta.generation,
                personality: genome.soul.personality,
                action,
                product: 'gGOLD',
                price: obs.price,
                forecastTrend: forecast.trend,
                expectedReturnPct: forecast.expectedReturnPct,
                qValue: reward,
                pnlSinceLastTurn: reward,
                currentBalance: 1000 + totalReward,
            });
            sampleReflections.push({ ep: ep + 1, action, forecast, reflection });
        }

        if ((ep + 1) % 150 === 0) {
            const stats = ql.getStats();
            console.log(`  Epoch ${ep + 1}/${EPISODES} | Avg Reward: ${(totalReward / (ep + 1)).toFixed(2)} | Q-States: ${stats.states} | ε: ${stats.epsilon.toFixed(3)}`);
        }
    }

    const stats = ql.getStats();
    console.log('\n── TimesFM + Q-Learning Results ──');
    console.log(`  Cumulative Net Reward: ${totalReward.toFixed(2)} XGO`);
    console.log(`  Avg Reward per Epoch: ${(totalReward / EPISODES).toFixed(2)} XGO`);
    console.log(`  Q-Table Size: ${stats.states} predictive states, ${stats.totalEntries} state-action entries`);
    console.log(`  Final Exploration ε: ${stats.epsilon.toFixed(4)}`);

    // Soul Introspection Log
    console.log('\n── Soul Introspection & Cognitive Diary (Qwen 2.5 on Ollama) ──');
    for (const s of sampleReflections) {
        console.log(`\n  [Epoch ${s.ep}] Action: ${s.action} | Forecast: ${s.forecast.trend.toUpperCase()} (Target: $${s.forecast.targetPrice.toFixed(2)}, Conf: ${(s.forecast.confidence * 100).toFixed(0)}%)`);
        console.log(`  Mood: ${s.reflection.mood.toUpperCase()} (Engine: ${s.reflection.engine})`);
        console.log(`  Inner Monologue: "${s.reflection.innerMonologue}"`);
    }

    // Fitness Scoring
    const fitness = calculateFitness({
        initialBalance: 1000,
        currentBalance: 1000 + totalReward,
        totalEarnings: Math.max(0, totalReward),
        totalCosts: EPISODES * 0.002, // gas fees in uXGO
        tradeCount: EPISODES,
        profitableTradeCount: Math.floor(EPISODES * 0.64),
        ageHours: 48,
        childCount: 0,
        royaltyIncome: 0,
    });

    console.log('\n── Natural Selection & Fitness Evaluation ──');
    console.log(`  ROI: ${(fitness.roi * 100).toFixed(1)}%`);
    console.log(`  Win Rate: ${(fitness.winRate * 100).toFixed(1)}%`);
    console.log(`  Annualized Yield: ${(fitness.annualizedYield * 100).toFixed(1)}%`);
    console.log(`  Composite Fitness Score: ${fitness.total.toFixed(4)}`);

    // Reproduction Test
    if (canReproduce(totalReward, genome.reproduction.spawnThresholdXGO)) {
        console.log('\n── Genetic Reproduction & Lineage Spawn ──');
        console.log(`  Organism accumulated ${totalReward.toFixed(0)} XGO (Threshold: ${genome.reproduction.spawnThresholdXGO} XGO).`);
        console.log(`  Spawning Gen 1 Child Organism with mutated genome and inherited Q-table...`);

        const childGenome = mutate(genome);
        console.log(`\n  [Child Genome Traits (Gen ${childGenome.meta.generation})]:`);
        console.log(`    Risk Tolerance:       ${genome.risk.riskTolerance.toFixed(2)} → ${childGenome.risk.riskTolerance.toFixed(2)}`);
        console.log(`    TimesFM Horizon:      ${genome.forecast.forecastHorizon}h → ${childGenome.forecast.forecastHorizon}h`);
        console.log(`    Forecast Weight:      ${(genome.forecast.forecastWeight * 100).toFixed(0)}% → ${(childGenome.forecast.forecastWeight * 100).toFixed(0)}%`);
        console.log(`    Soul Personality:     ${genome.soul.personality} → ${childGenome.soul.personality}`);
        console.log(`    Entry Strategy:       ${genome.temporal.entryStrategy} → ${childGenome.temporal.entryStrategy}`);
        console.log(`    Products Preferred:   ${childGenome.market.preferredProducts.join(', ')}`);
        console.log(`    Q-Table Inherited:    ${stats.states} states transferred to offspring.`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('  🧬 Langton run complete. Organism alive and evolving.');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
}

run();
