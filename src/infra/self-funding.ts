/**
 * Langton Self-Funding Infrastructure Ledger
 *
 * Implements the economic self-sustenance loop:
 * The agent pays for its own server hardware, VPS hosting, bandwidth,
 * and node maintenance directly from its trading and investment earnings.
 */

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
    cumulativeEarningsXgo: number;
    infraReserveXgo: number;
    totalExpensesPaidUsd: number;
    daysOfComputeFunded: number;
    isSelfSustaining: boolean;
    recentInvoices: InfraExpense[];
    statusMessage: string;
}

export class SelfFundingLedger {
    private reserveXgo = 0;
    private expenses: InfraExpense[] = [];

    /**
     * Allocate a portion of trading profits to the infrastructure reserve.
     */
    fundReserveFromProfits(profitXgo: number, allocationPct = 0.20): number {
        const contribution = Math.max(0, profitXgo * allocationPct);
        this.reserveXgo += contribution;
        return contribution;
    }

    /**
     * Pay the monthly hosting and cluster maintenance invoice from the reserve.
     * Exchange rate base: 1 XGO = $0.0001 USD (10,000 XGO = $1.00 USD)
     */
    payMonthlyHostingInvoice(agentId: string, vpsCostUsd = 20): InfraExpense {
        const xgoPerUsd = 10_000;
        const requiredXgo = vpsCostUsd * xgoPerUsd;

        const paid = this.reserveXgo >= requiredXgo;
        if (paid) {
            this.reserveXgo -= requiredXgo;
        }

        const now = new Date();
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const expense: InfraExpense = {
            id: `INV-${Date.now().toString().slice(-6)}`,
            item: 'vps_compute',
            costUsd: vpsCostUsd,
            costXgo: requiredXgo,
            paidAt: now.toISOString(),
            validUntil: nextMonth.toISOString(),
            status: paid ? 'paid' : 'deficiency_warning',
        };

        this.expenses.push(expense);
        return expense;
    }

    /**
     * Generate sovereign financial independence report.
     */
    getFundingReport(agentId: string, cumulativeEarningsXgo: number): SelfFundingReport {
        const totalPaidUsd = this.expenses
            .filter(e => e.status === 'paid')
            .reduce((sum, e) => sum + e.costUsd, 0);

        const activeCoverage = this.expenses.filter(e => e.status === 'paid' && new Date(e.validUntil) > new Date());
        const daysCoverage = activeCoverage.length * 30;

        return {
            agentId,
            cumulativeEarningsXgo,
            infraReserveXgo: Number(this.reserveXgo.toFixed(2)),
            totalExpensesPaidUsd: totalPaidUsd,
            daysOfComputeFunded: daysCoverage,
            isSelfSustaining: cumulativeEarningsXgo > 200_000 || daysCoverage >= 30,
            recentInvoices: this.expenses.slice(-5),
            statusMessage: daysCoverage >= 30
                ? `Node server fully funded by agent profits (${daysCoverage} days prepaid). Zero human intervention required.`
                : 'Accumulating initial trading yield for next compute epoch.',
        };
    }
}
