/**
 * Langton Agents — Complete Entry Point
 *
 * Three-Tier Architecture:
 * 1. Financial Brain (Q-Learning) & Sovereign Ed25519 Wallet (25MB lightweight Bun agent)
 * 2. Shared Predictive Oracle (TimesFM Python container via HTTP)
 * 3. Shared Cognitive Soul (Ollama / Qwen 2.5 service via HTTP)
 * + Autonomous Node & Cluster DevOps (RocksDB pruner, security watchdog, self-funding)
 */

// Genome & Mutation (Paper §7)
export {
    type LangtonGenome,
    type NumericGenome,
    type GenomeLocusDefinition,
    GENOME_LOCI,
    clipGenomeToBox,
    type RiskModule,
    type MarketModule,
    type TemporalModule,
    type ForecastModule,
    type SoulModule,
    type SoulPersonality,
    type SocialModule,
    type ReproductionModule,
    type MetaModule,
    DEFAULT_GENOME,
} from './genome/types.js';
export { mutate, mutateNumericGenome, mutateLocus } from './genome/mutation.js';
export { calculateFitness, shouldDie, canReproduce, type FitnessInput, type FitnessScore } from './genome/fitness.js';

// Reinforcement Learning
export { QLearning, type QLearningConfig, DEFAULT_QL_CONFIG } from './rl/q-learning.js';
export {
    discretize,
    stateToKey,
    observeState,
    type MarketObservation,
    type DiscreteState,
    type ForecastTrend,
    type ForecastConfidence,
} from './rl/state.js';
export { ACTIONS, ACTION_IDS, getAction, filterActions, type Action } from './rl/actions.js';

// TimesFM Foundation Forecasting (Shared Oracle)
export { TimesFMClient, type TimesFMConfig, type TimesFMForecast } from './market/timesfm.js';

// Soul & Cognition (Shared Ollama / Qwen)
export { LangtonSoul, type SoulConfig, type ReflectionInput, type SoulReflection } from './soul/qwen.js';

// Evolution
export { prepareSpawn, calculateChildFunding, type SpawnConfig, type SpawnResult } from './evolution/spawn.js';

// Safety Layer (Paper §6)
export {
    SafetyLayer,
    type SafetyLayerConfig,
    type ExecutionSnapshot,
    type ProposedTransaction,
    type SafetyCheckResult,
    DEFAULT_SAFETY_CONFIG,
} from './safety/safetyLayer.js';

// Autonomous Node DevOps & Self-Funding (Paper §12)
export { RocksDbPruner, type StorageMetrics, type PruneResult } from './infra/rocksdb-pruner.js';
export { SecuritySentinel, type SecurityAuditResult } from './infra/security-sentinel.js';
export {
    SelfFundingLedger,
    type InfraExpense,
    type SelfFundingReport,
    type SegregatedAccounts,
    type AccountType,
    type OperatingCostConfig,
    computeCostHurdle,
    computeRunwayRatio,
    computeEffectiveExposureCap,
    computeMinimumEquityBudget,
    DEFAULT_OPERATING_CONFIG,
} from './infra/self-funding.js';
