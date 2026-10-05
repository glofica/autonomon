# T2 Known Stationary MDP Convergence Test Suite Report

**Date:** 2026-10-05T16:45:28.362Z

**Specification:** Paper §14 (Known Stationary MDP)

## Configuration

| Parameter | Value |
|---|---|
| Seeds Evaluated | 30 (Seeds 1 through 30) |
| Transitions per Seed | 50,000 |
| Discount Factor (gamma) | 0.95 |
| Step Size Schedule | Robbins-Monro alpha_n = n^(-0.7) per (s, a) pair |
| Exploration Coverage | Exploring starts (period 10) + epsilon decay (1 -> 0.35) |
| Target Error Tolerance (epsilon) | < 0.1 |
| Target Agreement Threshold | >= 95.00% |

## Ground Truth: Value Iteration Reference

Value iteration converged in **294** iterations with max Bellman residual **9.8663e-9** (< 1e-8).

| State | Optimal Action pi*(s) | Value V*(s) | Optimal Action Set |
|---|---|---|---|
| `BULL_FLAT` | **ACQUIRE_SPOT** | 0.7175 | [ACQUIRE_SPOT] |
| `BULL_LIGHT` | **ACQUIRE_SPOT** | 0.7651 | [ACQUIRE_SPOT] |
| `BULL_HEAVY` | **HOLD** | 0.7751 | [HOLD] |
| `BEAR_FLAT` | **HOLD** | 0.5680 | [HOLD] |
| `BEAR_LIGHT` | **DISPOSE_SPOT** | 0.5580 | [DISPOSE_SPOT] |
| `BEAR_HEAVY` | **DISPOSE_SPOT** | 0.5580 | [DISPOSE_SPOT] |

## Metrics (Across 30 Seeds)

| Metric | Point Estimate (Mean) | 95% Bootstrap CI | Median | Std Dev |
|---|---|---|---|---|
| Sup-Norm Q Error ||Q_agent - Q*||_inf | 0.07513 | [0.07160, 0.07872] | 0.07513 | 0.01008 |
| Action-Value Regret | 0.00000 | [0.00000, 0.00000] | 0.00000 | 0.00000 |
| Optimal-Action-Set Agreement | 100.00% | [100.00%, 100.00%] | 100.00% | 0.00% |

## Acceptance Criteria (Paper §14)

- [x] Sup-norm Q error < 0.1: mean error = 0.07513 (95% CI upper: 0.07872)
- [x] Optimal-action-set agreement >= 95.00%: mean agreement = 100.00% (95% CI lower: 100.00%)

## Verdict: **PASS**

**Interpretation.** The agent's Q-learning policy converged to the ground-truth optimal action-value function Q* under stationary tabular assumptions. The Robbins-Monro step size schedule alpha_n = n^(-0.7) and exploration coverage guaranteed sufficient sampling of every feasible state-action pair, achieving an optimal-action-set agreement well exceeding 95% and sup-norm error strictly below 0.1.

## Per-Seed Summary

| Seed | Sup-Norm Q Error | Action-Value Regret | Agreement | Min Pair Visits | Max Pair Visits |
|---|---|---|---|---|---|
| 1 | 0.06851 | 0.00000 | 100.00% | 668 | 11189 |
| 2 | 0.08634 | 0.00000 | 100.00% | 691 | 11080 |
| 3 | 0.06525 | 0.00000 | 100.00% | 707 | 11299 |
| 4 | 0.09292 | 0.00000 | 100.00% | 691 | 11215 |
| 5 | 0.07109 | 0.00000 | 100.00% | 666 | 11205 |
| 6 | 0.06919 | 0.00000 | 100.00% | 677 | 11206 |
| 7 | 0.07797 | 0.00000 | 100.00% | 680 | 11077 |
| 8 | 0.08374 | 0.00000 | 100.00% | 717 | 10968 |
| 9 | 0.06527 | 0.00000 | 100.00% | 676 | 10736 |
| 10 | 0.08009 | 0.00000 | 100.00% | 664 | 11192 |
| 11 | 0.05700 | 0.00000 | 100.00% | 663 | 11186 |
| 12 | 0.06912 | 0.00000 | 100.00% | 694 | 10994 |
| 13 | 0.08601 | 0.00000 | 100.00% | 651 | 11182 |
| 14 | 0.07823 | 0.00000 | 100.00% | 673 | 10955 |
| 15 | 0.06250 | 0.00000 | 100.00% | 681 | 11082 |
| 16 | 0.07020 | 0.00000 | 100.00% | 650 | 11164 |
| 17 | 0.08751 | 0.00000 | 100.00% | 702 | 11193 |
| 18 | 0.07229 | 0.00000 | 100.00% | 665 | 11332 |
| 19 | 0.08883 | 0.00000 | 100.00% | 669 | 11304 |
| 20 | 0.08281 | 0.00000 | 100.00% | 684 | 11175 |
| 21 | 0.05595 | 0.00000 | 100.00% | 659 | 11036 |
| 22 | 0.06596 | 0.00000 | 100.00% | 705 | 11017 |
| 23 | 0.07876 | 0.00000 | 100.00% | 711 | 11162 |
| 24 | 0.06271 | 0.00000 | 100.00% | 686 | 10919 |
| 25 | 0.08433 | 0.00000 | 100.00% | 681 | 11099 |
| 26 | 0.07077 | 0.00000 | 100.00% | 663 | 11065 |
| 27 | 0.06995 | 0.00000 | 100.00% | 700 | 11200 |
| 28 | 0.08242 | 0.00000 | 100.00% | 693 | 11135 |
| 29 | 0.07869 | 0.00000 | 100.00% | 669 | 11220 |
| 30 | 0.08948 | 0.00000 | 100.00% | 704 | 11233 |

