import { describe, it, expect } from 'vitest';
import {
    SelfFundingLedger,
    computeCostHurdle,
    computeRunwayRatio,
    computeEffectiveExposureCap,
    computeMinimumEquityBudget,
} from '../src/infra/self-funding.js';

describe('Paper §12 Self-Funding Model', () => {
    it('maintains strict 4-way account segregation (trading, runway, gas, stake)', () => {
        const ledger = new SelfFundingLedger({
            trading: 10000,
            runway: 300000, // 2 months runway at 150k/mo
            gas: 500,
            stake: 50000,
        });

        const balances = ledger.getBalances();
        expect(balances.trading).toBe(10000);
        expect(balances.runway).toBe(300000);
        expect(balances.gas).toBe(500);
        expect(balances.stake).toBe(50000);
        expect(ledger.getTotalBalanceXgo()).toBe(360500);

        // Cannot double spend or overdraw an account
        const transferSuccess = ledger.transfer('gas', 'trading', 600); // 600 > 500
        expect(transferSuccess).toBe(false);
        expect(ledger.getBalances().gas).toBe(500);

        const validTransfer = ledger.transfer('runway', 'trading', 50000);
        expect(validTransfer).toBe(true);
        expect(ledger.getBalances().runway).toBe(250000);
        expect(ledger.getBalances().trading).toBe(60000);
    });

    it('calculates dynamic cost hurdle κ_t = c_t^USD / A_t^USD per §12.1', () => {
        // c = 15 USD, A = 3000 USD (30M XGO @ 0.0001) -> kappa = 15 / 3000 = 0.005 (0.5%)
        const kappa = computeCostHurdle(15, 3000);
        expect(kappa).toBeCloseTo(0.005, 5);

        // Lower trading equity increases the hurdle burden
        const highHurdle = computeCostHurdle(15, 500); // 15 / 500 = 0.03 (3.0%)
        expect(highHurdle).toBeCloseTo(0.03, 5);

        // Zero equity gives Infinity
        expect(computeCostHurdle(15, 0)).toBe(Infinity);
    });

    it('calculates minimum equity budget A_min^USD = c^USD / kappa_max per §12.1', () => {
        // c = 15 USD, kappa_max = 0.005 (0.5%) -> A_min = 15 / 0.005 = 3000 USD
        const minEquity = computeMinimumEquityBudget(15, 0.005);
        expect(minEquity).toBe(3000);

        // c = 5 USD, kappa_max = 0.005 -> A_min = 1000 USD
        expect(computeMinimumEquityBudget(5, 0.005)).toBe(1000);
    });

    it('calculates runway ratio ρ_t = B_run / c_xgo per §3.6 and §12.2', () => {
        // 15 USD monthly budget @ 0.0001 USD/XGO = 150,000 XGO/month
        const monthlyCostXgo = 150000;

        expect(computeRunwayRatio(450000, monthlyCostXgo)).toBe(3.0); // 3 months
        expect(computeRunwayRatio(150000, monthlyCostXgo)).toBe(1.0); // 1 month
        expect(computeRunwayRatio(75000, monthlyCostXgo)).toBe(0.5);  // Critical 0.5 month
    });

    it('enforces runway-adjusted decreasing exposure cap g_ω^eff(ρ) per §12.2', () => {
        const g_omega = 0.20; // 20% genome cap

        // At rho <= 1: Effective cap collapses to 0.0
        expect(computeEffectiveExposureCap(g_omega, 1.0)).toBe(0.0);
        expect(computeEffectiveExposureCap(g_omega, 0.5)).toBe(0.0);

        // At rho = 2 (midpoint): Cap is 50% of genome cap = 0.10
        expect(computeEffectiveExposureCap(g_omega, 2.0)).toBe(0.10);

        // At rho >= 3: Full genome cap 0.20
        expect(computeEffectiveExposureCap(g_omega, 3.0)).toBe(0.20);
        expect(computeEffectiveExposureCap(g_omega, 5.0)).toBe(0.20);
    });

    it('deducts hosting invoices strictly from runway account', () => {
        const ledger = new SelfFundingLedger({
            runway: 300000,
            trading: 50000,
        });

        // Pay 15 USD invoice = 150,000 XGO
        const invoice = ledger.payMonthlyHostingInvoice('AGENT-01', 15);

        expect(invoice.status).toBe('paid');
        expect(invoice.costXgo).toBe(150000);
        expect(ledger.getBalances().runway).toBe(150000);
        expect(ledger.getBalances().trading).toBe(50000); // Trading untouched!
    });
});
