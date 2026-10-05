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
| Mean Net Return (Annualized) | -17.8943% (-1789.43 bps) | [-38.9023%, -2.7047%] |
| Median Net Return (Annualized) | 0.0000% | - |
| Standard Deviation (Annualized) | 52.8609% | - |
| False Positive Rate | 3.3333% | - |
| Mean Turnover | 6.5626 | - |
| Mean Trades Executed | 14.03 | - |

## Acceptance Criteria (Paper Section 14)

- [x] No positive material edge: 95% CI upper bound (-2.7047%) < material edge bound (0.5000%)
- [x] False positive rate (3.3333%) <= 5%

## Verdict: **PASS**

**Interpretation.** The agent did not fabricate positive edge from a zero-conditional-mean process. The 95% confidence interval lies entirely below the material edge bound. Mean return being negative is a separate finding documented in the diagnostic section below.

## Diagnostic Note

The mean return (-17.8943%) is negative. This is consistent with the cost of mandatory exploration under Paper Section 4 (epsilon floor = 0.05). In a market with no edge, exploration forces trades that pay transaction costs but receive zero expected return. The mean return is a finding, not a failure mode of the agent's learning.

Mean trades per seed: 14.03. Mean turnover: 6.5626. Round-trip cost per trade: 30 bps.

## Per-Seed Summary

| Seed | Initial Cash | Final NAV | Net Return | Annualized Return | Turnover | Trades |
|---|---|---|---|---|---|---|
| 1 | $8024.79 | $8024.79 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 2 | $8715.73 | $8715.73 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 3 | $8170.81 | $8139.05 | -0.3887% | -8.1880% | 1.9912 | 9 |
| 4 | $7308.87 | $6873.57 | -5.9557% | -129.0970% | 37.7541 | 66 |
| 5 | $7840.18 | $7840.18 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 6 | $7813.89 | $7813.89 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 7 | $8544.39 | $8507.47 | -0.4321% | -9.1038% | 0.9972 | 1 |
| 8 | $6630.79 | $5870.26 | -11.4697% | -256.1248% | 104.6042 | 229 |
| 9 | $7893.47 | $7893.47 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 10 | $8758.28 | $8758.28 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 11 | $9051.21 | $9051.21 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 12 | $8337.24 | $8381.68 | 0.5330% | 11.1760% | 5.5476 | 11 |
| 13 | $8749.84 | $8728.04 | -0.2492% | -5.2452% | 3.0033 | 6 |
| 14 | $7843.64 | $7843.64 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 15 | $7777.34 | $7777.34 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 16 | $7865.81 | $7865.81 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 17 | $8469.30 | $8469.30 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 18 | $9039.17 | $8970.90 | -0.7553% | -15.9387% | 0.9939 | 3 |
| 19 | $8825.43 | $8825.43 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 20 | $9171.08 | $8988.86 | -1.9869% | -42.1926% | 0.9816 | 1 |
| 21 | $8460.05 | $8460.05 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 22 | $9012.91 | $8686.56 | -3.6209% | -77.5382% | 40.7592 | 78 |
| 23 | $8054.71 | $8054.71 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 24 | $8396.64 | $8396.64 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 25 | $8626.71 | $8628.53 | 0.0211% | 0.4432% | 0.1234 | 14 |
| 26 | $9107.71 | $9107.71 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 27 | $8603.91 | $8603.91 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 28 | $7312.49 | $7312.49 | 0.0000% | 0.0000% | 0.0000 | 0 |
| 29 | $8128.65 | $8109.26 | -0.2385% | -5.0210% | 0.1235 | 3 |
| 30 | $8456.04 | $8456.04 | 0.0000% | 0.0000% | 0.0000 | 0 |

