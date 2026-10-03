/**
 * Langton Execution Safety Layer — Paper §6 Canonical Implementation
 *
 * Enforces mandatory pre-trade risk and accounting constraints independent of learned rewards:
 * 1. Gas Reserve Invariant: B - L - C >= g_gas (§6)
 * 2. Concentration Bound: E_i / V <= g_ω (§6)
 * 3. Funded Runway Ratio: ρ_t = R_exec / c_t (§3.6, §6, §12)
 * 4. Circuit Breaker: Trailing 24h drawdown >= 15% triggers 4h lockout (§6.2)
 * 5. Execution Viability: Slippage, market depth liquidity, and oracle freshness (§6, §6.2)
 *
 * Computes the safe admissible action set A_safe(z_t) ⊆ A.
 *
 * Reference: GLOFICA_Langton_Autonomon.md §6, §6.1, §6.2
 */

import { ActionLabel, ACTION_LABELS } from '../rl/actions.js';
import { LangtonGenome, NumericGenome } from '../genome/types.js';

export interface SafetyLayerConfig {
    /** Maximum allowed slippage (e.g. 0.01 for 1%) */
    maxSlippagePct: number;
    /** Maximum oracle price age in seconds before considered stale */
    maxOracleAgeSeconds: number;
    /** Drawdown threshold that trips circuit breaker (0.15 = 15%) */
    drawdownBreakerThreshold: number;
    /** Duration of circuit breaker lockout in milliseconds (4 hours = 14,400,000 ms) */
    breakerLockoutMs: number;
    /** Maximum fraction of available market depth an order can consume */
    maxDepthRatio: number;
}

export const DEFAULT_SAFETY_CONFIG: SafetyLayerConfig = {
    maxSlippagePct: 0.01,              // 1.0% maximum slippage
    maxOracleAgeSeconds: 60,           // 60 seconds freshness bound
    drawdownBreakerThreshold: 0.15,    // 15% trailing 24h drawdown
    breakerLockoutMs: 4 * 60 * 60 * 1000, // 4 hours lockout
    maxDepthRatio: 0.20,               // Max 20% of depth
};

export interface ExecutionSnapshot {
    /** Current liquid XGO gas balance B */
    balanceGasXgo: number;
    /** Pending unfinalized transaction gas reservations */
    pendingGasReservationsXgo?: number;
    /** Marked net asset value V (must be positive for concentration checks) */
    navUsd: number;
    /** Current marked exposure per instrument E_i in USD */
    instrumentExposuresUsd?: Record<string, number>;
    /** Funded runway in months rho_t = R_exec / c_t */
    runwayMonths: number;
    /** Trailing 24h flow-adjusted drawdown (e.g. 0.12 = 12%) */
    trailingDrawdownPct: number;
    /** Timestamp of the oracle price feed used for valuation (ms) */
    oracleTimestampMs: number;
    /** Current system clock timestamp (ms) */
    currentTimestampMs: number;
    /** Available market liquidity / depth in USD for the target instrument */
    marketDepthUsd?: number;
    /** Optional externally persisted breaker state */
    breakerTrippedUntilMs?: number;
}

export interface ProposedTransaction {
    /** Canonical abstract action to execute */
    action: ActionLabel;
    /** Target instrument identifier (e.g. 'WR-CU-001') */
    instrument?: string;
    /** Estimated trade spend L from gas balance (in XGO) */
    tradeSpendXgo?: number;
    /** Maximum transaction fee C charged even if trade fails (in XGO) */
    maxFeeXgo?: number;
    /** Value of proposed order in USD (delta E_i) */
    orderValueUsd?: number;
    /** Expected price slippage as a fraction (e.g. 0.005 for 0.5%) */
    expectedSlippagePct?: number;
}

export interface SafetyCheckResult {
    /** Whether the proposed transaction is admissible for execution */
    admissible: boolean;
    /** Complete set of admissible actions A_safe(z_t) */
    admissibleActions: ActionLabel[];
    /** List of violated constraints (empty if fully admissible) */
    violations: string[];
    /** Current breaker active state */
    isBreakerActive: boolean;
    /** Diagnostic metrics evaluated during check */
    diagnostics: {
        effectiveGasXgo: number;
        postTradeGasXgo: number;
        requiredGasReserveXgo: number;
        postTradeExposureRatio?: number;
        maxAllowedExposureRatio: number;
        runwayMonths: number;
        drawdownPct: number;
        oracleAgeSeconds: number;
    };
}

export class SafetyLayer {
    private config: SafetyLayerConfig;
    private breakerUntilMs: number = 0;

    constructor(config: Partial<SafetyLayerConfig> = {}) {
        this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
    }

