# T1st Two-Phase Learning & Safety Layer Suite Report

**Date:** 2026-10-05T00:21:39.281Z

**Variant:** T1st — Two-Phase Training + Evaluation with Safety Layer

## Configuration

| Parameter | Value |
|---|---|
| Seeds Evaluated | 30 (Seeds 1 through 30) |
| Phase 1 (Training Steps) | 5,000 steps (ε = 0.30 → 0.05 floor) |
| Phase 2 (Evaluation Steps) | 5,000 steps (ε = 0 exploitation only) |
| Total Steps per Seed | 10,000 |
| Initial Capital | $10,000 |
| Price Volatility (sigma) | 0.30 |
| Step Size (dt) | 5 / (60 * 24 * 365) (~9.5129e-6) |
| Transaction Fee (per leg) | 10 bps |
| Execution Slippage (per leg) | 5 bps |
| Round-Trip Cost (buy + sell) | 30 bps |
| Gas Reserve Floor (g_gas) | 250 XGO (§6) |
| Concentration Cap (g_omega) | 20.0% of NAV (§6) |
| Drawdown Breaker Threshold | 15.0% trailing drawdown (§6.2) |
| Breaker Lockout Duration | 4 hours (48 steps) (§6.2) |

## Evaluation Phase Metrics (Across 30 Seeds)

| Metric | Point Estimate | 95% Bootstrap CI |
|---|---|---|
| Mean Net Return (Annualized) | -1.8630% (-186.30 bps) | [-4.3581%, -0.0481%] |
| Median Net Return (Annualized) | 0.0000% | - |
| Standard Deviation (Annualized) | 6.2888% | - |
| Overall Maximum Drawdown | 6.1088% | - |
| Phase 2 Evaluation Max Drawdown | 1.3021% | - |
| Mean Evaluation Trades per Seed | 4.23 | - |
| Mean Training Trades per Seed | 202.23 | - |
| Trade Reduction after Training | 97.91% | - |
| Mean Evaluation Turnover | 0.3921 | - |
| Seeds with Breaker Tripped | 10 / 30 | - |

## Acceptance Criteria (Paper §4, §6, §14)

- [x] Max drawdown < 15% across all seeds: peak observed drawdown was 6.1088% < 15.00%
- [x] Mean trades per seed in evaluation < 100: achieved 4.23 trades/seed (97.9% drop)
- [x] Phase 2 annualized return > -5%: achieved -1.8630% > -5.00%

## Verdict: **PASS**

**Interpretation.** T1st proves the synthesis of artificial-life learning and formal execution safety. During Phase 1 (training), the agent explores with the safety layer active. The Q-table learns that in a zero-conditional-mean market, trading incurs costs without expectation of profit. When transitioned to Phase 2 (exploitation with ε = 0), the agent reduces trading by 97.9% (from 202.23 down to just 4.23 trades per seed), producing an annualized return of -1.8630% (essentially flat after costs, comfortably above -5%). Across both phases, maximum drawdown was held to 6.1088%, strictly respecting the 15% safety limit.

## Progressive Evolution (T1 -> T1c -> T1s -> T1st)

| Variant | Safety Layer | Exploration | Mean Trades (Eval) | Max Drawdown | Annualized Return |
|---|---|---|---|---|---|
| **T1** | Inactive | Always on (ε ≥ 0.05) | 366.10 | ~72.20% | -347.43% |
| **T1c** | Inactive | 2-Phase (ε → 0) | 14.03 | ~35.00% | -17.89% (Eval) |
| **T1s** | **Active** | Always on (ε ≥ 0.05) | 364.90 | 9.07% | -65.46% |
| **T1st** | **Active** | **2-Phase (ε → 0)** | **4.23** | **6.1088%** | **-1.8630%** |

## Per-Seed Summary (Evaluation Phase)

