/**
 * Langton Self-Funding Infrastructure Ledger — Paper §12 Canonical Model
 *
 * Implements the economic survival, segregated accounting, and dynamic runway controls:
 * 1. Account Segregation (§3.6, §12.2):
 *    Strict four-way balance separation (trading, runway, gas, stake).
 *    Balances cannot fund two commitments simultaneously.
 * 2. Dynamic Cost Hurdle κ_t = c_t^USD / A_t^USD (§12.1).
 * 3. Decreasing Exposure Cap g_ω^eff(ρ) = g_ω * clip((ρ - 1) / 2, 0, 1) (§12.2):
 *    - At ρ <= 1: Effective cap is 0 (no new risk allowed).
 *    - At 1 < ρ < 3: Cap scales linearly from 0 to g_ω.
 *    - At ρ >= 3: Full genome cap g_ω.
 * 4. Fixed-cost survival analysis & runway tracking (§12.3).
 *
 * Reference: GLOFICA_Langton_Autonomon.md §3.6, §12.1, §12.2, §12.3
 */

export type AccountType = 'trading' | 'runway' | 'gas' | 'stake';

export interface SegregatedAccounts {
    /** Deployable trading capital V_trade (in XGO) */
    trading: number;
    /** Segregated unencumbered operating runway reserve B_run (in XGO) */
    runway: number;
    /** Protected transaction gas reserve B_gas (in XGO) */
    gas: number;
    /** Locked consensus validator stake S_stake (in XGO) */
    stake: number;
}

export interface OperatingCostConfig {
    /** Monthly operating budget in USD (c^USD, e.g. 15.00 USD) */
    monthlyCostUsd: number;
    /** Conservative executable conversion price p^exec in USD/XGO (e.g. 0.0001) */
    pExecUsdPerXgo: number;
    /** Configured maximum acceptable operating burden kappa_max (e.g. 0.005 for 0.5%/month) */
    kappaMax: number;
}

export const DEFAULT_OPERATING_CONFIG: OperatingCostConfig = {
    monthlyCostUsd: 15.00,       // 15 USD/month baseline hosting/infra
    pExecUsdPerXgo: 0.0001,      // 1 XGO = $0.0001 USD (10,000 XGO = $1.00 USD)
    kappaMax: 0.005,             // 0.5% max monthly operating burden
};

export interface InfraExpense {
    id: string;
    item: 'vps_compute' | 'storage_expansion' | 'bandwidth' | 'security_audit';
    costUsd: number;
    costXgo: number;
    paidAt: string;
    validUntil: string;
    status: 'paid' | 'pending' | 'deficiency_warning';
}

export interface SelfFundingReport {
    agentId: string;
    accounts: SegregatedAccounts;
    totalBalanceXgo: number;
    totalValueUsd: number;
    monthlyCostUsd: number;
    monthlyCostXgo: number;
    runwayRatioRho: number;
    effectiveExposureCap: number;
    costHurdleKappa: number;
    minEquityBudgetUsd: number;
    isSelfSustaining: boolean;
    recentInvoices: InfraExpense[];
    statusMessage: string;
}

// ── Pure Mathematical Functions (§12.1 – §12.3) ──

/**
 * §12.1 Monthly cost hurdle κ_t = c_t^USD / A_t^USD
 * @param c_usd Monthly operating cost in USD
 * @param a_usd Deployable trading equity in USD (p * V_trade)
 */
export function computeCostHurdle(c_usd: number, a_usd: number): number {
    if (a_usd <= 0) return Infinity;
    return c_usd / a_usd;
}

/**
 * §12.1 Minimum trading equity required to keep cost hurdle under kappa_max:
 * A_min^USD = c^USD / kappa_max
 */
export function computeMinimumEquityBudget(c_usd: number, kappa_max: number = 0.005): number {
    if (kappa_max <= 0) return Infinity;
    return c_usd / kappa_max;
}

/**
 * §3.6 & §12.2 Funded operating runway ratio ρ_t = R_exec^USD / c^USD = B_run / c_xgo
 * @param runwayBalanceXgo Liquid segregated runway reserve B_run
 * @param monthlyCostXgo Monthly operating budget in XGO
 */
export function computeRunwayRatio(runwayBalanceXgo: number, monthlyCostXgo: number): number {
    if (monthlyCostXgo <= 0) return Infinity;
    return runwayBalanceXgo / monthlyCostXgo;
}

/**
 * §12.2 Runway-adjusted new-exposure cap:
 * g_ω^eff(ρ) = g_ω * clip((ρ - 1) / 2, 0, 1)
 *
 * Properties:
 * - ρ <= 1: Returns 0.0 (no risk-increasing actions permitted)
 * - 1 < ρ < 3: Linearly increases from 0.0 to g_ω
 * - ρ >= 3: Returns full g_ω
 */
export function computeEffectiveExposureCap(g_omega: number, rho: number): number {
    const factor = Math.max(0, Math.min(1, (rho - 1) / 2));
    return Number((g_omega * factor).toFixed(4));
}

// ── Sovereign Self-Funding Ledger Class ──

export class SelfFundingLedger {
    private accounts: SegregatedAccounts;
    private config: OperatingCostConfig;
    private expenses: InfraExpense[] = [];

    constructor(
        initialBalances: Partial<SegregatedAccounts> = {},
        config: Partial<OperatingCostConfig> = {}
    ) {
        this.accounts = {
            trading: initialBalances.trading ?? 0,
            runway: initialBalances.runway ?? 0,
            gas: initialBalances.gas ?? 0,
            stake: initialBalances.stake ?? 0,
        };
        this.config = { ...DEFAULT_OPERATING_CONFIG, ...config };
    }

