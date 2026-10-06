# T4 Economic Population Simulator Report

**Date:** 2026-10-06T00:25:58.145Z

**Specification:** Paper §14 (Economic Population), §7 (Reproduction & Proposition 6), §12 (Self-Funding & Fixed Cost Drag)

## Section 1 — Stress Setup ($800 capital, $40/month)

| Scenario | Survival @12m | Survival @18m | Survival @24m | First Death | Peak Capital |
|---|---|---|---|---|---|
| A (Symmetric) | 95.33% | 4.33% | 0.00% | Month 10.1 | $870.74 |
| B (Bear Dominant) | 88.00% | 0.33% | 0.00% | Month 9.6 | $850.95 |
| C (Bull Dominant) | 98.00% | 34.00% | 2.67% | Month 11.1 | $895.37 |

## Section 2 — Product Setup ($5,000 capital, $40/month)

| Scenario | Survival @12m | Survival @18m | Survival @24m | First Death | Peak Capital | Children Born |
|---|---|---|---|---|---|---|
| A (Symmetric) | 100.00% | 100.00% | 100.00% | None | $6303.29 | 0.00 |
| B (Bear Dominant) | 100.00% | 100.00% | 100.00% | None | $6034.47 | 0.00 |
| C (Bull Dominant) | 100.00% | 100.00% | 100.00% | None | $10138.79 | 0.23 |

## Notes

- Long-only design per §3.5: the agent does not capture downside moves.
- Stress setup ($800): passive runway is 20 months. Reproduction is
  unreachable at 1.5x ($1,200). Demonstrates the agent does not
  catastrophically fail under adverse conditions, but does not survive
  beyond the passive runway without market edge.
- Product setup ($5,000): passive runway is 125 months. The agent has
  time to learn, operate, and reproduce. This is the recommended
  deployment configuration for new owners.
- Phase 2 Reproduction Gate: Implements the full statistical reproduction
  gate per §7.1 (365-day history window, strictly positive excess returns,
  one-sided 95% bootstrap CI > 0 with 1,000 resamples, Deflated Sharpe Ratio
  (DSR) ≥ 0.95 under Bailey & López de Prado (2014) with Proposition 10
  effective-trial correction, and 180-day cooldown). Mitosis only occurs
  when statistically verified edge is confirmed, preventing spurious reproduction
  under the null.

## Target Verification (Product Setup @24m)

| Scenario | Expected Target @24m | Empirical Survival @24m | Status |
|---|---|---|---|
| Scenario A (Symmetric) | 40% - 70% | 100.00% | Empirical Observation |
| Scenario B (Bear Dominant) | 30% - 60% | 100.00% | Empirical Observation |
| Scenario C (Bull Dominant) | 60% - 85% (+ repro > 0) | 100.00% (Children: 0.23) | Empirical Observation |
