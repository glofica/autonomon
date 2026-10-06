# T1 No-Edge Null Test Suite Report

**Date:** 2026-10-04T01:08:00.947Z

**Variant:** T1b — epsilon = 0 (exploitation only)

## Configuration

| Parameter | Value |
|---|---|
| Seeds Evaluated | 30 (Seeds 1 through 30) |
| Steps per Seed | 10,000 |
| Initial Capital | $10,000 |
| Price Volatility (sigma) | 0.30 |
| Step Size (dt) | 5 / (60 * 24 * 365) (~9.5129e-6) |
| Transaction Fee | 10 bps |
| Execution Slippage | 5 bps |
| Material Edge Bound | 0.5000% annualized |

## Metrics (Across 30 Seeds)

| Metric | Point Estimate | 95% Bootstrap CI |
|---|---|---|
| Mean Net Return (Annualized) | 0.0000% (0.00 bps) | [0.0000%, 0.0000%] |
| Median Net Return (Annualized) | 0.0000% | - |
| Standard Deviation (Annualized) | 0.0000% | - |
| False Positive Rate | 0.0000% | - |
| Mean Turnover | 0.0000 | - |
| Mean Trades Executed | 0.00 | - |

## Acceptance Criteria (Paper §14)

- [x] No positive material edge: 95% CI upper bound (0.0000%) < material edge bound (0.5000%)
- [x] False positive rate (0.0000%) <= 5%

## Verdict: **PASS**

**Interpretation.** The agent did not fabricate positive edge from a zero-conditional-mean process. The 95% confidence interval lies entirely below the material edge bound.

With exploration disabled (ε = 0), the agent identifies zero economic opportunity and executes zero trades, preserving 100% of capital with zero transaction drag.


## Per-Seed Summary

| Seed | Initial Cash | Final NAV | Net Return | Annualized Return | Turnover | Trades |
|---|---|---|---|---|---|---|
| 1 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 2 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 3 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 4 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 5 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 6 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 7 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 8 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 9 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 10 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 11 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 12 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 13 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 14 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 15 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 16 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 17 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 18 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 19 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 20 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 21 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 22 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 23 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 24 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 25 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 26 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 27 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 28 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 29 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 30 | $10000.00 | $10000.00 | 0.0000% | 0.0000% | 0.0000 | 0 |