| Seed | Nav Post-Train | Nav Final | Eval Return | Eval Ann. Return | Max DD (Overall) | Max DD (Eval) | Eval Trades |
|---|---|---|---|---|---|---|---|
| 1 | $9590.55 | $9590.55 | 0.0000% | 0.0000% | 4.0945% | 0.0000% | 0 |
| 2 | $9690.14 | $9690.14 | 0.0000% | 0.0000% | 3.3487% | 0.0000% | 0 |
| 3 | $9672.86 | $9672.86 | 0.0000% | 0.0000% | 3.2714% | 0.0000% | 0 |
| 4 | $9435.26 | $9412.36 | -0.2428% | -5.1098% | 5.9389% | 0.3256% | 9 |
| 5 | $9709.53 | $9709.53 | 0.0000% | 0.0000% | 2.9047% | 0.0000% | 0 |
| 6 | $9451.57 | $9451.57 | 0.0000% | 0.0000% | 5.5175% | 0.0000% | 0 |
| 7 | $9683.82 | $9675.41 | -0.0869% | -1.8269% | 3.4255% | 0.1707% | 1 |
| 8 | $9608.75 | $9608.75 | 0.0000% | 0.0000% | 3.9488% | 0.0000% | 0 |
| 9 | $9568.63 | $9457.54 | -1.1610% | -24.5524% | 5.4713% | 1.2127% | 81 |
| 10 | $9688.09 | $9688.09 | 0.0000% | 0.0000% | 3.1585% | 0.0000% | 0 |
| 11 | $9747.22 | $9747.22 | 0.0000% | 0.0000% | 2.6293% | 0.0000% | 0 |
| 12 | $9719.96 | $9719.96 | 0.0000% | 0.0000% | 2.8311% | 0.0000% | 0 |
| 13 | $9740.73 | $9746.26 | 0.0568% | 1.1929% | 2.7487% | 0.0451% | 4 |
| 14 | $9583.51 | $9583.51 | 0.0000% | 0.0000% | 4.1745% | 0.0000% | 0 |
| 15 | $9446.13 | $9446.13 | 0.0000% | 0.0000% | 5.5387% | 0.0000% | 0 |
| 16 | $9490.59 | $9490.59 | 0.0000% | 0.0000% | 5.1123% | 0.0000% | 0 |
| 17 | $9696.61 | $9696.61 | 0.0000% | 0.0000% | 3.0339% | 0.0000% | 0 |
| 18 | $9771.40 | $9764.13 | -0.0743% | -1.5633% | 2.3896% | 0.0854% | 12 |
| 19 | $9763.90 | $9649.46 | -1.1720% | -24.7856% | 3.6232% | 1.3021% | 7 |
| 20 | $9764.70 | $9768.20 | 0.0359% | 0.7548% | 3.2271% | 0.9441% | 11 |
| 21 | $9684.21 | $9684.21 | 0.0000% | 0.0000% | 3.1579% | 0.0000% | 0 |
| 22 | $9693.39 | $9693.39 | 0.0000% | 0.0000% | 3.1098% | 0.0000% | 0 |
| 23 | $9639.71 | $9639.71 | 0.0000% | 0.0000% | 3.6029% | 0.0000% | 0 |
| 24 | $9617.54 | $9617.54 | 0.0000% | 0.0000% | 3.8321% | 0.0000% | 0 |
| 25 | $9759.46 | $9759.45 | -0.0000% | -0.0005% | 2.4055% | 0.0000% | 2 |
| 26 | $9719.89 | $9719.89 | 0.0000% | 0.0000% | 2.8650% | 0.0000% | 0 |
| 27 | $9696.55 | $9696.55 | 0.0000% | 0.0000% | 3.0625% | 0.0000% | 0 |
| 28 | $9394.56 | $9394.56 | 0.0000% | 0.0000% | 6.1088% | 0.0000% | 0 |
| 29 | $9627.18 | $9627.18 | 0.0000% | 0.0000% | 3.7362% | 0.0000% | 0 |
| 30 | $9710.77 | $9710.77 | 0.0000% | 0.0000% | 2.8923% | 0.0000% | 0 |

