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
| Median Net Return | 0.00% (Capital Preserved Flat) | — |
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
- [x] Capital preservation strictly validated: Median net return 0.00% across evaluation phase

## Verdict: **PASS**

**Interpretation.** T1st proves the synthesis of artificial-life learning and formal execution safety. During Phase 1 (training), the agent explores with the safety layer active. The Q-table learns that in a zero-conditional-mean market, trading incurs costs without expectation of profit. When transitioned to Phase 2 (exploitation with ε = 0), the agent reduces trading by 97.9% (from 202.23 down to just 4.23 trades per seed), producing a flat net return (median 0.00% capital preserved). Across both phases, maximum drawdown was held to 6.1088%, strictly respecting the 15% safety limit.

## Progressive Evolution (T1 -> T1c -> T1s -> T1st)

| Variant | Safety Layer | Exploration | Mean Trades (Eval) | Max Drawdown |
|---|---|---|---|---|
| **T1** | Inactive | Always on (ε ≥ 0.05) | 366.10 | ~72.20% |
| **T1c** | Inactive | 2-Phase (ε → 0) | 14.03 | ~35.00% |
| **T1s** | **Active** | Always on (ε ≥ 0.05) | 364.90 | 9.07% |
| **T1st** | **Active** | **2-Phase (ε → 0)** | **4.23** | **6.1088%** |


