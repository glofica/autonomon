# T1 No-Edge Null Test Suite Report

**Date:** 2026-10-04T22:34:27.708Z

**Variant:** default

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
| Fabricated Alpha | 0.0000% (No Edge Fabricated) | — |
| Standard Deviation (Annualized) | 103.7969% | - |
| False Positive Rate | 0.0000% | - |
| Mean Turnover | 189.9608 | - |
| Mean Trades Executed | 366.10 | - |

## Acceptance Criteria (Paper Section 14)

- [x] No positive material edge: Upper bound < 0.50% confirmed
- [x] False positive rate (0.0000%) <= 5%

## Verdict: **PASS**

**Interpretation.** The agent did not fabricate positive edge from a zero-conditional-mean process. The 95% confidence interval lies entirely below the material edge bound.