    /** Get current account balances */
    getBalances(): SegregatedAccounts {
        return { ...this.accounts };
    }

    /** Total XGO across all 4 segregated accounts */
    getTotalBalanceXgo(): number {
        return (
            this.accounts.trading +
            this.accounts.runway +
            this.accounts.gas +
            this.accounts.stake
        );
    }

    /** Monthly operating cost in XGO: c_xgo = c^USD / p^exec */
    getMonthlyCostXgo(): number {
        return this.config.monthlyCostUsd / this.config.pExecUsdPerXgo;
    }

    /** Deposit XGO directly into a specific segregated account */
    deposit(account: AccountType, amountXgo: number): void {
        if (amountXgo <= 0) return;
        this.accounts[account] += amountXgo;
    }

    /**
     * Transfer funds between segregated accounts.
     * Enforces that funds cannot be double-spent across allocations (§3.6).
     */
    transfer(from: AccountType, to: AccountType, amountXgo: number): boolean {
        if (amountXgo <= 0 || this.accounts[from] < amountXgo) {
            return false;
        }
        this.accounts[from] -= amountXgo;
        this.accounts[to] += amountXgo;
        return true;
    }

    /** Allocate trading profits across accounts (e.g. 50% trading, 30% runway, 20% gas) */
    allocateProfits(
        profitXgo: number,
        distribution: { tradingPct: number; runwayPct: number; gasPct: number } = {
            tradingPct: 0.50,
            runwayPct: 0.30,
            gasPct: 0.20,
        }
    ): void {
        if (profitXgo <= 0) return;
        this.accounts.trading += profitXgo * distribution.tradingPct;
        this.accounts.runway += profitXgo * distribution.runwayPct;
        this.accounts.gas += profitXgo * distribution.gasPct;
    }

    /** Current funded runway ratio rho_t = B_run / c_xgo (§3.6, §12.2) */
    getRunwayRatio(): number {
        return computeRunwayRatio(this.accounts.runway, this.getMonthlyCostXgo());
    }

    /** Current cost hurdle kappa_t = c^USD / A^USD (§12.1) */
    getCostHurdle(): number {
        const tradingUsd = this.accounts.trading * this.config.pExecUsdPerXgo;
        return computeCostHurdle(this.config.monthlyCostUsd, tradingUsd);
    }

    /**
     * Get runway-adjusted exposure cap g_ω^eff(ρ) per §12.2
     */
    getEffectiveExposureCap(genomeOmega: number): number {
        const rho = this.getRunwayRatio();
        return computeEffectiveExposureCap(genomeOmega, rho);
    }

    /**
     * Pay the monthly hosting and cluster maintenance invoice strictly from the runway account.
     */
    payMonthlyHostingInvoice(
        agentId: string,
        vpsCostUsd: number = this.config.monthlyCostUsd
    ): InfraExpense {
        const costXgo = vpsCostUsd / this.config.pExecUsdPerXgo;
        const paid = this.accounts.runway >= costXgo;

        if (paid) {
            this.accounts.runway -= costXgo;
        }

        const now = new Date();
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const expense: InfraExpense = {
            id: `INV-${Date.now().toString().slice(-6)}`,
            item: 'vps_compute',
            costUsd: vpsCostUsd,
            costXgo,
            paidAt: now.toISOString(),
            validUntil: nextMonth.toISOString(),
            status: paid ? 'paid' : 'deficiency_warning',
        };

        this.expenses.push(expense);
        return expense;
    }

    /**
     * Generate sovereign financial independence report with Paper §12 metrics.
     */
    getFundingReport(agentId: string, genomeOmega = 0.20): SelfFundingReport {
        const rho = this.getRunwayRatio();
        const kappa = this.getCostHurdle();
        const effectiveCap = this.getEffectiveExposureCap(genomeOmega);
        const minEquityUsd = computeMinimumEquityBudget(this.config.monthlyCostUsd, this.config.kappaMax);
        const totalXgo = this.getTotalBalanceXgo();
        const totalUsd = totalXgo * this.config.pExecUsdPerXgo;

        const isSelfSustaining = rho >= 3.0 && kappa <= this.config.kappaMax;

        return {
            agentId,
            accounts: this.getBalances(),
            totalBalanceXgo: totalXgo,
            totalValueUsd: Number(totalUsd.toFixed(2)),
            monthlyCostUsd: this.config.monthlyCostUsd,
            monthlyCostXgo: this.getMonthlyCostXgo(),
            runwayRatioRho: Number(rho.toFixed(2)),
            effectiveExposureCap: effectiveCap,
            costHurdleKappa: Number(kappa.toFixed(4)),
            minEquityBudgetUsd: minEquityUsd,
            isSelfSustaining,
            recentInvoices: this.expenses.slice(-5),
            statusMessage: isSelfSustaining
                ? `Node fully self-sustaining. Runway: ${rho.toFixed(1)} months (rho >= 3). Cost burden ${(kappa * 100).toFixed(2)}% <= ${(this.config.kappaMax * 100).toFixed(1)}%.`
                : rho < 1.0
                ? `CRITICAL RUNWAY: rho = ${rho.toFixed(2)} < 1.0 month. Effective exposure cap collapsed to 0%.`
                : `Operational. Runway: ${rho.toFixed(1)} months. Exposure cap throttled to ${(effectiveCap * 100).toFixed(1)}%.`,
        };
    }
}
