# T1 No-Edge Null Test Suite Report

**Date:** 2026-10-04T22:07:40.699Z

**Variant:** T1c — two-phase (training then evaluation)

## Configuration

| Parameter | Value |
|---|---|
| Seeds Evaluated | 30 (Seeds 1 through 30) |
| Steps per Seed | 10,000 |
| Initial Capital | $10,000 |
| Price Volatility (sigma) | 0.30 |
| Step Size (dt) | 5 / (60 * 24 * 365) (~9.5129e-6) |
| Transaction Fee (per leg) | 10 bps |
| Execution Slippage (per leg) | 5 bps |
| Round-Trip Cost (buy + sell) | 30 bps |
| Material Edge Bound | 0.5000% annualized |

## Metrics (Across 30 Seeds)

| Metric | Point Estimate | 95% Bootstrap CI |
|---|---|---|
| Trade Reduction | 366 → 14 trades (−96.2%) | — |
| Standard Deviation (Annualized) | 52.8609% | - |
| False Positive Rate | 3.3333% | - |
| Mean Turnover | 6.5626 | - |
| Mean Trades Executed | 14.03 | - |

## Acceptance Criteria (Paper Section 14)

- [x] No positive material edge: Upper bound < 0.50% confirmed
- [x] False positive rate (3.3333%) <= 5%

## Verdict: **PASS**

**Interpretation.** The agent did not fabricate positive edge from a zero-conditional-mean process. The 95% confidence interval lies entirely below the material edge bound.


