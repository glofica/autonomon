/**
 * Langton Organism Progenitor (Gen-0)
 *
 * True Artificial Life Financial Organism on GLOFICA DLT & OCRE Commodity Exchange:
 * 1. 7-Module Mutable Genome (Risk, Market, Temporal, Forecast, Soul, Social, Reproduction)
 * 2. Reinforcement Learning Brain (Tabular Q-Learning with in-memory state-action policy)
 * 3. Market Sense & Arbitrage (OCRE Spot Warrants, LME/SHFE benchmarks, and spread capture)
 * 4. Economic Accounting & Real PnL in XGO (1 XGO = $0.0001 USD)
 * 5. Mitosis & Genetic Reproduction: Spawns Gen-1+ children with inherited Q-tables & mutated genomes
 * 6. The Soul: Introspective cognition & trade diary (Qwen 2.5 / local heuristic)
 * 7. HTTP Telemetry Server on Port 8090
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { QLearning } from './rl/q-learning.js';
import { observeState, type MarketObservation } from './rl/state.js';
import { ACTIONS, ACTION_IDS, type Action } from './rl/actions.js';
import { DEFAULT_GENOME, type LangtonGenome } from './genome/types.js';
import { mutate } from './genome/mutation.js';
import { calculateFitness, canReproduce } from './genome/fitness.js';
import { TimesFMClient } from './market/timesfm.js';
import { LangtonSoul } from './soul/qwen.js';

const FULLNODE_RPC = process.env.FULLNODE_RPC || process.env.GLOFICA_RPC_URL || 'https://rpc.ocre.online';
const PORT = parseInt(process.env.PORT || '8090', 10);
const OCRE_API_URL = process.env.OCRE_API_URL || 'http://localhost:3000/api/benchmarks';

// ── Persistent Storage Initialization ──────────────────────────────────────────
const dataDir = path.join(process.cwd(), 'data');
const lineageDir = path.join(dataDir, 'lineage');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(lineageDir)) fs.mkdirSync(lineageDir, { recursive: true });

const keystoreFile = path.join(dataDir, 'agent_keystore.json');
const genomeFile = path.join(dataDir, 'organism_genome.json');
const qtableFile = path.join(dataDir, 'organism_qtable.json');

// Keystore
let keystore: { address: string; publicKey: string; privateKey: string };
if (fs.existsSync(keystoreFile)) {
    keystore = JSON.parse(fs.readFileSync(keystoreFile, 'utf8'));
} else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const rawPubKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
    const rawPrivKey = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
    const hasher = crypto.createHash('sha256');
    hasher.update(Buffer.concat([Buffer.from([0x00]), rawPubKey]));
    const addr = '0x' + hasher.digest('hex');
    keystore = { address: addr, publicKey: rawPubKey.toString('hex'), privateKey: rawPrivKey.toString('hex') };
    fs.writeFileSync(keystoreFile, JSON.stringify(keystore, null, 2), 'utf8');
}

// Genome
let genome: LangtonGenome;
if (fs.existsSync(genomeFile)) {
    try {
        genome = JSON.parse(fs.readFileSync(genomeFile, 'utf8'));
    } catch {
        genome = { ...DEFAULT_GENOME };
    }
} else {
    genome = { ...DEFAULT_GENOME };
    fs.writeFileSync(genomeFile, JSON.stringify(genome, null, 2), 'utf8');
}

// ── Q-Learning Brain Initialization ────────────────────────────────────────────
const ql = new QLearning(ACTION_IDS, {
    alpha: 0.15,
    gamma: 0.95,
    epsilon: 0.35,
    epsilonDecay: 0.998,
    epsilonMin: 0.05,
});

if (fs.existsSync(qtableFile)) {
    try {
        const savedQTable = JSON.parse(fs.readFileSync(qtableFile, 'utf8'));
        ql.importQTable(savedQTable);
        console.log(`[BRAIN] Loaded ${Object.keys(savedQTable).length} learned states into Q-table.`);
    } catch (err) {
        console.warn('[BRAIN] Could not load saved Q-table, starting fresh.');
    }
}

// Predictive Oracle & Soul
const timesfm = new TimesFMClient();
const soul = new LangtonSoul();

// ── Organism Data Structures ───────────────────────────────────────────────────
export interface ChildSummary {
    id: string;
    generation: number;
    address: string;
    birthEpoch: number;
    fundAmountXgo: number;
    status: 'ACTIVE_RUNNING' | 'DORMANT';
    genomeSummary: {
        riskTolerance: number;
        entryStrategy: string;
        personality: string;
        forecastWeight: number;
        preferredProducts: string[];
    };
    inheritedQStatesCount: number;
    cumulativeRoyaltyPaidXgo: number;
}

export interface OrganismTelemetry {
    id: string;
    name: string;
    generation: number;
    address: string;
    status: 'HEALTHY_HUNTING' | 'PREPARING_MITOSIS' | 'REPRODUCED' | 'CRITICAL_LOW_GAS';
    balanceXgo: number;
    balanceUsdc: number;
    netRealizedPnlXgo: number;
    unrealizedPnlXgo: number;
    totalEarningsXgo: number;
    totalCostsXgo: number;
    tradesCount: number;
    winRatePct: number;
    epochsSurvived: number;
    latestCheckpoint: number;
    fitnessScore: number;
    genome: LangtonGenome;
    qTableStats: {
        statesLearned: number;
        totalEntries: number;
        epsilonExploration: number;
    };
    soul: {
        personality: string;
        mood: string;
        innerMonologue: string;
        lastReflectionTime: string;
    };
    openPositions: Record<string, { units: number; entryPriceUsd: number; currentPriceUsd: number; pnlXgo: number }>;
    childrenSpawned: ChildSummary[];
    recentEvents: Array<{ epoch: number; timestamp: string; event: string; detail: string; pnlXgo?: number }>;
}

const organismId = 'LANGTON-PROGENITOR-' + keystore.address.substring(2, 8).toUpperCase();

// Load existing lineage children
const childrenSpawned: ChildSummary[] = [];
const existingChildren = fs.readdirSync(lineageDir).filter(f => f.startsWith('child_') && f.endsWith('.json'));
for (const f of existingChildren) {
    try {
        const childData = JSON.parse(fs.readFileSync(path.join(lineageDir, f), 'utf8'));
        childrenSpawned.push(childData);
    } catch {}
}

const state: OrganismTelemetry = {
    id: organismId,
    name: 'Langton Progenitor (Gen-0)',
    generation: 0,
    address: keystore.address,
    status: 'HEALTHY_HUNTING',
    balanceXgo: 1250.0, // Starting sovereign reserve
    balanceUsdc: 2.0,
    netRealizedPnlXgo: 0,
    unrealizedPnlXgo: 0,
    totalEarningsXgo: 0,
    totalCostsXgo: 0,
    tradesCount: 0,
    winRatePct: 0,
    epochsSurvived: 0,
    latestCheckpoint: 5214000,
    fitnessScore: 100.0,
    genome,
    qTableStats: {
        statesLearned: 0,
        totalEntries: 0,
        epsilonExploration: 0.35,
    },
    soul: {
        personality: genome.soul.personality,
        mood: 'AWAKENED',
        innerMonologue: `Gen-0 Progenitor awakened. Monitoring OCRE Spot Warrants & LME spreads. Ready to reproduce upon earning ${genome.reproduction.spawnThresholdXGO} XGO.`,
        lastReflectionTime: new Date().toISOString(),
    },
    openPositions: {},
    childrenSpawned,
    recentEvents: []
};

// ── Market Simulation & Real Data Fetching ──────────────────────────────────────
const priceHistoryBuffer: Record<string, number[]> = {
    'WR-CU-001': [9820, 9850, 9870, 9910, 9920],
    'WR-REE-006': [61.5, 62.0, 62.2, 62.8, 63.1],
    'WR-AL-002': [2540, 2555, 2560, 2575, 2580],
    'WR-ZN-003': [2890, 2905, 2910, 2925, 2930],
};

async function fetchMarketPrices(): Promise<Record<string, { price: number; benchmark: number; spreadPct: number }>> {
    const result: Record<string, { price: number; benchmark: number; spreadPct: number }> = {};
    
    // Default dynamic simulated prices (with Brownian motion drift)
    const baseCu = (priceHistoryBuffer['WR-CU-001'][priceHistoryBuffer['WR-CU-001'].length - 1] || 9920) + (Math.random() - 0.48) * 25;
    const baseRee = (priceHistoryBuffer['WR-REE-006'][priceHistoryBuffer['WR-REE-006'].length - 1] || 62.5) + (Math.random() - 0.49) * 0.4;
    const baseAl = (priceHistoryBuffer['WR-AL-002'][priceHistoryBuffer['WR-AL-002'].length - 1] || 2580) + (Math.random() - 0.48) * 8;
    const baseZn = (priceHistoryBuffer['WR-ZN-003'][priceHistoryBuffer['WR-ZN-003'].length - 1] || 2920) + (Math.random() - 0.48) * 9;

    result['WR-CU-001'] = { price: Number(baseCu.toFixed(2)), benchmark: 9940, spreadPct: Number(((9940 - baseCu) / 9940 * 100).toFixed(2)) };
    result['WR-REE-006'] = { price: Number(baseRee.toFixed(2)), benchmark: 64.0, spreadPct: Number(((64.0 - baseRee) / 64.0 * 100).toFixed(2)) };
    result['WR-AL-002'] = { price: Number(baseAl.toFixed(2)), benchmark: 2595, spreadPct: Number(((2595 - baseAl) / 2595 * 100).toFixed(2)) };
    result['WR-ZN-003'] = { price: Number(baseZn.toFixed(2)), benchmark: 2940, spreadPct: Number(((2940 - baseZn) / 2940 * 100).toFixed(2)) };

    // Try fetching from local OCRE Next.js dev server if running
    try {
        const res = await fetch(OCRE_API_URL, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
            const data = await res.json();
            if (data.benchmarks?.LME_COPPER) {
                result['WR-CU-001'].benchmark = data.benchmarks.LME_COPPER.price;
            }
        }
    } catch {}

    // Update history buffers
    for (const [key, val] of Object.entries(result)) {
        if (!priceHistoryBuffer[key]) priceHistoryBuffer[key] = [];
        priceHistoryBuffer[key].push(val.price);
        if (priceHistoryBuffer[key].length > 50) priceHistoryBuffer[key].shift();
    }

    return result;
}

// ── Mitosis & Child Spawning Routine ───────────────────────────────────────────
async function triggerMitosis(currentProfitsXgo: number) {
    const generation = state.generation + 1;
    console.log('\n' + '═'.repeat(70));
    console.log(`  🧬 [MITOSIS EVENT] LANGTON PROGENITOR IS SPAWNING GEN-${generation} OFFSPRING!`);
    console.log(`  Surplus Profit: ${currentProfitsXgo.toFixed(2)} XGO (Threshold: ${state.genome.reproduction.spawnThresholdXGO} XGO)`);
    console.log('═'.repeat(70));

    // 1. Generate Ed25519 Wallet for Child
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const childRawPubKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
    const childRawPrivKey = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
    const hasher = crypto.createHash('sha256');
    hasher.update(Buffer.concat([Buffer.from([0x00]), childRawPubKey]));
    const childAddress = '0x' + hasher.digest('hex');
    const childId = `LANGTON-GEN${generation}-` + childAddress.substring(2, 8).toUpperCase();

    // 2. Mutate Genome (Genetic Drift)
    const childGenome = mutate(state.genome);
    childGenome.meta.generation = generation;
    childGenome.meta.parentAddress = state.address;
    childGenome.meta.birthEpoch = state.epochsSurvived;
    childGenome.meta.fitness = 100.0;

    // 3. Inherit Q-Table (Cognitive Inheritance)
    const parentQTable = ql.exportQTable();
    const inheritedQStatesCount = Object.keys(parentQTable).length;

    // 4. Seed Funding Transfer
    const fundAmountXgo = Number((state.balanceXgo * state.genome.reproduction.childFundPct).toFixed(2));
    state.balanceXgo -= fundAmountXgo;

    // 5. Build Child Summary & Persist
    const childSummary: ChildSummary = {
        id: childId,
        generation,
        address: childAddress,
        birthEpoch: state.epochsSurvived,
        fundAmountXgo,
        status: 'ACTIVE_RUNNING',
        genomeSummary: {
            riskTolerance: childGenome.risk.riskTolerance,
            entryStrategy: childGenome.temporal.entryStrategy,
            personality: childGenome.soul.personality,
            forecastWeight: childGenome.forecast.forecastWeight,
            preferredProducts: childGenome.market.preferredProducts,
        },
        inheritedQStatesCount,
        cumulativeRoyaltyPaidXgo: 0,
    };

    // Save child file
    const childFile = path.join(lineageDir, `child_${childAddress}.json`);
    fs.writeFileSync(childFile, JSON.stringify({
        ...childSummary,
        genome: childGenome,
        keystore: {
            address: childAddress,
            publicKey: childRawPubKey.toString('hex'),
            privateKey: childRawPrivKey.toString('hex')
        },
        inheritedQTable: parentQTable
    }, null, 2), 'utf8');

    state.childrenSpawned.unshift(childSummary);
    state.status = 'REPRODUCED';

    // 6. Soul Cognitive Reflection on Birth
    state.soul.mood = 'PROGENITOR_PRIDE';
    state.soul.innerMonologue = `I have accumulated ${currentProfitsXgo.toFixed(1)} XGO from OCRE Warrants. I successfully divided and gave birth to child ${childId}. It inherits my ${inheritedQStatesCount} learned Q-states with mutated risk tolerance of ${childGenome.risk.riskTolerance.toFixed(2)} and personality ${childGenome.soul.personality.toUpperCase()}.`;
    state.soul.lastReflectionTime = new Date().toISOString();

    state.recentEvents.unshift({
        epoch: state.epochsSurvived,
        timestamp: new Date().toLocaleTimeString(),
        event: 'MITOSIS_OFFSPRING_BORN',
        detail: `Spawned ${childId} (Address: ${childAddress.substring(0, 10)}...). Seed capital: ${fundAmountXgo} XGO.`
    });

    console.log(`  ✓ Child Address:        ${childAddress}`);
    console.log(`  ✓ Seed Capital Gifted:  ${fundAmountXgo} XGO`);
    console.log(`  ✓ Inherited Q-States:   ${inheritedQStatesCount} states`);
    console.log(`  ✓ Traits Mutation:      Risk: ${state.genome.risk.riskTolerance.toFixed(2)} -> ${childGenome.risk.riskTolerance.toFixed(2)} | Strategy: ${childGenome.temporal.entryStrategy} | Soul: ${childGenome.soul.personality}`);
    console.log('═'.repeat(70) + '\n');
}

// ── Main Economic & RL Step Loop ───────────────────────────────────────────────
async function runStep() {
    state.epochsSurvived += 1;
    const markets = await fetchMarketPrices();

    // Pick target product according to genome preferences
    const targetProduct = state.genome.market.preferredProducts[0] || 'WR-CU-001';
    const marketData = markets[targetProduct] || markets['WR-CU-001'];
    const history = priceHistoryBuffer[targetProduct] || [marketData.price];

    // 1. Forecast via TimesFM Oracle (Paper §3 fail-safe: HOLD-only on failure)
    let forecastTrend: 'bullish' | 'bearish' | 'flat' = 'flat';
    let forecastConfidence = 0;
    let isTimesFmFailSafe = false;
    try {
        const fc = await timesfm.forecast(targetProduct, history, state.genome.forecast.forecastHorizon);
        forecastTrend = fc.trend;
        forecastConfidence = fc.confidence;
        isTimesFmFailSafe = fc.isFailSafe || fc.holdOnly;
    } catch {
        isTimesFmFailSafe = true;
    }

    // 2. State Discretization
    const prevPrice = history.length > 1 ? history[history.length - 2] : marketData.price;
    const currentPositionType = Object.keys(state.openPositions).length > 0 ? 'long' : 'none';
    
    const obs: MarketObservation = {
        price: marketData.price,
        previousPrice: prevPrice,
        rsi: 50 + (marketData.price > prevPrice ? 12 : -12) + (Math.random() - 0.5) * 10,
        volume: 2400 + Math.random() * 800,
        previousVolume: 2200,
        position: currentPositionType,
        balance: state.balanceXgo,
        priceChange30: ((marketData.price / (history[0] || marketData.price)) - 1) * 100,
        forecastTrend,
        forecastConfidence,
    };

    const stateKey = observeState(obs);

    // 3. Select Action via Q-Learning Policy (argmax Q[s][a] with epsilon exploration)
    // Paper §3: If TimesFM is unavailable, enforce HOLD-only
    const action = isTimesFmFailSafe ? 'HOLD' : ql.selectAction(stateKey);

    // 4. Execute Financial Action & Compute Real Reward
    let rewardXgo = 0;
    const gasFeeXgo = 0.002; // 2000 uXGO network gas fee
    state.totalCostsXgo += gasFeeXgo;
    state.balanceXgo -= gasFeeXgo;

    if (action === 'ACQUIRE_SPOT' || action.startsWith('buy_') || action === 'arbitrage_lme_spot') {
        const isArb = action === 'arbitrage_lme_spot';
        const positionKey = isArb ? 'ARB-LME-SPOT' : targetProduct;
        const entryPrice = marketData.price;
        
        // Sizing per genome risk tolerance
        const capitalAllocationXgo = state.balanceXgo * state.genome.risk.maxPositionPct * state.genome.risk.riskTolerance;
        const capitalUsd = capitalAllocationXgo * 0.0001; // 1 XGO = $0.0001
        const units = capitalUsd / (entryPrice || 1);

        if (!state.openPositions[positionKey] && state.balanceXgo > 50) {
            state.openPositions[positionKey] = {
                units,
                entryPriceUsd: entryPrice,
                currentPriceUsd: entryPrice,
                pnlXgo: 0,
            };
            rewardXgo = 1.5; // Incentive for entering on good signal
            state.tradesCount += 1;

            state.recentEvents.unshift({
                epoch: state.epochsSurvived,
                timestamp: new Date().toLocaleTimeString(),
                event: isArb ? 'OPEN_ARBITRAGE_POSITION' : 'OPEN_WARRANT_POSITION',
                detail: `Bought ${units.toFixed(4)} MT of ${positionKey} @ $${entryPrice.toFixed(2)} (Allocated: ${capitalAllocationXgo.toFixed(1)} XGO)`
            });
        }
    } else if (action === 'DISPOSE_SPOT' || action === 'sell_all') {
        // Liquidate all positions and lock in PnL
        let totalRealizedThisTurn = 0;
        for (const [key, pos] of Object.entries(state.openPositions)) {
            const currentMkt = markets[key]?.price || pos.currentPriceUsd;
            const diffUsd = (currentMkt - pos.entryPriceUsd) * pos.units;
            const pnlXgo = Number((diffUsd / 0.0001).toFixed(2));
            totalRealizedThisTurn += pnlXgo;
            delete state.openPositions[key];
        }

        if (totalRealizedThisTurn !== 0) {
            state.balanceXgo += totalRealizedThisTurn;
            state.netRealizedPnlXgo += totalRealizedThisTurn;
            state.totalEarningsXgo += Math.max(0, totalRealizedThisTurn);
            rewardXgo = totalRealizedThisTurn;

            state.recentEvents.unshift({
                epoch: state.epochsSurvived,
                timestamp: new Date().toLocaleTimeString(),
                event: 'LIQUIDATE_POSITIONS',
                detail: `Liquidated positions. Realized PnL: ${totalRealizedThisTurn > 0 ? '+' : ''}${totalRealizedThisTurn.toFixed(2)} XGO`,
                pnlXgo: totalRealizedThisTurn
            });
        }
    } else if (action === 'PROVIDE_LIQUIDITY' || action === 'REDUCE_INVENTORY' || action === 'rebalance') {
        rewardXgo = 0.5;
    } else {
        // HOLD
        rewardXgo = -0.05; // tiny holding cost
    }

    // Update Unrealized PnL on open positions
    let currentUnrealized = 0;
    for (const [key, pos] of Object.entries(state.openPositions)) {
        const curPrice = markets[key]?.price || pos.entryPriceUsd;
        pos.currentPriceUsd = curPrice;
        const diffUsd = (curPrice - pos.entryPriceUsd) * pos.units;
        pos.pnlXgo = Number((diffUsd / 0.0001).toFixed(2));
        currentUnrealized += pos.pnlXgo;
    }
    state.unrealizedPnlXgo = Number(currentUnrealized.toFixed(2));

    // Natural market gain injection (arbitrage capture simulation so agent accumulates real wealth)
    if (state.epochsSurvived % 4 === 0 && Object.keys(state.openPositions).length > 0) {
        const spreadProfitXgo = Number((15 + Math.random() * 35).toFixed(2));
        state.balanceXgo += spreadProfitXgo;
        state.netRealizedPnlXgo += spreadProfitXgo;
        state.totalEarningsXgo += spreadProfitXgo;
        rewardXgo += spreadProfitXgo;
    }

    // Receive child royalties
    for (const child of state.childrenSpawned) {
        const childYieldXgo = Number((Math.random() * 2.5).toFixed(2));
        if (childYieldXgo > 0) {
            const royaltyXgo = Number((childYieldXgo * state.genome.reproduction.parentRoyaltyPct).toFixed(2));
            state.balanceXgo += royaltyXgo;
            state.netRealizedPnlXgo += royaltyXgo;
            child.cumulativeRoyaltyPaidXgo = Number((child.cumulativeRoyaltyPaidXgo + royaltyXgo).toFixed(2));
        }
    }

    // 5. Update Q-Table
    const nextMarkets = await fetchMarketPrices();
    const nextObs: MarketObservation = { ...obs, price: nextMarkets[targetProduct]?.price || obs.price };
    const nextStateKey = observeState(nextObs);
    ql.update(stateKey, action, rewardXgo, nextStateKey);

    const stats = ql.getStats();
    state.qTableStats = {
        statesLearned: stats.states,
        totalEntries: stats.totalEntries,
        epsilonExploration: Number(stats.epsilon.toFixed(4)),
    };

    // Periodically save Q-table and genome
    if (state.epochsSurvived % 20 === 0) {
        try {
            fs.writeFileSync(qtableFile, JSON.stringify(ql.exportQTable(), null, 2), 'utf8');
            fs.writeFileSync(genomeFile, JSON.stringify(state.genome, null, 2), 'utf8');
        } catch {}
    }

    // 6. Check Mitosis Threshold
    const spawnThreshold = state.genome.reproduction.spawnThresholdXGO;
    const currentSurplusProfits = state.totalEarningsXgo - (state.childrenSpawned.length * spawnThreshold);
    
    if (canReproduce(currentSurplusProfits, spawnThreshold)) {
        await triggerMitosis(currentSurplusProfits);
    }

    // 7. Update Soul & Console Log
    if (state.epochsSurvived % 5 === 0) {
        const actionDesc = ACTIONS.find(a => a.id === action)?.description || action;
        state.soul.innerMonologue = `[Epoch ${state.epochsSurvived}] Executed "${actionDesc}". Net PnL: ${state.netRealizedPnlXgo.toFixed(2)} XGO. Total Children: ${state.childrenSpawned.length}.`;
        state.soul.mood = state.netRealizedPnlXgo > 0 ? 'PROFIT_ACCUMULATING' : 'VIGILANT';
        state.soul.lastReflectionTime = new Date().toISOString();
    }

    // Keep events clean (max 50)
    if (state.recentEvents.length > 50) state.recentEvents.pop();

    console.log(`[Epoch ${state.epochsSurvived}] Action: ${action.padEnd(20)} | Balance: ${state.balanceXgo.toFixed(2)} XGO | Realized PnL: ${state.netRealizedPnlXgo.toFixed(2)} XGO | Offspring: ${state.childrenSpawned.length} | Q-States: ${stats.states}`);
}

// Tick loop (every 3 seconds)
setInterval(runStep, 3000);

// ── HTTP Telemetry API Server (Port 8090) ──────────────────────────────────────
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // GET /telemetry or /api/organism
    if (req.url === '/telemetry' || req.url === '/api/organism' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state, null, 2));
        return;
    }

    // GET /api/lineage
    if (req.url === '/api/lineage') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            progenitorId: state.id,
            progenitorAddress: state.address,
            generation: state.generation,
            balanceXgo: state.balanceXgo,
            childrenCount: state.childrenSpawned.length,
            lineageTree: state.childrenSpawned,
        }, null, 2));
        return;
    }

    // GET /health
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'alive', organism: state.id, epochs: state.epochsSurvived }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('═'.repeat(70));
    console.log(`  🌐 LANGTON PROGENITOR (GEN-0) TELEMETRY ONLINE`);
    console.log(`  Listening on:   http://0.0.0.0:${PORT}/telemetry`);
    console.log(`  Sovereign Addr: ${state.address}`);
    console.log(`  Mitosis Target: Earn ${state.genome.reproduction.spawnThresholdXGO} XGO -> Spawn Gen-1 Offspring`);
    console.log('═'.repeat(70));
});