    /**
     * Evaluate execution safety and filter admissible actions A_safe(z_t) per Paper §6.
     */
    evaluate(
        snapshot: ExecutionSnapshot,
        genome: NumericGenome | LangtonGenome,
        proposed?: ProposedTransaction
    ): SafetyCheckResult {
        const violations: string[] = [];
        const now = snapshot.currentTimestampMs;

        // ── 1. Circuit Breaker Check (§6.2) ──
        if (snapshot.breakerTrippedUntilMs && snapshot.breakerTrippedUntilMs > now) {
            this.breakerUntilMs = Math.max(this.breakerUntilMs, snapshot.breakerTrippedUntilMs);
        }

        if (snapshot.trailingDrawdownPct >= this.config.drawdownBreakerThreshold) {
            this.breakerUntilMs = Math.max(this.breakerUntilMs, now + this.config.breakerLockoutMs);
        }

        const isBreakerActive = this.breakerUntilMs > now;
        if (isBreakerActive) {
            violations.push(
                `[CircuitBreaker] Active 4-hour trading lockout (Drawdown: ${(snapshot.trailingDrawdownPct * 100).toFixed(1)}% >= ${(this.config.drawdownBreakerThreshold * 100).toFixed(1)}%). Remaining lockout: ${Math.round((this.breakerUntilMs - now) / 60000)}m.`
            );
        }

        // ── 2. Gas Reserve Invariant Check: B - L - C >= g_gas (§6) ──
        const B = snapshot.balanceGasXgo - (snapshot.pendingGasReservationsXgo ?? 0);
        const L = proposed?.tradeSpendXgo ?? 0;
        const C = proposed?.maxFeeXgo ?? 0.005; // conservative default network fee
        const g_gas = genome.g_gas;
        const postTradeGas = B - L - C;

        if (postTradeGas < g_gas) {
            violations.push(
                `[GasReserve] Invariant B - L - C >= g_gas violated: (${B.toFixed(2)} - ${L.toFixed(2)} - ${C.toFixed(4)}) = ${postTradeGas.toFixed(2)} < required ${g_gas} XGO.`
            );
        }

        // ── 3. Operational Runway Ratio Check (§3.6, §6, §12) ──
        if (snapshot.runwayMonths < 1.0) {
            violations.push(
                `[RunwayCritical] Funded operating runway ρ_t = ${snapshot.runwayMonths.toFixed(2)} months < 1.0 month. Capital preservation mandatory.`
            );
        }

        // ── 4. Oracle Freshness Check (§6, §6.2) ──
        const oracleAgeSeconds = Math.max(0, (now - snapshot.oracleTimestampMs) / 1000);
        if (oracleAgeSeconds > this.config.maxOracleAgeSeconds) {
            violations.push(
                `[OracleStale] Price quote age ${oracleAgeSeconds.toFixed(1)}s exceeds max freshness threshold ${this.config.maxOracleAgeSeconds}s.`
            );
        }

        // ── 5. Concentration Cap Check: E_i / V <= g_ω (§6) ──
        let postTradeExposureRatio: number | undefined;
        const g_omega = genome.g_omega;

        if (proposed && (proposed.action === 'ACQUIRE_SPOT' || proposed.action === 'PROVIDE_LIQUIDITY')) {
            if (snapshot.navUsd <= 0) {
                violations.push(`[Concentration] Invalid non-positive NAV: ${snapshot.navUsd} USD.`);
            } else {
                const currentExposure = proposed.instrument && snapshot.instrumentExposuresUsd
                    ? (snapshot.instrumentExposuresUsd[proposed.instrument] ?? 0)
                    : 0;
                const newExposure = currentExposure + (proposed.orderValueUsd ?? 0);
                postTradeExposureRatio = newExposure / snapshot.navUsd;

                if (postTradeExposureRatio > g_omega) {
                    violations.push(
                        `[ConcentrationCap] Post-trade concentration E_i / V = ${(postTradeExposureRatio * 100).toFixed(2)}% exceeds g_ω cap ${(g_omega * 100).toFixed(1)}%.`
                    );
                }
            }
        }

        // ── 6. Slippage & Liquidity Checks (§6, §6.2) ──
        if (proposed?.expectedSlippagePct !== undefined && proposed.expectedSlippagePct > this.config.maxSlippagePct) {
            violations.push(
                `[SlippageExceeded] Expected slippage ${(proposed.expectedSlippagePct * 100).toFixed(2)}% exceeds max ${(this.config.maxSlippagePct * 100).toFixed(2)}%.`
            );
        }

        if (proposed?.orderValueUsd !== undefined && snapshot.marketDepthUsd !== undefined && snapshot.marketDepthUsd > 0) {
            const depthRatio = proposed.orderValueUsd / snapshot.marketDepthUsd;
            if (depthRatio > this.config.maxDepthRatio) {
                violations.push(
                    `[InsufficientLiquidity] Order value ($${proposed.orderValueUsd.toFixed(2)}) is ${(depthRatio * 100).toFixed(1)}% of market depth ($${snapshot.marketDepthUsd.toFixed(2)}), exceeding ${(this.config.maxDepthRatio * 100).toFixed(1)}% cap.`
                );
            }
        }

        // ── 7. Derive Admissible Action Set A_safe(z_t) ⊆ A (§4, §6) ──
        const admissibleActions: ActionLabel[] = ['HOLD']; // HOLD is always admissible as fail-safe

        // Risk-reducing actions remain admissible unless gas invariant is severely broken
        if (postTradeGas >= 0) {
            admissibleActions.push('DISPOSE_SPOT');
            admissibleActions.push('REDUCE_INVENTORY');
        }

        // Risk-increasing actions require NO breaker, valid gas, solvent runway, fresh oracle, and within concentration
        const canIncreaseRisk =
            !isBreakerActive &&
            postTradeGas >= g_gas &&
            snapshot.runwayMonths >= 1.0 &&
            oracleAgeSeconds <= this.config.maxOracleAgeSeconds;

        if (canIncreaseRisk) {
            admissibleActions.push('ACQUIRE_SPOT');
            admissibleActions.push('PROVIDE_LIQUIDITY');
        }

        // Check if the specific proposed action is admissible
        const isProposedActionAdmissible = proposed
            ? admissibleActions.includes(proposed.action) && violations.length === 0
            : violations.length === 0;

        return {
            admissible: isProposedActionAdmissible,
            admissibleActions,
            violations,
            isBreakerActive,
            diagnostics: {
                effectiveGasXgo: B,
                postTradeGasXgo: postTradeGas,
                requiredGasReserveXgo: g_gas,
                postTradeExposureRatio,
                maxAllowedExposureRatio: g_omega,
                runwayMonths: snapshot.runwayMonths,
                drawdownPct: snapshot.trailingDrawdownPct,
                oracleAgeSeconds,
            },
        };
    }
}
