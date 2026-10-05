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
| Mean Net Return (Annualized) | -347.4336% (-34743.36 bps) | [-384.4550%, -312.3791%] |
| Median Net Return (Annualized) | -329.2843% | - |
| Standard Deviation (Annualized) | 103.7969% | - |
| False Positive Rate | 0.0000% | - |
| Mean Turnover | 189.9608 | - |
| Mean Trades Executed | 366.10 | - |

## Acceptance Criteria (Paper Section 14)

- [x] No positive material edge: 95% CI upper bound (-312.3791%) < material edge bound (0.5000%)
- [x] False positive rate (0.0000%) <= 5%

## Verdict: **PASS**

**Interpretation.** The agent did not fabricate positive edge from a zero-conditional-mean process. The 95% confidence interval lies entirely below the material edge bound. Mean return being negative is a separate finding documented in the diagnostic section below.

## Diagnostic Note

The mean return (-347.4336%) is negative. This is consistent with the cost of mandatory exploration under Paper Section 4 (epsilon floor = 0.05). In a market with no edge, exploration forces trades that pay transaction costs but receive zero expected return. The mean return is a finding, not a failure mode of the agent's learning.

Mean trades per seed: 366.10. Mean turnover: 189.9608. Round-trip cost per trade: 30 bps.

## Per-Seed Summary

| Seed | Initial Cash | Final NAV | Net Return | Annualized Return | Turnover | Trades |
|---|---|---|---|---|---|---|
| 1 | $10000.00 | $7037.31 | -29.6269% | -369.3489% | 185.7957 | 314 |
| 2 | $10000.00 | $7486.48 | -25.1352% | -304.3087% | 170.7451 | 256 |
| 3 | $10000.00 | $7355.77 | -26.4423% | -322.8243% | 178.0338 | 387 |
| 4 | $10000.00 | $5954.14 | -40.4586% | -545.0454% | 276.9788 | 534 |
| 5 | $10000.00 | $6712.99 | -32.8701% | -418.9467% | 204.4883 | 400 |
| 6 | $10000.00 | $6486.17 | -35.1383% | -455.0775% | 201.5260 | 408 |
| 7 | $10000.00 | $7195.96 | -28.0404% | -345.9138% | 170.9176 | 377 |
| 8 | $10000.00 | $5244.83 | -47.5517% | -678.3841% | 250.4818 | 598 |
| 9 | $10000.00 | $6752.23 | -32.4777% | -412.8192% | 190.5329 | 414 |
| 10 | $10000.00 | $7545.83 | -24.5417% | -296.0073% | 146.9893 | 283 |
| 11 | $10000.00 | $7611.37 | -23.8863% | -286.9160% | 181.5045 | 290 |
| 12 | $10000.00 | $7086.46 | -29.1354% | -362.0326% | 182.7533 | 334 |
| 13 | $10000.00 | $7782.98 | -22.1702% | -263.4783% | 182.8031 | 364 |
| 14 | $10000.00 | $6824.09 | -31.7591% | -401.6903% | 200.1758 | 411 |
| 15 | $10000.00 | $6573.34 | -34.2666% | -441.0443% | 244.5076 | 474 |
| 16 | $10000.00 | $6787.38 | -32.1262% | -407.3613% | 201.6701 | 345 |
| 17 | $10000.00 | $7873.63 | -21.2637% | -251.3055% | 209.8884 | 386 |
| 18 | $10000.00 | $8694.67 | -13.0533% | -147.0368% | 161.3842 | 240 |
| 19 | $10000.00 | $7510.00 | -24.9000% | -301.0114% | 183.6957 | 304 |
| 20 | $10000.00 | $7700.04 | -22.9996% | -274.7416% | 157.1598 | 265 |
| 21 | $10000.00 | $7925.79 | -20.7421% | -244.3655% | 158.3044 | 311 |
| 22 | $10000.00 | $7526.93 | -24.7307% | -298.6435% | 194.3630 | 341 |
| 23 | $10000.00 | $6994.97 | -30.0503% | -375.6928% | 203.8080 | 538 |
| 24 | $10000.00 | $8030.83 | -19.6917% | -230.5254% | 158.6692 | 359 |
| 25 | $10000.00 | $7409.37 | -25.9063% | -315.1921% | 164.4582 | 317 |
| 26 | $10000.00 | $7939.72 | -20.6028% | -242.5193% | 174.5717 | 314 |
| 27 | $10000.00 | $7265.91 | -27.3409% | -335.7443% | 191.6567 | 276 |
| 28 | $10000.00 | $6578.37 | -34.2163% | -440.2412% | 246.6831 | 464 |
| 29 | $10000.00 | $6978.31 | -30.2169% | -378.1996% | 174.9415 | 349 |
| 30 | $10000.00 | $7686.52 | -23.1348% | -276.5892% | 149.3369 | 330 |

